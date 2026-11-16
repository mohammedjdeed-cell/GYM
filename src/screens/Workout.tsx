import { useState } from 'react'
import { DAY_IDS, getDay, groupsFor, setsOf, type DayId, type Exercise } from '../data/plan'
import { num } from '../i18n'
import {
  clearDraft,
  draftKey,
  draftSetsDone,
  finishWorkout,
  lastKg,
  setKg,
  toggleSet,
  updateSettings,
  useStore,
  useT,
} from '../store'
import { ExerciseCard } from '../components/ExerciseCard'
import { MachineSheet, VideoSheet } from '../components/ExerciseSheets'
import { RestTimer } from '../components/RestTimer'
import { De, Rich, Segmented } from '../components/ui'

export function Workout({ dayId }: { dayId: DayId }) {
  const { settings, sessions, drafts } = useStore()
  const t = useT()
  const { lang, profile, rest } = settings
  const day = getDay(dayId)
  const groups = groupsFor(day, profile)
  const exercises = groups.flatMap((g) => g.exercises)
  const draft = drafts[draftKey(profile, dayId)]
  const total = exercises.reduce((n, e) => n + setsOf(e), 0)
  const done = draftSetsDone(draft)

  const [sheet, setSheet] = useState<{ kind: 'machine' | 'video'; ex: Exercise } | null>(null)
  const [timer, setTimer] = useState<{ endAt: number; total: number } | null>(null)

  const onToggle = (ex: Exercise, idx: number) => {
    const nowDone = toggleSet(dayId, ex.id, idx, setsOf(ex))
    if (nowDone && rest > 0) setTimer({ endAt: Date.now() + rest * 1000, total: rest })
  }

  const finish = () => {
    finishWorkout(dayId, exercises.map((e) => ({ id: e.id, sets: setsOf(e) })))
    setTimer(null)
    location.hash = '#/history'
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 bg-bg px-4 pb-2 pt-1">
        <div className="flex gap-2">
          {DAY_IDS.map((d, i) => (
            <a
              key={d}
              href={`#/workout/${d}`}
              data-testid={`tab-${d}`}
              aria-current={d === dayId ? 'page' : undefined}
              className={`flex min-h-12 flex-1 items-center justify-center rounded-xl border text-[.95rem] font-bold ${
                d === dayId ? 'border-accent bg-accent text-onaccent' : 'border-line bg-card text-ink'
              }`}
            >
              {t('day')} {num(i + 1, lang)}
            </a>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <span className="text-xs font-bold text-muted" data-testid="progress">{t('setsDone', { a: done, b: total })}</span>
        </div>
      </div>

      <div className="mb-3 rounded-2xl bg-soft px-4 py-3">
        <h2 className="text-lg font-extrabold">{day.title[lang]}</h2>
        <De className="text-sm">{day.de}</De>
      </div>

      <div className="mb-2">
        <div className="mb-1 text-xs font-bold text-muted">{t('restTimer')}</div>
        <Segmented
          value={rest}
          onChange={(v) => updateSettings({ rest: v })}
          options={[
            { value: 0, label: t('off') },
            { value: 60, label: `${num(60, lang)} ${t('sec')}` },
            { value: 90, label: `${num(90, lang)} ${t('sec')}` },
          ]}
        />
      </div>

      {groups.map((g) => (
        <section key={g.name.en} data-testid="group">
          <h3 className={`mb-2 mt-5 px-1 text-[.95rem] font-bold ${g.maiOnly ? 'text-warn' : 'text-muted'}`}>{g.name[lang]}</h3>
          {g.note && (
            <p className="mb-3 rounded-2xl border-2 border-dashed border-warn bg-card p-3 text-[.9rem] text-muted">
              <Rich text={g.note[lang]} />
            </p>
          )}
          {g.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              mai={g.maiOnly}
              logs={draft?.sets[ex.id]}
              weightOn={settings.weight[profile]}
              kgHint={(i) => lastKg(sessions, profile, ex.id, i)}
              onToggle={(i) => onToggle(ex, i)}
              onKg={(i, kg) => setKg(dayId, ex.id, i, setsOf(ex), kg)}
              onMachine={() => setSheet({ kind: 'machine', ex })}
              onVideo={() => setSheet({ kind: 'video', ex })}
            />
          ))}
        </section>
      ))}

      <button
        data-testid="finish"
        disabled={done === 0}
        onClick={finish}
        className="mt-4 min-h-14 w-full rounded-2xl bg-accent text-lg font-extrabold text-onaccent disabled:opacity-40"
      >
        {t('finishWorkout')} · {t('setsDone', { a: done, b: total })}
      </button>
      {done === 0 ? (
        <p className="mt-2 text-center text-sm text-muted">{t('finishHint')}</p>
      ) : (
        <button onClick={() => clearDraft(dayId)} className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-card text-sm font-bold text-muted">
          {t('clearTicks')}
        </button>
      )}

      {timer && !sheet && <RestTimer key={timer.endAt} endAt={timer.endAt} total={timer.total} onDone={() => setTimer(null)} />}
      {sheet?.kind === 'machine' && <MachineSheet ex={sheet.ex} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'video' && <VideoSheet ex={sheet.ex} onClose={() => setSheet(null)} />}
    </>
  )
}
