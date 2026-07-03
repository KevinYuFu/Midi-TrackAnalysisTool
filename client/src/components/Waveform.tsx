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

const COLUMNS = 1400
const ANALYZE_RATE = 11025 // downsample for cheap band analysis

// Render the buffer through one filter at a reduced sample rate (offline).
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

  // Empty state: just a faint centerline.
  if (!peaks || peaks.length === 0) {
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(0, midY)
    g.lineTo(cssW, midY)
    g.stroke()
    return
  }

  const n = peaks.length

  // Waveform — colored by frequency band (R=lows, G=mids, B=highs).
  g.lineWidth = 1
  for (let c = 0; c < n; c++) {
    const x = (c / n) * cssW
    const p = peaks[c]
    const amp = Math.max(p.lo, p.mid, p.hi)
    const h = amp * (cssH / 2 - 2)
    const r = Math.round(255 * p.lo)
    const gr = Math.round(255 * p.mid)
    const b = Math.round(255 * p.hi)
    g.strokeStyle = `rgb(${r},${gr},${b})`
    g.beginPath()
    g.moveTo(x, midY - h)
    g.lineTo(x, midY + h)
    g.stroke()
  }

  // Beatgrid overlay, anchored at the downbeat.
  if (duration > 0 && bpm > 0) {
    const pxPerSec = cssW / duration
    const beat = 60 / bpm
    const offset = downbeatMs / 1000
    const kStart = Math.ceil((0 - offset) / beat)
    for (let k = kStart; ; k++) {
      const t = offset + k * beat
      if (t > duration) break
      if (t < 0) continue
      const x = t * pxPerSec
      const isDownbeat = (((k % 4) + 4) % 4) === 0
      g.strokeStyle = isDownbeat ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)'
      g.lineWidth = isDownbeat ? 2 : 1
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, cssH)
      g.stroke()
    }
  }
}

// Rekordbox-style waveform + draggable beatgrid.
export function Waveform({ file, bpm, downbeatMs, onDownbeatChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<Band[] | null>(null)
  const [duration, setDuration] = useState(0)
  const drag = useRef<{ x: number; ms: number } | null>(null)

  useEffect(() => {
    if (!file) {
      setPeaks(null)
      return
    }
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const render = () => draw(canvas, peaks, bpm, downbeatMs, duration)
    render()
    window.addEventListener('resize', render)
    return () => window.removeEventListener('resize', render)
  }, [peaks, bpm, downbeatMs, duration])

  const barLenMs = (60 / (bpm || 120)) * 4 * 1000
  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, ms: downbeatMs }
  }
  const onMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!drag.current || !canvas || !duration) return
    const dt = ((e.clientX - drag.current.x) / canvas.clientWidth) * duration * 1000
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
