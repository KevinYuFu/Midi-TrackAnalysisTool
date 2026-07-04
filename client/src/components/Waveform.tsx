import { useCallback, useEffect, useRef, useState } from 'react'

interface Band {
  lo: number
  mid: number
  hi: number
}

interface Props {
  file: File | null
  bpm: number
  onDownbeatChange: (ms: number) => void
}

const ANALYZE_RATE = 22050 // higher rate -> sharper transients (kick shape)
const POINTS_PER_SEC = 1000 // ~1ms resolution per stored peak column
const MAX_ZOOM = 400
const CANVAS_H = 140
const OVERVIEW_H = 44
const JUMP_BEATS = 16 // 4 bars
const DEFAULT_VISIBLE_SEC = 18 // ~9 bars @ 120 bpm — starting zoom
const MAX_VISIBLE_SEC = 36 // cap how far out you can zoom

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function clampCenterVal(c: number, visibleLen: number, duration: number) {
  if (duration <= 0 || visibleLen >= duration) return 0.5
  const half = visibleLen / 2 / duration
  return clamp(c, half, 1 - half)
}

function zoomMinFor(duration: number) {
  return duration > 0 ? Math.max(1, duration / MAX_VISIBLE_SEC) : 1
}

async function renderBand(
  buffer: AudioBuffer,
  type: BiquadFilterType,
  freq: number,
): Promise<Float32Array> {
  const length = Math.ceil(buffer.duration * ANALYZE_RATE)
  const off = new OfflineAudioContext(1, length, ANALYZE_RATE)
  const src = off.createBufferSource()
  src.buffer = buffer
  const filter = off.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  src.connect(filter)
  filter.connect(off.destination)
  src.start()
  const rendered = await off.startRendering()
  return rendered.getChannelData(0)
}

async function analyze(
  file: File,
  ctx: BaseAudioContext,
): Promise<{
  peaks: Band[]
  duration: number
  buffer: AudioBuffer
  onset: Float32Array
  onsetRate: number
}> {
  const arrayBuf = await file.arrayBuffer()
  const audioBuf = await ctx.decodeAudioData(arrayBuf)

  const [lo, mid, hi] = await Promise.all([
    renderBand(audioBuf, 'lowpass', 200),
    renderBand(audioBuf, 'bandpass', 1200),
    renderBand(audioBuf, 'highpass', 4000),
  ])

  const len = lo.length
  const columns = Math.max(1, Math.min(1_000_000, Math.round(audioBuf.duration * POINTS_PER_SEC)))
  const step = Math.max(1, Math.floor(len / columns))
  const peaks: Band[] = []
  let gmax = 1e-6
  for (let c = 0; c < columns; c++) {
    const s = c * step
    const e = Math.min(len, s + step)
    let l = 0
    let m = 0
    let h = 0
    for (let i = s; i < e; i++) {
      const al = Math.abs(lo[i])
      const am = Math.abs(mid[i])
      const ah = Math.abs(hi[i])
      if (al > l) l = al
      if (am > m) m = am
      if (ah > h) h = ah
    }
    gmax = Math.max(gmax, l, m, h)
    peaks.push({ lo: l, mid: m, hi: h })
  }
  for (const p of peaks) {
    p.lo /= gmax
    p.mid /= gmax
    p.hi /= gmax
  }

  const onsetRate = 350
  const hop = Math.max(1, Math.round(ANALYZE_RATE / onsetRate))
  const frames = Math.floor(len / hop)
  const onset = new Float32Array(frames)
  let prevE = 0
  for (let f = 0; f < frames; f++) {
    let e = 0
    const s = f * hop
    const en = Math.min(len, s + hop)
    for (let i = s; i < en; i++) {
      const v = lo[i]
      e += v * v
    }
    onset[f] = e > prevE ? e - prevE : 0
    prevE = e
  }

  return { peaks, duration: audioBuf.duration, buffer: audioBuf, onset, onsetRate }
}

