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

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

// Keep the visible window inside the track. At zoom 1 it's pinned; zoomed in the
// center can range so the window sweeps start -> end.
function clampCenterVal(c: number, visibleLen: number, duration: number) {
  if (duration <= 0 || visibleLen >= duration) return 0.5
  const half = visibleLen / 2 / duration
  return clamp(c, half, 1 - half)
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

async function analyze(file: File): Promise<{ peaks: Band[]; duration: number }> {
  const arrayBuf = await file.arrayBuffer()
  const ac = new AudioContext()
  const audioBuf = await ac.decodeAudioData(arrayBuf)
  ac.close()

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
  return { peaks, duration: audioBuf.duration }
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
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  if (cssW === 0) return
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  const g = canvas.getContext('2d')
  if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, cssW, cssH)

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

  // Beatgrid — anchored to the track at the downbeat offset, so it scrolls with
  // the audio during playback.
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

  // Fixed playhead at center.
  g.strokeStyle = '#5b7cfa'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx, 0)
  g.lineTo(cx, cssH)
  g.stroke()
}

// Rekordbox-style deck. Drag the waveform to align a downbeat to the center
// playhead (sets the offset). Scroll wheel / scrollbar navigate. Spacebar plays
// from the playhead and scrolls the waveform past it so you can watch alignment.
export function Waveform({ file, bpm, onDownbeatChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [peaks, setPeaks] = useState<Band[] | null>(null)
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [centerFrac, setCenterFrac] = useState(0.5)
  const [offsetSec, setOffsetSec] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scrolling, setScrolling] = useState(false)

  const zoomRef = useRef(1)
  const centerRef = useRef(0.5)
  const durationRef = useRef(0)
  const playingRef = useRef(false)
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
    onDbRef.current = onDownbeatChange
  })

  // Decode + analyze on new file.
  useEffect(() => {
    if (!file) {
      setPeaks(null)
      return
    }
    setZoom(1)
    setCenterFrac(0.5)
    setOffsetSec(0)
    setPlaying(false)
    let cancelled = false
    analyze(file)
      .then(({ peaks, duration }) => {
        if (cancelled) return
        setPeaks(peaks)
        setDuration(duration)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [file])

  // Playback element.
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    audio.addEventListener('ended', () => setPlaying(false))
    audioRef.current = audio
    return () => {
      audio.pause()
      URL.revokeObjectURL(url)
      audioRef.current = null
    }
  }, [file])

  const visibleLen = duration > 0 ? duration / zoom : 0
  const eCenter = clampCenterVal(centerFrac, visibleLen, duration)
  const viewStart = eCenter * duration - visibleLen / 2

  // Report offset up whenever it changes.
  useEffect(() => {
    onDbRef.current(Math.round(offsetSec * 1000))
  }, [offsetSec])

  // Re-derive the offset from the current center when BPM (or the track) changes,
  // unless we're mid-playback.
  useEffect(() => {
    if (!duration || playingRef.current) return
    const vLen = duration / zoomRef.current
    const c = clampCenterVal(centerRef.current, vLen, duration)
    const barSec = (60 / (bpm || 120)) * 4
    const ct = c * duration
    setOffsetSec(((ct % barSec) + barSec) % barSec)
  }, [bpm, duration])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const render = () => draw(canvas, peaks, bpm, duration, viewStart, visibleLen, offsetSec)
    render()
    window.addEventListener('resize', render)
    return () => window.removeEventListener('resize', render)
  }, [peaks, bpm, duration, viewStart, visibleLen, offsetSec])

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
        setCenterFrac((f) => clamp(f + df, 0, 1))
      } else {
        setZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.0015), 1, MAX_ZOOM))
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [duration])

  // Follow playback: scroll the waveform so the playing time sits at the playhead.
  useEffect(() => {
    if (!playing || !duration) return
    const audio = audioRef.current
    if (!audio) return
    let raf = 0
    const tick = () => {
      setCenterFrac(clamp(audio.currentTime / duration, 0, 1))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, duration])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    const dur = durationRef.current
    if (!audio || !dur) return
    if (playingRef.current) {
      audio.pause()
      setPlaying(false)
    } else {
      const c = clampCenterVal(centerRef.current, dur / zoomRef.current, dur)
      audio.currentTime = clamp(c * dur, 0, Math.max(0, dur - 0.05))
      audio.play().then(() => setPlaying(true)).catch(() => {})
    }
  }, [])

  // Spacebar = play/pause (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const el = document.activeElement as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      e.preventDefault()
      togglePlay()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [togglePlay])

  // Drag the waveform to align: pan the view and keep a downbeat under the playhead.
  const drag = useRef<{ x: number; center: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, center: centerFrac }
  }
  const onMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!drag.current || !canvas || !duration) return
    const df = -((e.clientX - drag.current.x) / canvas.clientWidth) * (visibleLen / duration)
    const newCenter = clamp(drag.current.center + df, 0, 1)
    setCenterFrac(newCenter)
    const c = clampCenterVal(newCenter, visibleLen, duration)
    const barSec = (60 / (bpm || 120)) * 4
    const ct = c * duration
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
    setCenterFrac(clamp((clientX - rect.left) / rect.width, 0, 1))
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

  // Vertical zoom slider (top = max zoom).
  const zoomDrag = useRef(false)
  const zoomTo = (clientY: number, el: Element) => {
    const rect = el.getBoundingClientRect()
    const frac = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
    setZoom(clamp(Math.exp(frac * Math.log(MAX_ZOOM)), 1, MAX_ZOOM))
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
  const zoomFrac = Math.log(zoom) / Math.log(MAX_ZOOM)

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
    </div>
  )
}
