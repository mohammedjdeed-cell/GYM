import { useCallback, useEffect, useRef, useState } from 'react'
import { DAY_IDS, getDay, groupsFor, machineOf, repsOf, setsOf, type DayId, type Exercise, type Group } from '../data/plan'
import { locale, num } from '../i18n'
import {
  clearDraft,
  draftKey,
  draftSetsDone,
  exerciseLast,
  finishWorkout,
  lastKg,
  setKg,
  toggleSet,
  updateSettings,
  useStore,
  useT,
} from '../store'
import { MachinePhoto, MachineSheet, VideoSheet } from '../components/ExerciseSheets'
import { RestTimer } from '../components/RestTimer'
import { Sheet } from '../components/Sheet'
import { De, Icon, Rich, Ring, Segmented, haptic } from '../components/ui'

interface Item {
  ex: Exercise
  group: Group
  first: boolean
}

/** Keeps the screen on during a workout (Android Chrome); re-acquired after the app returns. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let alive = true
    const request = async () => {
      try {
        if (alive && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen')
        }
      } catch {
        /* denied or unsupported */
      }
    }
    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', request)
      void lock?.release().catch(() => {})
    }
  }, [])
}

/**
 * Focus mode: one exercise per screen, swipe sideways between them (native scroll-snap, so it
 * feels like the phone's own gestures). The big button at the bottom ticks the next set.
 */
