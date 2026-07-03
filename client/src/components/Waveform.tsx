import { useEffect, useRef, useState } from 'react'

interface Band {
  lo: number
  mid: number
  hi: number
}

interface Props {
  file: File | null
  bpm: number
  downbeatMs: number
  onDownbeatChange: (ms: number) => void
}

const COLUMNS = 4000
const ANALYZE_RATE = 11025 // downsample for cheap band analysis
const MAX_ZOOM = 400

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

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
  const step = Math.max(1, Math.floor(len / COLUMNS))
  const peaks: Band[] = []
  let gmax = 1e-6
  for (let c = 0; c < COLUMNS; c++) {
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
  downbeatMs: number,
  duration: number,
  viewStart: number,
  visibleLen: number,
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

  if (!peaks || peaks.length === 0 || visibleLen <= 0) {
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(0, midY)
    g.lineTo(cssW, midY)
    g.stroke()
    return
  }

  const n = peaks.length

  // Waveform — one screen column per pixel, aggregating the peaks it covers.
  g.lineWidth = 1
  for (let x = 0; x < cssW; x++) {
    const t0 = viewStart + (x / cssW) * visibleLen
    const t1 = viewStart + ((x + 1) / cssW) * visibleLen
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
    const h = amp * (cssH / 2 - 2)
    g.strokeStyle = `rgb(${Math.round(255 * lo)},${Math.round(255 * mid)},${Math.round(255 * hi)})`
    g.beginPath()
    g.moveTo(x + 0.5, midY - h)
    g.lineTo(x + 0.5, midY + h)
    g.stroke()
  }

  // Beatgrid overlay, anchored at the downbeat.
  if (bpm > 0) {
    const pxPerSec = cssW / visibleLen
    const beat = 60 / bpm
    const offset = downbeatMs / 1000
    let k = Math.floor((viewStart - offset) / beat) - 1
    while (true) {
      const t = offset + k * beat
      const x = (t - viewStart) * pxPerSec
      if (x > cssW) break
      if (x >= 0 && t >= 0 && t <= duration) {
        const isDownbeat = (((k % 4) + 4) % 4) === 0
        g.strokeStyle = isDownbeat ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)'
        g.lineWidth = isDownbeat ? 2 : 1
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, cssH)
        g.stroke()
      }
      k++
    }
  }
}

// Rekordbox-style waveform with scroll-wheel zoom + draggable beatgrid.
export function Waveform({ file, bpm, downbeatMs, onDownbeatChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<Band[] | null>(null)
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [startFrac, setStartFrac] = useState(0)
  const drag = useRef<{ x: number; ms: number } | null>(null)

  // Latest zoom/pan for the (non-passive) wheel listener without re-binding it.
  const zoomRef = useRef(1)
  const startRef = useRef(0)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  useEffect(() => {
    startRef.current = startFrac
  }, [startFrac])

  useEffect(() => {
    if (!file) {
      setPeaks(null)
      return
    }
    setZoom(1)
    setStartFrac(0)
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

  const visibleLen = duration > 0 ? duration / zoom : 0
  const maxStart = Math.max(0, duration - visibleLen)
  const viewStart = clamp(startFrac * duration, 0, maxStart)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const render = () => draw(canvas, peaks, bpm, downbeatMs, duration, viewStart, visibleLen)
    render()
    window.addEventListener('resize', render)
    return () => window.removeEventListener('resize', render)
  }, [peaks, bpm, downbeatMs, duration, viewStart, visibleLen])

  // Scroll wheel: vertical = zoom toward cursor, horizontal / shift = pan.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      if (!duration) return
      e.preventDefault()
      const cssW = canvas.clientWidth
      const rect = canvas.getBoundingClientRect()
      const mx = clamp(e.clientX - rect.left, 0, cssW)
      const vLen = duration / zoomRef.current
      const vStart = clamp(startRef.current * duration, 0, Math.max(0, duration - vLen))

      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        const delta = e.shiftKey ? e.deltaY : e.deltaX
        const newStart = clamp(vStart + (delta / cssW) * vLen, 0, Math.max(0, duration - vLen))
        setStartFrac(newStart / duration)
        return
      }

      const tCursor = vStart + (mx / cssW) * vLen
      const newZoom = clamp(zoomRef.current * Math.exp(-e.deltaY * 0.0015), 1, MAX_ZOOM)
      const newLen = duration / newZoom
      const newStart = clamp(tCursor - (mx / cssW) * newLen, 0, Math.max(0, duration - newLen))
      setZoom(newZoom)
      setStartFrac(duration > 0 ? newStart / duration : 0)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [duration])

  const barLenMs = (60 / (bpm || 120)) * 4 * 1000
  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, ms: downbeatMs }
  }
  const onMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!drag.current || !canvas || !duration) return
    const dt = ((e.clientX - drag.current.x) / canvas.clientWidth) * visibleLen * 1000
    let ms = drag.current.ms + dt
    ms = ((ms % barLenMs) + barLenMs) % barLenMs
    onDownbeatChange(Math.round(ms))
  }
  const onUp = () => {
    drag.current = null
  }

  return (
    <div className="waveform">
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}
