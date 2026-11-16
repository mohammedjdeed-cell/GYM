import { useState } from 'react'
import { getDay } from '../data/plan'
import { locale, num } from '../i18n'
import { dateKey, deleteSession, sessionsOf, useStore, useT, weekStreak } from '../store'
import { Card } from '../components/ui'

export function History() {
  const { settings, sessions } = useStore()
  const t = useT()
  const { lang, profile } = settings
  const mine = sessionsOf(sessions, profile)
  const byDate = new Set(mine.map((s) => s.date))

  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const loc = locale(lang)
  const offset = (month.getDay() + 6) % 7 // weeks start on Monday
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const wd = new Intl.DateTimeFormat(loc, { weekday: 'narrow' })
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-3xl font-extrabold text-accentink" data-testid="streak">🔥 {num(weekStreak(sessions, profile), lang)}</div>
          <div className="text-sm font-semibold text-muted">{t('streak')}</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-extrabold text-accentink">{num(mine.length, lang)}</div>
          <div className="text-sm font-semibold text-muted">{t('totalSessions')}</div>
        </Card>
      </div>
      <p className="mb-3 px-1 text-xs text-muted">{t('streakHint')}</p>

      <Card className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => shift(-1)} aria-label="previous month" className="h-12 w-12 rounded-full bg-surface2 text-xl font-bold rtl:rotate-180">‹</button>
          <b>{new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(month)}</b>
          <button onClick={() => shift(1)} aria-label="next month" className="h-12 w-12 rounded-full bg-surface2 text-xl font-bold rtl:rotate-180">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={`h${i}`} className="py-1 text-xs font-bold text-muted">{wd.format(new Date(2024, 0, 1 + i))}</div>
          ))}
          {Array.from({ length: offset }, (_, i) => <div key={`o${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(month.getFullYear(), month.getMonth(), i + 1)
            const k = dateKey(d)
            const trained = byDate.has(k)
            const isToday = k === dateKey(today)
            return (
              <div
                key={k}
                className={`flex aspect-square items-center justify-center rounded-full font-semibold ${
                  trained ? 'bg-accent text-onaccent' : isToday ? 'border-2 border-accent' : ''
                }`}
              >
                {num(i + 1, lang)}
              </div>
            )
          })}
        </div>
      </Card>

      {mine.length === 0 && <p className="py-6 text-center text-muted">{t('noSessions')}</p>}
      {mine.map((s) => {
        const mins = Math.max(1, Math.round((s.finishedAt - s.startedAt) / 60000))
        return (
          <Card key={s.id} className="mb-2 flex items-center gap-3 !py-3">
            <div className="min-w-0 flex-1" data-testid="session">
              <div className="font-bold">{getDay(s.dayId).title[lang]}</div>
              <div className="text-sm text-muted">
                {new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s.finishedAt))}
                {' · '}
                {t('setsDone', { a: s.setsDone, b: s.setsTotal })}
                {' · '}
                {t('minutes', { n: mins })}
                {s.dirty && settings.household ? ' · ⟳' : ''}
              </div>
            </div>
            <button
              onClick={() => confirm(t('confirmDelete')) && deleteSession(s.id)}
              aria-label={t('delete')}
              className="h-12 w-12 flex-none rounded-full bg-surface2 text-lg text-muted"
            >
              🗑
            </button>
          </Card>
        )
      })}
    </>
  )
}
