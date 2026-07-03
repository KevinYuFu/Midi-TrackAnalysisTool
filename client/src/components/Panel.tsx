import type { ReactNode } from 'react'

// A synth "module" — titled section with a divider, controls laid out in a row.
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="module">
      <div className="module-title">{title}</div>
      <div className="module-body">{children}</div>
    </section>
  )
}
