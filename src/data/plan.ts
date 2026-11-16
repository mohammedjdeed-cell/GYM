import raw from './exercises.json'

export type Lang = 'ar' | 'en'
export type L = { ar: string; en: string }
export type ProfileKey = 'mohammed' | 'mai'
export type DayId = 'd1' | 'd2' | 'd3'

export interface Machine {
  model: string
  /** file name inside public/assets/machines/ */
  photo: string
  name: L
  url: string
}

export interface Exercise {
  id: string
  name: L
  de: string
  sets?: number
  reps?: L
  optional?: boolean
  note?: L
  /** key into `machines`, or null when no gym80 machine is involved */
  machine: string | null
  equipment?: L & { de: string }
  setup: L
  videoQuery: string
  /** YouTube video id; empty string = popup falls back to a search button */
  videoId: string
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
export const machineOf = (ex: Exercise): Machine | null =>
  ex.machine ? (plan.machines[ex.machine] ?? null) : null

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
