// The training calendar: the default plan (Day 1 Mon, Day 2 Wed, Day 3 Fri) plus per-person
// moves ("this Thursday's session happens on Monday instead"), attendance and money.
import { DAY_IDS, plan, type DayId } from './data/plan'

export interface Sched {
  /** original planned date → new date in the same week, or 'off' for a skipped session */
  moves: Record<string, string>
  /** membership start: planned sessions before this date are not counted */
  since: string
  /** monthly fee in euros */
  price: number
  updatedAt: number
}

export interface Slot {
  /** the date in the default plan – stable identity of this session (also the calendar event id) */
  orig: string
  /** the date it actually happens on (after a move) */
  date: string
  dayId: DayId
  moved: boolean
  /** skipped on purpose this week – still paid for, so it counts as lost unless made up */
  skipped: boolean
}

export type SlotStatus = 'done' | 'covered' | 'missed' | 'skipped' | 'today' | 'upcoming'
export interface SlotInfo extends Slot {
  status: SlotStatus
  /** for 'covered': the unplanned day that made up for it */
  coveredBy?: string
}

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (k: string, n: number) => {
  const d = parseKey(k)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}
/** Monday of the week containing the date key */
export const weekOf = (k: string) => {
  const d = parseKey(k)
  return addDays(k, -((d.getDay() + 6) % 7))
}

/** Planned sessions of one week (Monday key), after moves. */
export function weekSlots(s: Sched, monday: string): Slot[] {
  const out: Slot[] = []
  for (const day of plan.days) {
    const orig = addDays(monday, (day.weekday + 6) % 7)
    if (orig < s.since) continue
    const m = s.moves[orig]
    const skipped = m === 'off'
    out.push({
      orig,
      date: skipped || !m ? orig : m,
      dayId: day.id,
      moved: !skipped && !!m && m !== orig,
      skipped,
    })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** A finished workout: which plan day was trained on which date (oldest first). */
export interface Done {
  date: string
  dayId: DayId
}

/** The plan day after `d` (Day 3 → Day 1); Day 1 when nothing was trained yet. */
export const nextDay = (d?: DayId): DayId => (d ? DAY_IDS[(DAY_IDS.indexOf(d) + 1) % DAY_IDS.length] : DAY_IDS[0])

/** The workout that is due: the one after the last workout done on or before `upTo`. */
export function nextDue(done: Done[], upTo: string): DayId {
  let last: DayId | undefined
  for (const d of done) if (d.date <= upTo) last = d.dayId
  return nextDay(last)
}

/**
 * Attendance for every week touching [from, to]. A planned session counts as done when there is a
 * workout that day; a missed one is still "covered" if an unplanned workout in the same week made
 * up for it. Workouts left over are extras.
 */
export function attendance(s: Sched, visitDates: string[], from: string, to: string, today: string, done: Done[] = []) {
  const visits = new Set(visitDates)
  const slots: SlotInfo[] = []
  const extras: string[] = []
  // start no later than this week, so the workout order of future sessions is always counted from today
  for (let wk = weekOf(from < today ? from : today); wk <= to; wk = addDays(wk, 7)) {
    const ws = weekSlots(s, wk)
    const end = addDays(wk, 6)
    const planned = new Set(ws.filter((x) => !x.skipped).map((x) => x.date))
    const spare = [...visits].filter((v) => v >= wk && v <= end && !planned.has(v) && v >= s.since).sort()
    for (const x of ws) {
      let status: SlotStatus
      let coveredBy: string | undefined
      if (!x.skipped && visits.has(x.date)) status = 'done'
      else if (x.skipped && x.date >= today) status = 'skipped'
      else if (x.date > today) status = 'upcoming'
      else if (x.date === today) status = 'today'
      else {
        coveredBy = spare.shift()
        status = coveredBy ? 'covered' : x.skipped ? 'skipped' : 'missed'
      }
      slots.push({ ...x, status, coveredBy })
    }
    extras.push(...spare)
  }
  labelSlots(slots, done, today)
  return {
    slots: slots.filter((x) => x.date >= from && x.date <= to),
    extras: extras.filter((v) => v >= from && v <= to),
  }
}

/**
 * Gives each session the workout it will really be, instead of a fixed weekday: the plan is a
 * rotation (Day 1 → 2 → 3 → 1 …), so a missed Day 1 is still the next workout. Days already
 * trained keep what was trained; missed days show what was due then.
 */
function labelSlots(slots: SlotInfo[], done: Done[], today: string) {
  const trained = new Map(done.map((d) => [d.date, d.dayId]))
  let due = nextDue(done, today)
  for (const x of [...slots].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const t = x.skipped ? undefined : trained.get(x.date)
    if (t) x.dayId = t
    else if (x.date < today) x.dayId = nextDue(done, addDays(x.date, -1))
    else {
      x.dayId = due
      if (!x.skipped) due = nextDay(due)
    }
  }
}

/** Money for one calendar month: the fee spread over the planned sessions of that month. */
export function monthMoney(s: Sched, visitDates: string[], year: number, month: number, today: string) {
  const from = dateKey(new Date(year, month, 1))
  const to = dateKey(new Date(year, month + 1, 0))
  const { slots, extras } = attendance(s, visitDates, from, to, today)
  const planned = slots.length
  const per = planned ? s.price / planned : 0
  const count = (st: SlotStatus[]) => slots.filter((x) => st.includes(x.status)).length
  const missed = count(['missed', 'skipped'])
  const attended = count(['done', 'covered'])
  const ahead = count(['today', 'upcoming'])
  const visits = new Set(visitDates.filter((v) => v >= from && v <= to && v >= s.since)).size
  return {
    planned,
    per,
    missed,
    attended,
    ahead,
    extras: extras.length,
    visits,
    used: attended * per,
    lost: missed * per,
    /** what a single visit actually cost this month */
    perVisit: visits ? s.price / visits : null,
    active: to >= s.since,
  }
}

export const defaultSched = (since: string): Sched => ({
  moves: {},
  since,
  price: 30,
  updatedAt: 0,
})
