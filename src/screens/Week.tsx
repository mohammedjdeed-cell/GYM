import { useState } from 'react'
import { DAY_IDS, PROFILES, getDay } from '../data/plan'
import { locale, num } from '../i18n'
import type { TKey } from '../i18n'
import { connectCalendar, doneList, euro, longDate, moveSession, partnerOf, useStore, useT, visitDates } from '../store'
import {
  addDays,
  attendance,
  dateKey,
  monthMoney,
  parseKey,
  weekOf,
  weekSlots,
  type SlotInfo,
  type SlotStatus,
} from '../schedule'
import { Sheet } from '../components/Sheet'
import { CalendarChip } from '../components/CalendarChip'
import { Card, De, Rich, Toggle, haptic } from '../components/ui'

const VOCAB: { ar: string; en: string; de: string }[] = [
  { ar: 'جولة / عدة', en: 'Set / rep', de: 'Satz / Wiederholung' },
  { ar: 'الوزن', en: 'The weight', de: 'das Gewicht' },
  { ar: 'الجهاز', en: 'The machine', de: 'das Gerät' },
  { ar: 'الحبل / الكيبل', en: 'The cable', de: 'der Kabelzug' },
  { ar: 'المقعد', en: 'The bench', de: 'die Bank' },
  { ar: 'الراسية / المسكة', en: 'The handle', de: 'der Griff' },
  {
    ar: 'لسا عم تستعمل الجهاز؟',
    en: 'Are you still using the machine?',
    de: 'Brauchst du das Gerät noch?',
  },
  {
    ar: 'فيني اتبادل معك؟',
    en: 'Can I work in with you?',
    de: 'Kann ich mich abwechseln?',
  },
]
const RULES: TKey[] = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5']
const COACH: TKey[] = ['coach1', 'coach2', 'coach3', 'coach4', 'coach5', 'coach6']

const STATUS: Record<SlotStatus, { key: TKey; cls: string }> = {
  done: { key: 'stDone', cls: 'bg-accent text-onaccent' },
  covered: { key: 'stCovered', cls: 'bg-surface2 text-ink' },
  missed: { key: 'stMissed', cls: 'bg-miss text-white' },
  skipped: { key: 'stSkipped', cls: 'bg-surface2 text-muted line-through' },
  today: { key: 'stToday', cls: 'border-2 border-accent text-accentink' },
  upcoming: {
    key: 'stUpcoming',
    cls: 'border border-dashed border-line text-muted',
  },
}

