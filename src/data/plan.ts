import raw from './exercises.json'

export type Lang = 'ar' | 'en'
export type L = { ar: string; en: string }
export type LList = { ar: string[]; en: string[] }
export type ProfileKey = 'mohammed' | 'mai'
export type DayId = 'd1' | 'd2' | 'd3'

export interface Machine {
  model: string
  /** official German name as printed on gym80's site / the machine */
  de: string
  name: L
  /** file name inside public/assets/machines/ */
  photo: string
  /** gym80's own YouTube video for this machine */
  video?: string
  /** true for multi-purpose stations (cable tower): their video isn't exercise-specific */
  generic?: boolean
  url: string
}

/** One way of doing an exercise: the main version (A) or the alternative (B). */
export interface Variant {
  name: L
  de: string
  /** key into `machines`, or null when no gym80 machine is involved */
  machine: string | null
  equipment?: L & { de: string }
  setup: L
  coach?: LList
  avoid?: LList
  videoQuery: string
  /** YouTube how-to video id; empty = only the gym80 video (or a search button) */
  videoId: string
}

export interface Exercise extends Variant {
  id: string
  sets?: number
  reps?: L
  optional?: boolean
  /** Ghaith's original note */
  note?: L
  /** option B: when the machine is busy or too hard */
  alt?: Variant & { why: L }
}

export interface Group {
  name: L
  exercises: Exercise[]
  maiOnly?: boolean
  note?: L
}

export interface Day {
  id: DayId
  /** JS weekday: 1 = Monday … 5 = Friday */
  weekday: number
  title: L
  short: L
  de: string
  groups: Group[]
  maiExtras: Exercise[]
  maiSwap?: { replace: string; with: string; note: L }
}

interface PlanData {
  defaults: { sets: number; reps: L }
  machines: Record<string, Machine>
  days: Day[]
  maiExtrasNote: L
}

export const plan = raw as unknown as PlanData
export const DAY_IDS: DayId[] = plan.days.map((d) => d.id)

export const PROFILES: Record<ProfileKey, L> = {
  mohammed: { ar: 'محمد', en: 'Mohammed' },
  mai: { ar: 'مي', en: 'Mai' },
}

export const getDay = (id: string): Day => plan.days.find((d) => d.id === id) ?? plan.days[0]
export const setsOf = (ex: Exercise) => ex.sets ?? plan.defaults.sets
export const repsOf = (ex: Exercise) => ex.reps ?? plan.defaults.reps
export const machineOf = (v: Variant): Machine | null => (v.machine ? (plan.machines[v.machine] ?? null) : null)

/** Videos for a variant: gym80's official machine video first (if machine-specific), then the how-to. */
export function videosOf(v: Variant): { kind: 'gym80' | 'howto'; id: string }[] {
  const m = machineOf(v)
  const list: { kind: 'gym80' | 'howto'; id: string }[] = []
  if (m?.video && !m.generic) list.push({ kind: 'gym80', id: m.video })
  if (v.videoId) list.push({ kind: 'howto', id: v.videoId })
  if (!list.length && m?.video) list.push({ kind: 'gym80', id: m.video })
  return list
}

const allMaiExtras = plan.days.flatMap((d) => d.maiExtras)

/** The groups one profile sees for a day. Mohammed never gets Mai's extras or swaps. */
export function groupsFor(day: Day, profile: ProfileKey): Group[] {
  if (profile !== 'mai') return day.groups
  const swap = day.maiSwap
  const swapIn = swap ? allMaiExtras.find((e) => e.id === swap.with) : undefined
  const groups: Group[] = day.groups.map((g) => ({
    ...g,
    exercises: g.exercises.map((e) => (swap && swapIn && e.id === swap.replace ? swapIn : e)),
  }))
  groups.push({
    name: { ar: 'إضافات لمي فقط', en: 'Extras for Mai only' },
    exercises: day.maiExtras,
    maiOnly: true,
    note: {
      ar: [swap?.note.ar, plan.maiExtrasNote.ar].filter(Boolean).join(' '),
      en: [swap?.note.en, plan.maiExtrasNote.en].filter(Boolean).join(' '),
    },
  })
  return groups
}

export const exercisesFor = (day: Day, profile: ProfileKey) =>
  groupsFor(day, profile).flatMap((g) => g.exercises)

export const youtubeSearchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
