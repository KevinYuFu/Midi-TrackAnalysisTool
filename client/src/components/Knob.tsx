import { useCallback, useRef } from 'react'

interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

// Continuous rotary control. Drag vertically to change (up = increase).
// Use for smooth values (threshold, period); use a typed field for discrete
// things like key.
export function Knob({ label, value, min, max, step = 1, format, onChange }: KnobProps) {
  const dragStart = useRef<{ y: number; value: number } | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const quantize = (v: number) => clamp(Math.round(v / step) * step)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as Element).setPointerCapture(e.pointerId)
      dragStart.current = { y: e.clientY, value }
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStart.current) return
      const dy = dragStart.current.y - e.clientY
      const range = max - min
      const next = dragStart.current.value + (dy / 150) * range
      onChange(quantize(next))
    },
    [max, min, onChange, step],
  )

  const onPointerUp = () => {
    dragStart.current = null
  }

  // Map value -> rotation across a 270° sweep.
  const pct = (value - min) / (max - min)
  const angle = -135 + pct * 270

  return (
    <div className="knob-wrap">
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
      >
        <circle cx="28" cy="28" r="22" fill="var(--surface-2)" stroke="var(--border)" />
        <line
          x1="28"
          y1="28"
          x2={28 + 16 * Math.sin((angle * Math.PI) / 180)}
          y2={28 - 16 * Math.cos((angle * Math.PI) / 180)}
          stroke="var(--accent-blue)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="knob-label">{label}</span>
      <span className="knob-value">{format ? format(value) : value}</span>
    </div>
  )
}