function MoveSheet({ slot, onClose }: { slot: SlotInfo; onClose: () => void }) {
  const { settings, schedule } = useStore()
  const t = useT()
  const { lang, profile } = settings
  const partner = partnerOf(profile)
  const [both, setBoth] = useState(true)
  const today = dateKey(new Date())
  const wk = weekOf(slot.orig)
  const taken = new Set(
    weekSlots(schedule[profile], wk)
      .filter((x) => x.orig !== slot.orig && !x.skipped)
      .map((x) => x.date),
  )
  const wd = new Intl.DateTimeFormat(locale(lang), { weekday: 'short' })
  const day = getDay(slot.dayId)
  const done = (to: string | 'off' | null) => {
    haptic(15)
    moveSession(slot.orig, to, both)
    // straight from the tap: update Google Calendar now (asks Google once if the hourly permission ran out)
    if (settings.calendar) void connectCalendar()
    onClose()
  }
  return (
    <Sheet
      title={t('moveTitle', { x: day.short[lang] })}
      sub={<p className="text-sm text-muted">{longDate(slot.date, lang)}</p>}
      onClose={onClose}
    >
      <p className="mb-2 text-sm font-semibold text-muted">{t('moveTo')}</p>
      <div className="grid grid-cols-7 gap-1.5" data-testid="move-days">
        {Array.from({ length: 7 }, (_, i) => {
          const k = addDays(wk, i)
          const on = k === slot.date && !slot.skipped
          const off = k < today || taken.has(k)
          return (
            <button
              key={k}
              data-testid={`move-${k}`}
              disabled={off}
              onClick={() => done(k)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl text-sm font-extrabold disabled:opacity-30 ${
                on ? 'bg-accent text-onaccent' : 'bg-surface2'
              }`}
            >
              <span className="text-[11px] font-bold">{wd.format(parseKey(k))}</span>
              {num(parseKey(k).getDate(), lang)}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface2 px-3">
        <span className="text-sm font-bold">{t('alsoPartner', { n: PROFILES[partner][lang] })}</span>
        <Toggle on={both} onChange={setBoth} label={t('alsoPartner', { n: PROFILES[partner][lang] })} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button data-testid="move-skip" onClick={() => done('off')} className="min-h-14 rounded-2xl border border-line font-bold">
          {t('skipOnce')}
        </button>
        <button
          data-testid="move-reset"
          disabled={!slot.moved && !slot.skipped}
          onClick={() => done(null)}
          className="min-h-14 rounded-2xl border border-line font-bold disabled:opacity-30"
        >
          {t('backToPlan')}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">{t('scheduleHint2')}</p>
    </Sheet>
  )
}

function Agenda() {
  const { settings, sessions, schedule } = useStore()
  const t = useT()
  const { lang, profile } = settings
  const [moving, setMoving] = useState<SlotInfo | null>(null)
  const today = dateKey(new Date())
  const wk = weekOf(today)
  const sched = schedule[profile]
  const { slots } = attendance(
    sched,
    visitDates(sessions, profile),
    addDays(wk, -7),
    addDays(wk, 13),
    today,
    doneList(sessions, profile),
  )
  const perOf = (k: string) => {
    const d = parseKey(k)
    return monthMoney(sched, visitDates(sessions, profile), d.getFullYear(), d.getMonth(), today).per
  }
  const weeks: [TKey, string][] = [
    ['lastWeek', addDays(wk, -7)],
    ['thisWeekT', wk],
    ['nextWeek', addDays(wk, 7)],
  ]
  return (
    <>
      <div className="mb-3 empty:hidden">
        <CalendarChip />
      </div>
      <Card className="mb-3">
        <h2 className="text-lg font-bold">{t('yourSessions')}</h2>
        <p className="mb-1 text-xs text-muted">{t('scheduleHint2')}</p>
        {weeks.map(([label, start]) => {
          const rows = slots.filter((x) => weekOf(x.orig) === start)
          if (!rows.length) return null
          return (
            <div key={start} className="mt-3">
              <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t(label)}</h3>
              {rows.map((x) => {
                const day = getDay(x.dayId)
                const st = STATUS[x.status]
                const canMove = weekOf(x.orig) >= wk && x.status !== 'done' && addDays(weekOf(x.orig), 6) >= today
                return (
                  <div
                    key={x.orig}
                    data-testid={`slot-${x.orig}`}
                    data-status={x.status}
                    className="flex items-center gap-3 border-b border-line py-2 last:border-0"
                  >
                    <a href={`#/workout/${x.dayId}`} className="min-w-0 flex-1">
                      <div className="font-bold">{longDate(x.date, lang)}</div>
                      <div className="truncate text-sm text-muted">
                        {t('day')} {num(DAY_IDS.indexOf(x.dayId) + 1, lang)} · {day.short[lang]}
                      </div>
                      {x.moved && (
                        <div className="text-xs font-bold text-accentink">{t('movedFrom', { d: longDate(x.orig, lang) })}</div>
                      )}
                      {x.status === 'missed' || x.status === 'skipped' ? (
                        <div className="text-xs font-bold text-miss">−{euro(perOf(x.date), lang)}</div>
                      ) : x.status === 'done' || x.status === 'covered' ? (
                        <div className="text-xs font-bold text-good">+{euro(perOf(x.date), lang)}</div>
                      ) : null}
                    </a>
                    <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-extrabold ${st.cls}`}>{t(st.key)}</span>
                    {canMove && (
                      <button
                        data-testid={`move-btn-${x.orig}`}
                        onClick={() => {
                          haptic()
                          setMoving(x)
                        }}
                        className="min-h-12 flex-none rounded-xl bg-surface2 px-3 text-sm font-bold"
                      >
                        {t('move')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
        {moving && <MoveSheet slot={moving} onClose={() => setMoving(null)} />}
      </Card>
    </>
  )
}

export function Week() {
  const lang = useStore().settings.lang
  const t = useT()

  return (
    <>
      <Agenda />

      <Card className="mb-3">
        <h2 className="mb-2 text-lg font-bold">{t('rulesTitle')}</h2>
        <ul className="list-disc space-y-1.5 ps-5 text-[.95rem] text-muted">
          {RULES.map((k) => (
            <li key={k}>
              <Rich text={t(k)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-3">
        <h2 className="mb-2 text-lg font-bold text-accentink">{t('coachTitle')}</h2>
        <ul className="list-disc space-y-1.5 ps-5 text-[.95rem] text-muted" data-testid="coach-rules">
          {COACH.map((k) => (
            <li key={k}>
              <Rich text={t(k)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-bold">{t('vocabTitle')}</h2>
        <table className="w-full border-collapse text-[.92rem]">
          <tbody>
            {VOCAB.map((v) => (
              <tr key={v.de} className="border-b border-line last:border-0">
                <td className="py-2 pe-2">{v[lang]}</td>
                <td className="py-2">
                  <De>{v.de}</De>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