function estimateOffset(
  onset: Float32Array,
  onsetRate: number,
  bpm: number,
  duration: number,
): number {
  const bar = (60 / bpm) * 4
  if (!(bar > 0) || onset.length === 0) return 0
  const P = 720
  const acc = new Float32Array(P)
  for (let f = 0; f < onset.length; f++) {
    const t = f / onsetRate
    if (t > duration) break
    let ph = t % bar
    if (ph < 0) ph += bar
    acc[Math.min(P - 1, Math.floor((ph / bar) * P))] += onset[f]
  }
  let best = -1
  let bi = 0
  const w = 4
  for (let i = 0; i < P; i++) {
    let s = 0
    for (let j = -w; j <= w; j++) s += acc[(((i + j) % P) + P) % P]
    if (s > best) {
      best = s
      bi = i
    }
  }
  return ((bi + 0.5) / P) * bar
}

function prep(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  if (cssW === 0) return null
  const wantW = Math.round(cssW * dpr)
  const wantH = Math.round(cssH * dpr)
  if (canvas.width !== wantW) canvas.width = wantW
  if (canvas.height !== wantH) canvas.height = wantH
  const g = canvas.getContext('2d')
  if (!g) return null
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, cssW, cssH)
  return g
}

function draw(
  canvas: HTMLCanvasElement,
  peaks: Band[] | null,
  bpm: number,
  duration: number,
  viewStart: number,
  visibleLen: number,
  offsetSec: number,
) {
  const g = prep(canvas)
  if (!g) return
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  const midY = cssH / 2
  const cx = Math.round(cssW / 2)

  if (peaks && peaks.length > 0 && visibleLen > 0) {
    const n = peaks.length
    g.lineWidth = 1
    for (let x = 0; x < cssW; x++) {
      const t0 = viewStart + (x / cssW) * visibleLen
      const t1 = viewStart + ((x + 1) / cssW) * visibleLen
      if (t1 <= 0 || t0 >= duration) continue
      let c0 = Math.floor((t0 / duration) * n)
      let c1 = Math.ceil((t1 / duration) * n)
      c0 = clamp(c0, 0, n - 1)
      c1 = clamp(c1, c0 + 1, n)
      let lo = 0
      let mid = 0
      let hi = 0
      for (let c = c0; c < c1; c++) {
        const p = peaks[c]
        if (p.lo > lo) lo = p.lo
        if (p.mid > mid) mid = p.mid
        if (p.hi > hi) hi = p.hi
      }
      const amp = Math.max(lo, mid, hi)
      const h = amp * (cssH / 2 - 3)
      g.strokeStyle = `rgb(${Math.round(255 * lo)},${Math.round(255 * mid)},${Math.round(255 * hi)})`
      g.beginPath()
      g.moveTo(x + 0.5, midY - h)
      g.lineTo(x + 0.5, midY + h)
      g.stroke()
    }
  } else {
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(0, midY)
    g.lineTo(cssW, midY)
    g.stroke()
  }

  if (bpm > 0 && visibleLen > 0 && duration > 0) {
    const pxPerSec = cssW / visibleLen
    const beat = 60 / bpm
    let k = Math.floor((viewStart - offsetSec) / beat) - 1
    while (true) {
      const t = offsetSec + k * beat
      const x = (t - viewStart) * pxPerSec
      if (x > cssW) break
      if (x >= 0 && t >= 0 && t <= duration) {
        const isDown = (((k % 4) + 4) % 4) === 0
        g.strokeStyle = isDown ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)'
        g.lineWidth = isDown ? 1.5 : 1
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, cssH)
        g.stroke()
      }
      k++
    }
  }

  g.strokeStyle = '#5b7cfa'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx, 0)
  g.lineTo(cx, cssH)
  g.stroke()
}

