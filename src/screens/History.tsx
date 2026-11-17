import { useState } from 'react'
import { PROFILES, getDay, type ProfileKey } from '../data/plan'
import { locale, num } from '../i18n'
import { deleteSession, euro, longDate, partnerOf, sessionsOf, useStore, useT, visitDates, weekStreak } from '../store'
import { attendance, dateKey, monthMoney } from '../schedule'
import { Card } from '../components/ui'

function MoneyRow({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-surface2 px-2 py-3 text-center">
      <div className={`text-xl font-extrabold leading-tight ${cls}`}>{value}</div>
      <div className="text-xs font-bold text-muted">{label}</div>
    </div>
  )
}

export function History() {
  const { settings, sessions, schedule } = useStore()
  const t = useT()
  const { lang, profile } = settings
  const mine = sessionsOf(sessions, profile)
  const sched = schedule[profile]

  const today = new Date()
  const todayK = dateKey(today)
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const loc = locale(lang)
  const offset = (month.getDay() + 6) % 7 // weeks start on Monday
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const wd = new Intl.DateTimeFormat(loc, { weekday: 'narrow' })
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  const from = dateKey(month)
  const to = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const visits = new Set(visitDates(sessions, profile))
  const { slots } = attendance(sched, [...visits], from, to, todayK)
  const slotOn = new Map(slots.filter((x) => x.status !== 'covered').map((x) => [x.date, x]))
  const money = (p: ProfileKey) => monthMoney(schedule[p], visitDates(sessions, p), month.getFullYear(), month.getMonth(), todayK)
  const m = money(profile)
  const partner = partnerOf(profile)
  const pm = money(partner)

  // lifetime (since joining) for this person
  let lifeUsed = 0
  let lifeLost = 0
  if (sched.since <= todayK) {
    const start = new Date(+sched.since.slice(0, 4), +sched.since.slice(5, 7) - 1, 1)
    for (let d = start; d <= today; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const x = monthMoney(sched, [...visits], d.getFullYear(), d.getMonth(), todayK)
      lifeUsed += x.used
      lifeLost += x.lost
    }
  }

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

      <Card className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => shift(-1)} aria-label="previous month" className="h-12 w-12 rounded-full bg-surface2 text-xl font-bold rtl:rotate-180">‹</button>
          <b>{new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(month)}</b>
          <button onClick={() => shift(1)} aria-label="next month" className="h-12 w-12 rounded-full bg-surface2 text-xl font-bold rtl:rotate-180">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm" data-testid="month-grid">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={`h${i}`} className="py-1 text-xs font-bold text-muted">{wd.format(new Date(2024, 0, 1 + i))}</div>
          ))}
          {Array.from({ length: offset }, (_, i) => <div key={`o${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const k = dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1))
            const slot = slotOn.get(k)
            const went = visits.has(k)
            const missed = !went && (slot?.status === 'missed' || (slot?.status === 'skipped' && k < todayK))
            const planned = !went && !missed && slot && slot.status !== 'skipped'
            return (
              <div
                key={k}
                data-day={k}
                data-mark={went ? 'went' : missed ? 'missed' : planned ? 'planned' : ''}
                className={`flex aspect-square items-center justify-center rounded-full font-semibold ${
                  went
                    ? 'bg-accent text-onaccent'
                    : missed
                      ? 'bg-miss text-white'
                      : planned
                        ? 'border-2 border-dashed border-accent/70'
                        : k === todayK
                          ? 'border-2 border-line'
                          : ''
                }`}
              >
                {num(i + 1, lang)}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-bold text-muted">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-accent" />{t('legendWent')}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-miss" />{t('legendMissed')}</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full border-2 border-dashed border-accent" />{t('legendPlanned')}</span>
        </div>
      </Card>

      {m.active && (
        <Card className="mb-3" >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{t('moneyTitle')}</h2>
            <span className="text-xs font-bold text-muted">{t('perSession', { m: euro(m.per, lang) })}</span>
          </div>
          <div className="mt-2 flex gap-2" data-testid="money">
            <MoneyRow label={t('moneyUsed')} value={euro(m.used, lang)} cls="text-good" />
            <MoneyRow label={t('moneyLost')} value={euro(m.lost, lang)} cls="text-miss" />
            {m.ahead > 0 && <MoneyRow label={t('moneyAhead')} value={euro(m.ahead * m.per, lang)} cls="text-ink" />}
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted">{t('perVisit')}</span>
            <b>{m.perVisit != null ? euro(m.perVisit, lang) : '—'}</b>
          </div>
          {pm.active && (
            <div className="mt-2 border-t border-line pt-2 text-sm" data-testid="together">
              <div className="mb-1 font-bold">{t('together')}</div>
              {([profile, partner] as ProfileKey[]).map((p) => {
                const x = p === profile ? m : pm
                return (
                  <div key={p} className="flex justify-between">
                    <span className="text-muted">{PROFILES[p][lang]}</span>
                    <span>
                      <b className="text-good">{euro(x.used, lang)}</b> · <b className="text-miss">−{euro(x.lost, lang)}</b>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
            <span className="text-muted">{t('sinceStart', { d: longDate(sched.since, lang) })}</span>
            <span>
              <b className="text-good">{euro(lifeUsed, lang)}</b> · <b className="text-miss">−{euro(lifeLost, lang)}</b>
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">{t('moneyHint', { p: euro(sched.price, lang) })}</p>
        </Card>
      )}

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
