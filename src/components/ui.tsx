import type { ReactNode } from 'react'

/** Short vibration for touch feedback (Android Chrome; silently ignored elsewhere). */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}

/** Speaks a German word/phrase – handy for asking staff about a machine. */
export function speakDe(text: string) {
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'
    u.rate = 0.9
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('de'))
    if (voice) u.voice = voice
    synth.speak(u)
  } catch {
    /* no speech support */
  }
}

/** Renders text that may contain <b>…</b> (the only markup used in exercises.json / i18n). */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/<b>(.*?)<\/b>/g)
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} className="text-ink">{p}</b> : p))}</>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-surface p-4 ${className}`}>{children}</div>
}

/** German text: an LTR run inside RTL or LTR text, optionally with a "hear it" button. */
export function De({ children, className = '', speak }: { children: string; className?: string; speak?: boolean }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <bdi dir="ltr" lang="de" className="de">{children}</bdi>
      {speak && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            haptic()
            speakDe(children)
          }}
          aria-label="Aussprache"
          data-testid="speak"
          className="-my-2 flex h-12 w-12 flex-none items-center justify-center rounded-full text-de active:bg-surface2"
        >
          <Icon name="volume" className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => {
            haptic()
            onChange(o.value)
          }}
          aria-pressed={o.value === value}
          className={`min-h-12 flex-1 rounded-xl px-3 text-sm font-bold transition-colors ${
            o.value === value ? 'bg-accent text-onaccent shadow-sm' : 'text-muted'
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
      onClick={() => {
        haptic()
        onChange(!on)
      }}
      className="flex h-12 w-16 flex-none items-center"
    >
      <span className={`flex h-8 w-14 items-center rounded-full p-1 transition-colors ${on ? 'bg-accent' : 'bg-line'}`}>
        <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'ltr:translate-x-6 rtl:-translate-x-6' : ''}`} />
      </span>
    </button>
  )
}

/** Circular progress ring; `value` 0…1. */
export function Ring({ value, size = 96, stroke = 8, children, className = '' }: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`relative flex-none ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset .3s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">{children}</div>
    </div>
  )
}

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  dumbbell: <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />,
  history: <path d="M12 7v5l3 2M3.05 11a9 9 0 1 1 .5 4M3 4v5h5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  check: <path d="M20 6L9 17l-5-5" />,
  chevron: <path d="M9 18l6-6-6-6" />,
  volume: (
    <>
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  flame: <path d="M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3 0-3-1-5 0-8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
}

export function Icon({ name, className = 'h-6 w-6' }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
