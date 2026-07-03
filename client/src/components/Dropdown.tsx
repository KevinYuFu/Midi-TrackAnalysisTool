import { useEffect, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: DropdownOption[] | string[]
  onChange: (v: string) => void
  width?: number | string
}

// Themed dropdown — replaces native <select> so the open menu matches the app
// instead of the OS default colorway.
export function Dropdown({ value, options, onChange, width }: Props) {
  const opts: DropdownOption[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const current = opts.find((o) => o.value === value)

  return (
    <div
      className={`dropdown-wrap${open ? ' open' : ''}`}
      ref={ref}
      style={width ? { width } : undefined}
    >
      <button type="button" className="dropdown-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{current?.label ?? value}</span>
        <svg className="chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu">
          {opts.map((o) => (
            <button
              type="button"
              key={o.value}
              className={`dropdown-item${o.value === value ? ' active' : ''}`}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
