import { useRef, useState } from 'react'

interface Props {
  value: number
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

// Ableton-style value box: drag up/down to scrub, click (no drag) to type.
export function DragNumber({
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  format,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const drag = useRef<{ y: number; value: number; moved: boolean } | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const quantize = (v: number) => clamp(Math.round(v / step) * step)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, value, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const dy = drag.current.y - e.clientY
    if (Math.abs(dy) > 2) drag.current.moved = true
    onChange(quantize(drag.current.value + (dy / 3) * step))
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) {
      setDraft(String(value))
      setEditing(true)
    }
  }

  const commit = () => {
    const n = parseFloat(draft)
    if (!Number.isNaN(n)) onChange(quantize(n))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className="dragnum-input"
        autoFocus
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  return (
    <div
      className="dragnum"
      style={{ cursor: 'ns-resize', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {format ? format(value) : value}
    </div>
  )
}