export function Workout({ dayId }: { dayId: DayId }) {
  const { settings, sessions, drafts } = useStore()
  const t = useT()
  const { lang, profile, rest } = settings
  const weightOn = settings.weight[profile]
  const day = getDay(dayId)
  const items: Item[] = groupsFor(day, profile).flatMap((g) =>
    g.exercises.map((ex, i) => ({ ex, group: g, first: i === 0 })),
  )
  const draft = drafts[draftKey(profile, dayId)]
  const logsOf = (ex: Exercise) => draft?.sets[ex.id] ?? []
  const doneOf = (ex: Exercise) => logsOf(ex).filter((l) => l.done).length
  const nextOf = (ex: Exercise) => {
    for (let i = 0; i < setsOf(ex); i++) if (!logsOf(ex)[i]?.done) return i
    return -1
  }
  const total = items.reduce((n, it) => n + setsOf(it.ex), 0)
  const done = draftSetsDone(draft)

  const [idx, setIdx] = useState(() => {
    const i = items.findIndex((it) => doneOf(it.ex) < setsOf(it.ex))
    return i === -1 ? items.length : i
  })
  const idxRef = useRef(idx)
  idxRef.current = idx
  const track = useRef<HTMLDivElement>(null)
  const [sheet, setSheet] = useState<{ kind: 'machine' | 'video'; ex: Exercise } | null>(null)
  const [overview, setOverview] = useState(false)
  const [timer, setTimer] = useState<{ endAt: number; total: number } | null>(null)
  const [hint, setHint] = useState(() => !draft)
  useWakeLock()

  const go = useCallback(
    (i: number, smooth = true) => {
      const el = track.current
      if (!el) return
      const target = Math.max(0, Math.min(items.length, i))
      const rtl = getComputedStyle(el).direction === 'rtl'
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ left: (rtl ? -1 : 1) * target * el.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' })
    },
    [items.length],
  )

  useEffect(() => {
    go(idxRef.current, false)
    const onResize = () => go(idxRef.current, false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [go, lang])

  const onScroll = () => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth)
    if (i !== idxRef.current) {
      idxRef.current = i
      setIdx(i)
      setHint(false)
      haptic(6)
    }
  }

  const shownKg = (ex: Exercise, i: number): number | null =>
    logsOf(ex)[i]?.kg ?? (i > 0 ? shownKg(ex, i - 1) : null) ?? lastKg(sessions, profile, ex.id, i)

  const tick = (it: Item, i: number) => {
    const n = setsOf(it.ex)
    const before = doneOf(it.ex)
    const kgBefore = logsOf(it.ex)[i]?.kg
    const nowDone = toggleSet(dayId, it.ex.id, i, n)
    haptic(nowDone ? 25 : 8)
    if (!nowDone) return
    if (weightOn && kgBefore == null) {
      const kg = shownKg(it.ex, i)
      if (kg != null) setKg(dayId, it.ex.id, i, n, kg)
    }
    const allDone = done + 1 >= total
    if (rest > 0 && !allDone) setTimer({ endAt: Date.now() + rest * 1000, total: rest })
    if (before + 1 >= n) setTimeout(() => go(idxRef.current + 1), 650)
  }

  const finish = () => {
    finishWorkout(dayId, items.map((it) => ({ id: it.ex.id, sets: setsOf(it.ex) })))
    haptic([40, 60, 40])
    setTimer(null)
    location.hash = '#/history'
  }

  // sheets push a history entry; close via back so Android's back button stays in sync
  const closeOverviewThen = (fn?: () => void) => {
    if (history.state?.sheet) history.back()
    else setOverview(false)
    if (fn) setTimeout(fn, 80)
  }

  const cur = items[idx] as Item | undefined
  const curNext = cur ? nextOf(cur.ex) : -1
  const nextLabel = cur
    ? curNext !== -1
      ? t('nextUp', { x: t('setN', { n: curNext + 1 }) })
      : items[idx + 1]
        ? t('nextUp', { x: items[idx + 1].ex.name[lang] })
        : t('summary')
    : ''
  const mins = draft ? Math.max(1, Math.round((Date.now() - draft.startedAt) / 60000)) : 0

  const dots = (ex: Exercise) => (
    <span className="flex flex-none gap-1">
      {Array.from({ length: setsOf(ex) }, (_, s) => (
        <span key={s} className={`h-2.5 w-2.5 rounded-full ${logsOf(ex)[s]?.done ? 'bg-accent' : 'bg-line'}`} />
      ))}
    </span>
  )

  const renderSlide = (it: Item, i: number) => {
    const { ex, group } = it
    const n = setsOf(ex)
    const logs = logsOf(ex)
    const next = nextOf(ex)
    const m = machineOf(ex)
    const badge = n > 1 ? `${num(n, lang)} × ${repsOf(ex)[lang]}` : repsOf(ex)[lang]
    const orange = ex.optional || group.maiOnly
    const last = exerciseLast(sessions, profile, ex.id)
    const target = next === -1 ? n - 1 : next
    const kg = weightOn ? shownKg(ex, target) : null
    return (
      <section
        key={ex.id}
        data-testid="exercise"
        data-ex={ex.id}
        className="no-scrollbar h-full w-full flex-none snap-center snap-always overflow-y-auto overscroll-y-contain px-4 pb-8 pt-1"
      >
        <button
          onClick={() => setSheet({ kind: 'machine', ex })}
          aria-label={t('showMachine')}
          className="relative block w-full overflow-hidden rounded-[28px] border border-line"
        >
          <MachinePhoto ex={ex} className="h-[28dvh] min-h-40 w-full" />
          <span className="absolute start-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur">
            {group.maiOnly ? `♀ ${t('maiExtra')}` : group.name[lang]} · {num(i + 1, lang)}/{num(items.length, lang)}
          </span>
          {m && (
            <span dir="ltr" className="absolute bottom-3 start-3 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              gym80 · {m.model}
            </span>
          )}
        </button>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[1.65rem] font-extrabold leading-tight">{ex.name[lang]}</h2>
            <De speak className="text-sm">{ex.de}</De>
          </div>
          <span
            className={`mt-1 flex-none whitespace-nowrap rounded-full px-3 py-1 text-sm font-extrabold ${
              orange ? 'bg-warn text-onwarn' : 'bg-soft text-accentink'
            }`}
          >
            {badge}
          </span>
        </div>

        {group.maiOnly && it.first && group.note && (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-warn p-3 text-[.92rem] text-muted">
            <Rich text={group.note[lang]} />
          </p>
        )}
        {ex.note && (
          <p className="mt-3 rounded-2xl bg-surface2 p-3 text-[.95rem] leading-relaxed text-muted">
            <Rich text={ex.note[lang]} />
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            data-testid="btn-video"
            onClick={() => setSheet({ kind: 'video', ex })}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-ytsoft px-2 font-bold text-yt active:scale-[.98]"
          >
            <Icon name="play" className="h-5 w-5" /> {t('showVideo')}
          </button>
          <button
            data-testid="btn-machine"
            onClick={() => setSheet({ kind: 'machine', ex })}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-surface2 px-2 font-bold active:scale-[.98]"
          >
            <Icon name="sliders" className="h-5 w-5" /> {t('showMachine')}
          </button>
        </div>

        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Icon name="clock" className="h-4 w-4 flex-none" />
          {last
            ? [
                t('lastTime', { d: new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short' }).format(last.at) }),
                t('setsDone', { a: last.done, b: last.total }),
                last.kg != null ? `${num(last.kg, lang)} ${t('kg')}` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : t('firstTime')}
        </p>

        <div className="mt-6 flex justify-center gap-4">
          {Array.from({ length: n }, (_, s) => {
            const d = logs[s]?.done ?? false
            const isNext = s === next
            const setKgVal = logs[s]?.kg
            return (
              <div key={s} className="flex flex-col items-center gap-1">
                <button
                  data-testid="set"
                  aria-pressed={d}
                  aria-label={n > 1 ? t('setN', { n: s + 1 }) : t('done')}
                  onClick={() => tick(it, s)}
                  className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] text-2xl font-extrabold transition-all active:scale-90 ${
                    d ? 'pop border-accent bg-accent text-onaccent' : isNext ? 'border-accent text-accentink' : 'border-line text-muted'
                  }`}
                >
                  {d ? <Icon name="check" className="h-8 w-8" /> : num(s + 1, lang)}
                </button>
                <span className="h-5 text-xs font-bold text-muted">
                  {weightOn && setKgVal != null ? `${num(setKgVal, lang)} ${t('kg')}` : n > 1 ? t('setN', { n: s + 1 }) : ''}
                </span>
              </div>
            )
          })}
        </div>

        {weightOn && n > 1 && (
          <div className="mt-4 flex items-center gap-2 rounded-3xl bg-surface2 p-2">
            <button
              aria-label="−2.5"
              onClick={() => {
                haptic()
                setKg(dayId, ex.id, target, n, Math.max(0, (kg ?? 0) - 2.5))
              }}
              className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-surface"
            >
              <Icon name="minus" />
            </button>
            <label className="flex min-w-0 flex-1 flex-col items-center">
              <span className="text-xs font-bold text-muted">
                {t('weight')} · {t('setN', { n: target + 1 })}
              </span>
              <span className="flex items-baseline gap-1" dir="ltr">
                <input
                  data-testid="kg"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={logs[target]?.kg ?? ''}
                  placeholder={kg != null ? String(kg) : '–'}
                  onChange={(e) => setKg(dayId, ex.id, target, n, e.target.value === '' ? null : Number(e.target.value))}
                  className="h-10 w-24 bg-transparent text-center text-3xl font-extrabold text-ink outline-none placeholder:text-muted"
                />
                <span className="text-sm font-bold text-muted">kg</span>
              </span>
            </label>
            <button
              aria-label="+2.5"
              onClick={() => {
                haptic()
                setKg(dayId, ex.id, target, n, (kg ?? 0) + 2.5)
              }}
              className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-surface"
            >
              <Icon name="plus" />
            </button>
          </div>
        )}
      </section>
    )
  }

  const primaryCls =
    'flex h-16 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-lg font-extrabold transition-transform active:scale-[.98]'
  let primary
  if (!cur) {
    primary = (
      <button data-testid="finish" disabled={done === 0} onClick={finish} className={`${primaryCls} bg-accent text-onaccent disabled:opacity-40`}>
        <Icon name="trophy" /> {t('finishWorkout')}
      </button>
    )
  } else if (curNext === -1) {
    primary = (
      <button onClick={() => go(idx + 1)} className={`${primaryCls} bg-surface2 text-ink`}>
        {idx + 1 < items.length ? t('nextExercise') : t('toSummary')}
        <Icon name="chevron" className="h-6 w-6 rtl:rotate-180" />
      </button>
    )
  } else {
    const n = setsOf(cur.ex)
    primary = (
      <button data-testid="cta" onClick={() => tick(cur, curNext)} className={`${primaryCls} bg-accent text-onaccent shadow-lg`}>
        <Icon name="check" /> {n > 1 ? t('completeSet', { a: curNext + 1, b: n }) : t('completeOnce')}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      <header className="flex-none px-3 pt-[max(.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <a href="#/" aria-label={t('exit')} className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-surface2">
            <Icon name="x" className="h-5 w-5" />
          </a>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-base font-extrabold">{day.short[lang]}</div>
            <div data-testid="progress" className="text-xs font-bold text-muted">
              {cur ? t('exerciseOf', { a: idx + 1, b: items.length }) : t('summary')} · {t('setsDone', { a: done, b: total })}
            </div>
          </div>
          <button
            data-testid="overview"
            onClick={() => {
              haptic()
              setOverview(true)
            }}
            aria-label={t('overview')}
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-surface2"
          >
            <Icon name="list" className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {items.map((it, i) => {
            const f = doneOf(it.ex) / setsOf(it.ex)
            return (
              <span
                key={it.ex.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${f >= 1 ? 'bg-accent' : f > 0 ? 'bg-accent/45' : 'bg-line'} ${
                  i === idx ? 'outline-2 outline-offset-1 outline-accent' : ''
                }`}
              />
            )
          })}
        </div>
        {hint && (
          <p className="mt-2 flex items-center justify-center gap-2 text-xs font-bold text-muted">
            <span aria-hidden>↔</span> {t('swipeHint')}
          </p>
        )}
      </header>

      <div
        ref={track}
        data-testid="track"
        onScroll={onScroll}
        className="no-scrollbar mt-2 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {items.map(renderSlide)}
        <section data-testid="summary" className="no-scrollbar h-full w-full flex-none snap-center snap-always overflow-y-auto px-4 pb-8 pt-4">
          <div className="flex flex-col items-center text-center">
            <Ring value={total ? done / total : 0} size={168} stroke={12}>
              <span className="text-4xl font-extrabold">{num(done, lang)}</span>
              <span className="mt-1 text-sm font-bold text-muted">/ {t('setsN', { n: total })}</span>
            </Ring>
            <h2 className="mt-4 text-2xl font-extrabold">{t('summary')}</h2>
            <p className="text-muted">
              {day.title[lang]}
              {mins ? ` · ${t('minutes', { n: mins })}` : ''}
            </p>
            {done === 0 && <p className="mt-2 text-sm font-bold text-warn">{t('finishHint')}</p>}
          </div>
          <ul className="mt-5 space-y-2">
            {items.map((it, i) => (
              <li key={it.ex.id}>
                <button onClick={() => go(i)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-start">
                  <span className="min-w-0 flex-1 truncate font-bold">{it.ex.name[lang]}</span>
                  {dots(it.ex)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="relative flex-none border-t border-line bg-surface px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
        {timer && (
          <RestTimer
            key={timer.total + ':' + Math.round(timer.endAt / 1e5)}
            endAt={timer.endAt}
            total={timer.total}
            next={nextLabel}
            onAdjust={(s) =>
              setTimer((tm) => {
                if (!tm) return tm
                const endAt = Math.max(Date.now() + 1000, tm.endAt + s * 1000)
                return { endAt, total: Math.max(tm.total, Math.ceil((endAt - Date.now()) / 1000)) }
              })
            }
            onDone={() => setTimer(null)}
          />
        )}
        <div className="flex gap-2">
          <button
            aria-label={t('prev')}
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-surface2 disabled:opacity-30"
          >
            <Icon name="chevron" className="h-7 w-7 ltr:rotate-180" />
          </button>
          {primary}
        </div>
      </footer>

      {sheet?.kind === 'machine' && <MachineSheet ex={sheet.ex} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'video' && <VideoSheet ex={sheet.ex} onClose={() => setSheet(null)} />}
      {overview && (
        <Sheet title={day.title[lang]} sub={<De className="text-sm">{day.de}</De>} onClose={() => setOverview(false)}>
          <div className="grid grid-cols-3 gap-2">
            {DAY_IDS.map((d, i) => (
              <button
                key={d}
                data-testid={`tab-${d}`}
                onClick={() => d !== dayId && closeOverviewThen(() => (location.hash = `#/workout/${d}`))}
                className={`min-h-12 rounded-2xl font-bold ${d === dayId ? 'bg-accent text-onaccent' : 'bg-surface2'}`}
              >
                {t('day')} {num(i + 1, lang)}
              </button>
            ))}
          </div>
          <div className="mb-1 mt-4 text-xs font-bold text-muted">{t('restTimer')}</div>
          <Segmented
            value={rest}
            onChange={(v) => updateSettings({ rest: v })}
            options={[
              { value: 0, label: t('off') },
              { value: 60, label: `${num(60, lang)} ${t('sec')}` },
              { value: 90, label: `${num(90, lang)} ${t('sec')}` },
            ]}
          />
          <ul className="mt-4 space-y-1.5">
            {items.map((it, i) => (
              <li key={it.ex.id}>
                {it.first && (
                  <div className={`mb-1 mt-3 px-1 text-xs font-bold ${it.group.maiOnly ? 'text-warn' : 'text-muted'}`}>
                    {it.group.name[lang]}
                  </div>
                )}
                <button
                  onClick={() => closeOverviewThen(() => go(i, false))}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-start ${
                    i === idx ? 'bg-soft ring-2 ring-accent' : 'bg-surface2'
                  }`}
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface text-sm font-extrabold">
                    {num(i + 1, lang)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">{it.ex.name[lang]}</span>
                  {dots(it.ex)}
                </button>
              </li>
            ))}
          </ul>
          {done > 0 && (
            <button
              onClick={() => closeOverviewThen(() => clearDraft(dayId))}
              className="mt-4 min-h-12 w-full rounded-2xl border border-line text-sm font-bold text-muted"
            >
              {t('clearTicks')}
            </button>
          )}
        </Sheet>
      )}
    </div>
  )
}
