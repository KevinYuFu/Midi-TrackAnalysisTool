import { Selector } from './Selector'

const icon = (d: string) => (
  <svg width="30" height="16" viewBox="0 0 30 16" fill="none" aria-hidden>
    <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WAVES = [
  { value: 'sine', label: 'Sine', node: icon('M1 8 Q 5.5 1 10 8 T 19 8 T 28 8') },
  { value: 'triangle', label: 'Triangle', node: icon('M1 13 L8 3 L15 13 L22 3 L28 11') },
  { value: 'saw', label: 'Saw', node: icon('M1 13 L10 3 L10 13 L19 3 L19 13 L28 3') },
  { value: 'square', label: 'Square', node: icon('M1 13 L1 3 L10 3 L10 13 L19 13 L19 3 L28 3 L28 13') },
]

export function WaveSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return <Selector options={WAVES} value={value} onChange={onChange} />
}
