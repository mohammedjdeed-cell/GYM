import { machineOf, repsOf, setsOf, type Exercise } from '../data/plan'
import { num } from '../i18n'
import { useStore, useT, type SetLog } from '../store'
import { De, Rich } from './ui'

export function ExerciseCard({ ex, logs, mai, weightOn, kgHint, onToggle, onKg, onMachine, onVideo }: {
  ex: Exercise
  logs: SetLog[] | undefined
  mai?: boolean
  weightOn: boolean
  kgHint: (idx: number) => number | null
  onToggle: (idx: number) => void
  onKg: (idx: number, kg: number | null) => void
  onMachine: () => void
  onVideo: () => void
}) {
  const t = useT()
  const lang = useStore().settings.lang
  const n = setsOf(ex)
  const m = machineOf(ex)
  const badge = n > 1 ? `${num(n, lang)} × ${repsOf(ex)[lang]}` : repsOf(ex)[lang]
  const orange = ex.optional || mai

  return (
    <article
      data-testid="exercise"
      data-ex={ex.id}
      className={`mb-3 rounded-2xl bg-card p-4 ${mai ? 'border-2 border-dashed border-warn' : 'border border-line'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[1.05rem] font-bold leading-snug">{ex.name[lang]}</div>
          <De className="text-[.82rem]">{ex.de}</De>
        </div>
        <span
          data-testid="badge"
          className={`flex-none whitespace-nowrap rounded-full px-3 py-0.5 text-[.8rem] font-bold ${
            orange ? 'bg-warn text-onwarn' : 'bg-accent text-onaccent'
          }`}
        >
          {badge}
        </span>
      </div>

      {ex.note && (
        <p className="mt-2 text-[.9rem] text-muted">
          <Rich text={ex.note[lang]} />
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          data-testid="btn-machine"
          onClick={onMachine}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-soft px-2 text-[.85rem] font-bold text-accent"
        >
          <span aria-hidden>📷</span> {t('showMachine')}
          {m && (
            <small dir="ltr" className="font-semibold text-muted">
              {m.model.replace(/^.* /, '')}
            </small>
          )}
        </button>
        <button
          data-testid="btn-video"
          onClick={onVideo}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-ytsoft px-2 text-[.85rem] font-bold text-yt"
        >
          <span aria-hidden>▶</span> {t('showVideo')}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        {Array.from({ length: n }, (_, i) => {
          const done = logs?.[i]?.done ?? false
          const hint = weightOn ? kgHint(i) : null
          return (
            <div key={i} className="flex-1">
              <button
                data-testid="set"
                aria-pressed={done}
                onClick={() => onToggle(i)}
                className={`min-h-12 w-full rounded-xl border font-bold transition-colors ${
                  done ? 'border-accent bg-accent text-onaccent' : 'border-line bg-bg text-muted'
                }`}
              >
                {done ? '✓ ' : ''}
                {n > 1 ? t('setN', { n: i + 1 }) : t('done')}
              </button>
              {weightOn && n > 1 && (
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  dir="ltr"
                  data-testid="kg"
                  aria-label={`${t('setN', { n: i + 1 })} ${t('kg')}`}
                  placeholder={hint != null ? String(hint) : t('kg')}
                  value={logs?.[i]?.kg ?? ''}
                  onChange={(e) => onKg(i, e.target.value === '' ? null : Number(e.target.value))}
                  className="mt-1.5 h-12 w-full rounded-xl border border-line bg-bg px-2 text-center text-base text-ink"
                />
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}
