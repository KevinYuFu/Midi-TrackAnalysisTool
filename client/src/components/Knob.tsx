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

const SIZE = 76
const C = SIZE / 2
const R_ARC = 28
const R_BODY = 19
const A0 = -135 // sweep start (deg, 0 = 12 o'clock)
const A1 = 135 // sweep end

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }
}

function arc(r: number, from: number, to: number) {
  const p0 = polar(r, from)
  const p1 = polar(r, to)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`
}

// Serum-style rotary: value arc + glow, gradient body, indicator line.
// Drag vertically to change (up = increase). Use for continuous values.
export function Knob({ label, value, min, max, step = 1, format, onChange }: KnobProps) {
  const drag = useRef<{ y: number; value: number } | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const quantize = (v: number) => clamp(Math.round(v / step) * step)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as Element).setPointerCapture(e.pointerId)
      drag.current = { y: e.clientY, value }
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return
      const dy = drag.current.y - e.clientY
      const next = drag.current.value + (dy / 150) * (max - min)
      onChange(quantize(next))
    },
    [max, min, onChange, step],
  )

  const onPointerUp = () => {
    drag.current = null
  }

  const pct = (value - min) / (max - min)
  const aVal = A0 + pct * (A1 - A0)
  const ind = polar(R_BODY - 4, aVal)

  return (
    <div className="knob-wrap">
      <svg
        width={SIZE}
        height={SIZE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
      >
        <defs>
          <radialGradient id="knobBody" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="var(--surface-2)" />
            <stop offset="100%" stopColor="var(--surface)" />
          </radialGradient>
        </defs>

        <path d={arc(R_ARC, A0, A1)} fill="none" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
        <path
          d={arc(R_ARC, A0, aVal)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 4px var(--accent))' }}
        />

        <circle cx={C} cy={C} r={R_BODY} fill="url(#knobBody)" stroke="var(--border)" />
        <line
          x1={C}
          y1={C}
          x2={ind.x}
          y2={ind.y}
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="knob-label">{label}</span>
      <span className="knob-value">{format ? format(value) : value}</span>
    </div>
  )
}