// Whole-track overview in mountain style (bottom-anchored, RGB), with a box for
// the current view window.
function drawOverview(
  canvas: HTMLCanvasElement,
  peaks: Band[] | null,
  duration: number,
  viewStart: number,
  visibleLen: number,
) {
  const g = prep(canvas)
  if (!g) return
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight

  if (peaks && peaks.length > 0 && duration > 0) {
    const n = peaks.length
    g.lineWidth = 1
    for (let x = 0; x < cssW; x++) {
      const c0 = clamp(Math.floor((x / cssW) * n), 0, n - 1)
      const c1 = clamp(Math.ceil(((x + 1) / cssW) * n), c0 + 1, n)
      let lo = 0
      let mid = 0
      let hi = 0
      for (let c = c0; c < c1; c++) {
        const p = peaks[c]
        if (p.lo > lo) lo = p.lo
        if (p.mid > mid) mid = p.mid
        if (p.hi > hi) hi = p.hi
      }
      const amp = Math.max(lo, mid, hi)
      const h = amp * (cssH - 2)
      g.strokeStyle = `rgb(${Math.round(255 * lo)},${Math.round(255 * mid)},${Math.round(255 * hi)})`
      g.beginPath()
      g.moveTo(x + 0.5, cssH)
      g.lineTo(x + 0.5, cssH - h)
      g.stroke()
    }
  }

  if (duration > 0 && visibleLen > 0) {
    const x0 = clamp((viewStart / duration) * cssW, 0, cssW)
    const x1 = clamp(((viewStart + visibleLen) / duration) * cssW, 0, cssW)
    const w = Math.max(2, x1 - x0)
    g.fillStyle = 'rgba(91,124,250,0.18)'
    g.fillRect(x0, 0, w, cssH)
    g.strokeStyle = 'rgba(91,124,250,0.9)'
    g.lineWidth = 1
    g.strokeRect(x0 + 0.5, 0.5, w - 1, cssH - 1)
  }
}

