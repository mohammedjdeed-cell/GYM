import type { ReactNode } from 'react'

/** Renders text that may contain <b>…</b> (the only markup used in exercises.json / i18n). */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/<b>(.*?)<\/b>/g)
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} className="text-ink">{p}</b> : p))}</>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</div>
}

/** German text: LTR run that still aligns with the surrounding (RTL or LTR) line. */
export function De({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <bdi dir="ltr" lang="de" className="de">{children}</bdi>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-bg p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`min-h-12 flex-1 rounded-lg px-3 text-sm font-bold ${
            o.value === value ? 'bg-accent text-onaccent' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="flex h-12 w-16 flex-none items-center"
    >
      <span className={`flex h-8 w-14 items-center rounded-full p-1 transition-colors ${on ? 'bg-accent' : 'bg-line'}`}>
        <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'ltr:translate-x-6 rtl:-translate-x-6' : ''}`} />
      </span>
    </button>
  )
}
