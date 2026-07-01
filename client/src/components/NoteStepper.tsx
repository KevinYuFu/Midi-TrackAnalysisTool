import { useState } from 'react'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Ableton-style root picker: value with up/down arrows, click to open a dropdown.
export function NoteStepper({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const i = Math.max(0, NOTES.indexOf(value))
  const step = (d: number) => onChange(NOTES[(i + d + 12) % 12])

  return (
    <div className="note-stepper">
      <button type="button" className="note-value" onClick={() => setOpen((o) => !o)}>
        {value}
      </button>
      <div className="arrows">
        <button type="button" aria-label="up" onClick={() => step(1)}>
          ▲
        </button>
        <button type="button" aria-label="down" onClick={() => step(-1)}>
          ▼
        </button>
      </div>
      {open && (
        <div className="dropdown">
          {NOTES.map((n) => (
            <button
              type="button"
              key={n}
              className={n === value ? 'active' : ''}
              onClick={() => {
                onChange(n)
                setOpen(false)
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