// Waveform deck. Space plays/pauses (pause keeps position), Q/W jump 4 bars,
// drag aligns a downbeat under the center line, overview strip navigates.
export function Waveform({ file, bpm, onDownbeatChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overviewRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const onsetRef = useRef<{ onset: Float32Array; onsetRate: number } | null>(null)

  const playCtxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const srcRef = useRef<AudioBufferSourceNode | null>(null)
  const playInfoRef = useRef<{ startCtx: number; startOffset: number } | null>(null)

  const [peaks, setPeaks] = useState<Band[] | null>(null)
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [centerFrac, setCenterFrac] = useState(0.5)
  const [offsetSec, setOffsetSec] = useState(0)
  const [scrolling, setScrolling] = useState(false)
  const [playing, setPlaying] = useState(false)

  const zoomRef = useRef(1)
  const centerRef = useRef(0.5)
  const durationRef = useRef(0)
  const playingRef = useRef(false)
  const peaksRef = useRef<Band[] | null>(null)
  const bpmRef = useRef(bpm)
  const offsetRef = useRef(0)
  const onDbRef = useRef(onDownbeatChange)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  useEffect(() => {
    centerRef.current = centerFrac
  }, [centerFrac])
  useEffect(() => {
    durationRef.current = duration
  }, [duration])
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    peaksRef.current = peaks
  }, [peaks])
  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])
  useEffect(() => {
    offsetRef.current = offsetSec
  }, [offsetSec])
  useEffect(() => {
    onDbRef.current = onDownbeatChange
  })

  const getCtx = () => {
    if (!playCtxRef.current) playCtxRef.current = new AudioContext()
    return playCtxRef.current
  }
  const stopSource = useCallback(() => {
    const src = srcRef.current
    if (src) {
      src.onended = null
      try {
        src.stop()
      } catch {
        // already stopped
      }
      src.disconnect()
      srcRef.current = null
    }
    playInfoRef.current = null
  }, [])
  const livePos = useCallback(() => {
    const info = playInfoRef.current
    const ctx = playCtxRef.current
    const dur = durationRef.current
    if (!info || !ctx) return centerRef.current * dur
    const latency = ctx.outputLatency || ctx.baseLatency || 0
    return clamp(info.startOffset + (ctx.currentTime - info.startCtx) - latency, 0, dur)
  }, [])
  const startPlaybackAt = useCallback(
    (pos: number) => {
      const dur = durationRef.current
      const buffer = bufferRef.current
      if (!dur || !buffer) return
      const ctx = getCtx()
      ctx.resume().catch(() => {})
      stopSource()
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(ctx.destination)
      const startOffset = clamp(pos, 0, Math.max(0, dur - 0.05))
      src.onended = () => {
        setPlaying(false)
        setCenterFrac(1)
      }
      src.start(0, startOffset)
      srcRef.current = src
      playInfoRef.current = { startCtx: ctx.currentTime, startOffset }
      setPlaying(true)
    },
    [stopSource],
  )
  const togglePlay = useCallback(() => {
    const dur = durationRef.current
    if (!dur || !bufferRef.current) return
    if (playingRef.current) {
      const pos = livePos()
      stopSource()
      setPlaying(false)
      setCenterFrac(clamp(pos / dur, 0, 1)) // keep where we stopped
    } else {
      startPlaybackAt(centerRef.current * dur)
    }
  }, [livePos, startPlaybackAt, stopSource])
  const beatJump = useCallback(
    (dir: number) => {
      const dur = durationRef.current
      if (!dur) return
      const jump = (60 / (bpmRef.current || 120)) * JUMP_BEATS
      const cur = playingRef.current ? livePos() : centerRef.current * dur
      const next = clamp(cur + dir * jump, 0, dur)
      setCenterFrac(next / dur)
      if (playingRef.current) startPlaybackAt(next)
    },
    [livePos, startPlaybackAt],
  )

  // Decode + analyze on new file.
  useEffect(() => {
    if (!file) {
      setPeaks(null)
      return
    }
    setCenterFrac(0.5)
    setOffsetSec(0)
    setPlaying(false)
    stopSource()
    let cancelled = false
    analyze(file, getCtx())
      .then(({ peaks, duration, buffer, onset, onsetRate }) => {
        if (cancelled) return
        bufferRef.current = buffer
        onsetRef.current = { onset, onsetRate }
        setPeaks(peaks)
        setDuration(duration)
        setZoom(clamp(duration / DEFAULT_VISIBLE_SEC, zoomMinFor(duration), MAX_ZOOM))
      })
      .catch(() => {})
    return () => {
      cancelled = true
      stopSource()
    }
  }, [file, stopSource])

  useEffect(() => {
    return () => {
      playCtxRef.current?.close().catch(() => {})
    }
  }, [])

  const visibleLen = duration > 0 ? duration / zoom : 0
  const eCenter = clampCenterVal(centerFrac, visibleLen, duration)
  const viewStart = eCenter * duration - visibleLen / 2
  const zoomMin = zoomMinFor(duration)
  const clampC = (c: number) => clampCenterVal(c, visibleLen, duration)

  useEffect(() => {
    onDbRef.current(Math.round(offsetSec * 1000))
  }, [offsetSec])

  // Auto-align the grid to the detected kick onsets for the current BPM.
  useEffect(() => {
    if (!duration || playingRef.current) return
    const info = onsetRef.current
    if (!info) return
    setOffsetSec(estimateOffset(info.onset, info.onsetRate, bpm || 120, duration))
  }, [bpm, duration])

  // Idle draw (not playing) from React state.
  useEffect(() => {
    if (playing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const render = () => {
      draw(canvas, peaks, bpm, duration, viewStart, visibleLen, offsetSec)
      const ov = overviewRef.current
      if (ov) drawOverview(ov, peaks, duration, viewStart, visibleLen)
    }
    render()
    window.addEventListener('resize', render)
    return () => window.removeEventListener('resize', render)
  }, [playing, peaks, bpm, duration, viewStart, visibleLen, offsetSec])

  // Playback draw: follow the audio clock directly (no React round-trip).
  useEffect(() => {
    if (!playing || !duration) return
    const ctx = playCtxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    let raf = 0
    const tick = () => {
      const info = playInfoRef.current
      if (info) {
        const latency = ctx.outputLatency || ctx.baseLatency || 0
        const dur = durationRef.current
        const vLen = dur / zoomRef.current
        const audioTime = info.startOffset + (ctx.currentTime - info.startCtx) - latency
        const vs = audioTime - vLen / 2
        draw(canvas, peaksRef.current, bpmRef.current, dur, vs, vLen, offsetRef.current)
        const ov = overviewRef.current
        if (ov) drawOverview(ov, peaksRef.current, dur, vs, vLen)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, duration])

  // Wheel: vertical = zoom (around center); horizontal / shift = navigate.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      if (!duration) return
      e.preventDefault()
      const cssW = canvas.clientWidth
      const vLen = duration / zoomRef.current
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        const delta = e.shiftKey ? e.deltaY : e.deltaX
        const df = (delta / cssW) * (vLen / duration)
        setCenterFrac((f) => clampCenterVal(f + df, vLen, duration))
      } else {
        const zMin = zoomMinFor(durationRef.current)
        setZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.0015), zMin, MAX_ZOOM))
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [duration])

  // Keyboard: Space = play/pause, Q/W = jump 4 bars.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'KeyQ') {
        e.preventDefault()
        beatJump(-1)
      } else if (e.code === 'KeyW') {
        e.preventDefault()
        beatJump(1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [togglePlay, beatJump])

  // Drag the waveform to align: pan and keep a downbeat under the center line.
  const drag = useRef<{ x: number; center: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, center: centerFrac }
  }
  const onMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!drag.current || !canvas || !duration) return
    const df = -((e.clientX - drag.current.x) / canvas.clientWidth) * (visibleLen / duration)
    const newCenter = clampC(clamp(drag.current.center + df, 0, 1))
    setCenterFrac(newCenter)
    const barSec = (60 / (bpm || 120)) * 4
    const ct = newCenter * duration
    setOffsetSec(((ct % barSec) + barSec) % barSec)
  }
  const onUp = () => {
    drag.current = null
  }

  // Horizontal scrollbar (navigate only).
  const scrollDrag = useRef(false)
  const scrollTo = (clientX: number) => {
    const track = scrollRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    setCenterFrac(clampC(clamp((clientX - rect.left) / rect.width, 0, 1)))
  }
  const onScrollDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    scrollDrag.current = true
    setScrolling(true)
    scrollTo(e.clientX)
  }
  const onScrollMove = (e: React.PointerEvent) => {
    if (scrollDrag.current) scrollTo(e.clientX)
  }
  const onScrollUp = () => {
    scrollDrag.current = false
    setScrolling(false)
  }

  // Overview strip (navigate the whole track).
  const overviewDrag = useRef(false)
  const overviewTo = (clientX: number) => {
    const cv = overviewRef.current
    if (!cv) return
    const rect = cv.getBoundingClientRect()
    setCenterFrac(clampC(clamp((clientX - rect.left) / rect.width, 0, 1)))
  }
  const onOverviewDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    overviewDrag.current = true
    overviewTo(e.clientX)
  }
  const onOverviewMove = (e: React.PointerEvent) => {
    if (overviewDrag.current) overviewTo(e.clientX)
  }
  const onOverviewUp = () => {
    overviewDrag.current = false
  }

  // Vertical zoom slider (top = max zoom).
  const zoomDrag = useRef(false)
  const zoomTo = (clientY: number, el: Element) => {
    const rect = el.getBoundingClientRect()
    const frac = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
    const zMin = zoomMinFor(durationRef.current)
    const span = Math.max(0, Math.log(MAX_ZOOM / zMin))
    setZoom(clamp(zMin * Math.exp(frac * span), zMin, MAX_ZOOM))
  }
  const onZoomDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    zoomDrag.current = true
    zoomTo(e.clientY, e.currentTarget)
  }
  const onZoomMove = (e: React.PointerEvent) => {
    if (zoomDrag.current) zoomTo(e.clientY, e.currentTarget)
  }
  const onZoomUp = () => {
    zoomDrag.current = false
  }

  const thumbWidth = duration > 0 ? clamp(visibleLen / duration, 0.03, 1) : 1
  const thumbLeft = duration > 0 ? clamp(viewStart / duration, 0, 1 - thumbWidth) : 0
  const zoomSpan = Math.log(MAX_ZOOM / zoomMin)
  const zoomFrac = zoomSpan > 0 ? Math.log(zoom / zoomMin) / zoomSpan : 0

  return (
    <div className="deck">
      <div className="deck-body">
        <canvas
          ref={canvasRef}
          style={{ height: CANVAS_H, touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
        <div
          className="zoom-slider"
          style={{ height: CANVAS_H }}
          onPointerDown={onZoomDown}
          onPointerMove={onZoomMove}
          onPointerUp={onZoomUp}
        >
          <div className="zoom-thumb" style={{ bottom: `calc(3px + ${zoomFrac} * (100% - 32px))` }} />
        </div>
      </div>

      <div
        className="scrollbar"
        ref={scrollRef}
        onPointerDown={onScrollDown}
        onPointerMove={onScrollMove}
        onPointerUp={onScrollUp}
      >
        <div
          className={`scroll-thumb${scrolling ? ' active' : ''}`}
          style={{ left: `${thumbLeft * 100}%`, width: `${thumbWidth * 100}%` }}
        />
      </div>

      <canvas
        ref={overviewRef}
        className="overview"
        style={{ height: OVERVIEW_H, touchAction: 'none' }}
        onPointerDown={onOverviewDown}
        onPointerMove={onOverviewMove}
        onPointerUp={onOverviewUp}
      />
    </div>
  )
}
