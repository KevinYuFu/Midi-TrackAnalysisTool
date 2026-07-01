import type { ReactNode } from 'react'

export interface Option {
  value: string
  label?: string
  node?: ReactNode // e.g. an icon
}

// Segmented control for discrete choices (stem, sweep mode, waveshape).
export function Selector({
  options,
  value,
  onChange,
}: {
  options: Option[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="selector">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.node ?? o.label ?? o.value}
        </button>
      ))}
    </div>
  )
}
