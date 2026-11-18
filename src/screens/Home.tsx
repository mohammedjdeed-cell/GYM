import { useState } from 'react'
import { DAY_IDS, PROFILES, exercisesFor, getDay, machineOf, plan, setsOf, type Exercise } from '../data/plan'
import { locale, num } from '../i18n'
import {
  dateKey,
  draftKey,
  draftSetsDone,
  sessionsOf,
  suggestedDay,
  thisWeek,
  useStore,
  useT,
  visitDates,
  doneList,
  weekStart,
  weekStreak,
} from '../store'
import { addDays, attendance, weekOf } from '../schedule'
import { machinePhotoUrl } from '../components/ExerciseSheets'
import { HeaderButtons } from '../components/HeaderButtons'
import { CalendarChip } from '../components/CalendarChip'
import { Card, De, Icon, haptic } from '../components/ui'

function Thumb({ ex }: { ex: Exercise }) {
  const m = machineOf(ex)
  const [broken, setBroken] = useState(false)
  return (
    <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl border border-line bg-photo">
      {m && !broken ? (
        <img src={machinePhotoUrl(m.photo)} alt="" className="h-full w-full object-contain p-1" onError={() => setBroken(true)} />
      ) : (
        <Icon name="dumbbell" className="h-7 w-7 text-muted" />
      )}
    </div>
  )
}

export function Home() {
  const { settings, sessions, drafts, schedule } = useStore()
  const t = useT()
  const { lang, profile } = settings
  const now = new Date()
  const wk = weekOf(dateKey(now))
  const { slots } = attendance(schedule[profile], visitDates(sessions, profile), wk, addDays(wk, 6), dateKey(now), doneList(sessions, profile))

  const week = thisWeek(sessions, profile, now)
  const doneDays = new Set(week.map((s) => s.dayId))
  const doneDates = new Set(week.map((s) => s.date))
  const weekCount = Math.min(3, doneDays.size)
  const inProgress = DAY_IDS.find((d) => draftSetsDone(drafts[draftKey(profile, d)]) > 0)
  const dayId = inProgress ?? suggestedDay(sessions, profile, schedule[profile], now)
  const day = getDay(dayId)
  const exs = exercisesFor(day, profile)
  const totalSets = exs.reduce((n, e) => n + setsOf(e), 0)
  const draftDone = draftSetsDone(drafts[draftKey(profile, dayId)])
  const minutes = Math.round(((totalSets * (45 + (settings.rest || 60))) / 60 + 8) / 5) * 5
  const withMachine = [...new Map(exs.filter((e) => e.machine).map((e) => [e.machine!, e])).values()]
  const thumbs = withMachine.slice(0, 4)

  const ws = weekStart(now)
  const wdNarrow = new Intl.DateTimeFormat(locale(lang), { weekday: 'narrow' })
  const wdLong = new Intl.DateTimeFormat(locale(lang), { weekday: 'long' })

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold">{t('hello', { name: PROFILES[profile][lang] })}</h1>
          <p className="text-sm text-muted">{t('appSub')}</p>
        </div>
        <HeaderButtons />
      </header>

      <CalendarChip />

      <section className="mt-4 overflow-hidden rounded-[32px] border border-line bg-linear-to-b from-hero to-surface p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-accentink">
          <span className={`h-2.5 w-2.5 rounded-full bg-accent ${inProgress ? 'pulse' : ''}`} />
          {inProgress ? t('inProgress') : t('todaySuggested')} ·{' '}
          {new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
        </div>
        <h2 data-testid="suggested-day" className="mt-2 text-[1.75rem] font-extrabold leading-tight">
          {day.title[lang]}
        </h2>
        <De className="text-sm">{day.de}</De>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
          {[t('exercisesN', { n: exs.length }), t('setsN', { n: totalSets }), t('approxMin', { n: minutes })].map((c) => (
            <span key={c} className="rounded-full bg-surface/80 px-3 py-1">
              {c}
            </span>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          {thumbs.map((e) => (
            <Thumb key={e.id} ex={e} />
          ))}
          {withMachine.length > thumbs.length && (
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-surface/80 font-extrabold text-muted" dir="ltr">
              +{num(withMachine.length - thumbs.length, lang)}
            </div>
          )}
        </div>
        <a
          href={`#/workout/${dayId}`}
          data-testid="start-workout"
          onClick={() => haptic(20)}
          className="mt-5 flex h-16 items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-extrabold text-onaccent shadow-lg active:scale-[.98]"
        >
          <Icon name="play" className="h-5 w-5" />
          {inProgress ? t('continueWorkout') : t('startWorkout')}
        </a>
        {draftDone > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(draftDone / totalSets) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-muted">{t('setsDone', { a: draftDone, b: totalSets })}</span>
          </div>
        )}
      </section>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold">{t('weekTitle')}</h3>
          <span data-testid="week-count" className="text-sm font-bold text-muted">
            {t('sessionsOf', { a: weekCount, b: 3 })}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(ws)
            d.setDate(ws.getDate() + i)
            const key = dateKey(d)
            const slot = slots.find((x) => x.date === key && x.status !== 'skipped')
            const planned = slot ? DAY_IDS.indexOf(slot.dayId) : -1
            const trained = doneDates.has(key)
            const missed = slot?.status === 'missed'
            const today = key === dateKey(now)
            return (
              <a key={key} href="#/week" data-testid={`strip-${key}`}>
                <div className="text-xs font-bold text-muted">{wdNarrow.format(d)}</div>
                <div
                  className={`mx-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold ${
                    trained
                      ? 'bg-accent text-onaccent'
                      : missed
                        ? 'bg-miss text-white'
                        : today
                          ? 'border-2 border-accent text-accentink'
                          : planned >= 0
                            ? 'border-2 border-dashed border-accent/60'
                            : 'text-muted'
                  }`}
                >
                  {trained ? <Icon name="check" className="h-5 w-5" /> : missed ? <Icon name="x" className="h-5 w-5" /> : num(d.getDate(), lang)}
                </div>
                <div className="mt-0.5 h-4 text-[10px] font-extrabold text-accentink">
                  {planned >= 0 ? `${t('day')} ${num(planned + 1, lang)}` : ''}
                </div>
              </a>
            )
          })}
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-soft text-accentink">
            <Icon name="flame" />
          </span>
          <div>
            <div className="text-2xl font-extrabold leading-none">{num(weekStreak(sessions, profile, now), lang)}</div>
            <div className="text-xs font-bold text-muted">{t('streak')}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-soft text-accentink">
            <Icon name="trophy" />
          </span>
          <div>
            <div className="text-2xl font-extrabold leading-none">{num(sessionsOf(sessions, profile).length, lang)}</div>
            <div className="text-xs font-bold text-muted">{t('totalSessions')}</div>
          </div>
        </Card>
      </div>

      <h3 className="mb-2 mt-6 px-1 font-extrabold">{t('trainingDays')}</h3>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2">
        {plan.days.map((d, i) => {
          const isDone = doneDays.has(d.id)
          return (
            <a
              key={d.id}
              href={`#/workout/${d.id}`}
              data-testid={`day-card-${d.id}`}
              className={`w-[78%] flex-none snap-start rounded-3xl border p-4 active:scale-[.98] ${
                d.id === dayId ? 'border-accent bg-soft' : 'border-line bg-surface'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-extrabold text-onaccent">
                  {t('day')} {num(i + 1, lang)}
                </span>
                {isDone && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-onaccent">
                    <Icon name="check" className="h-4 w-4" />
                  </span>
                )}
              </div>
              <div className="mt-2 text-lg font-extrabold">{d.short[lang]}</div>
              <De className="text-xs">{d.de}</De>
              <div className="mt-1 text-sm text-muted">
                {t('exercisesN', { n: exercisesFor(d, profile).length })} · {wdLong.format(new Date(2024, 0, d.weekday))}
              </div>
            </a>
          )
        })}
      </div>
    </>
  )
}
