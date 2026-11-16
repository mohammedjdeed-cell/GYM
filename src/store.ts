// App state: a small external store persisted to IndexedDB (local-first).
import { useSyncExternalStore } from 'react'
import type { DayId, Lang, ProfileKey } from './data/plan'
import { DAY_IDS } from './data/plan'
import { allSessions, kvGet, kvSet, putSessions } from './db'
import { syncAll, syncConfigured } from './sync'
import { translate, type TKey } from './i18n'

export interface SetLog {
  done: boolean
  kg?: number | null
}
export interface Session {
  id: string
  profile: ProfileKey
  dayId: DayId
  /** local calendar date, YYYY-MM-DD */
  date: string
  startedAt: number
  finishedAt: number
  sets: Record<string, SetLog[]>
  setsDone: number
  setsTotal: number
  updatedAt: number
  deleted?: boolean
  /** true until pushed to Firebase */
  dirty?: boolean
}
export interface Draft {
  startedAt: number
  sets: Record<string, SetLog[]>
}
export interface Settings {
  lang: Lang
  profile: ProfileKey
  rest: 0 | 60 | 90 | 120
  /** exercises switched to option B, keyed "profile:exerciseId" */
  alt: Record<string, boolean>
  household: string
  weight: Record<ProfileKey, boolean>
  weightUpdatedAt: Record<ProfileKey, number>
}
export interface SyncState {
  status: 'idle' | 'syncing' | 'ok' | 'error'
  at: number
  error?: string
}
interface State {
  ready: boolean
  settings: Settings
  sessions: Session[]
  drafts: Record<string, Draft>
  sync: SyncState
}

let state: State = {
  ready: false,
  settings: {
    lang: 'ar',
    profile: 'mohammed',
    rest: 90,
    alt: {},
    household: '',
    weight: { mohammed: false, mai: false },
    weightUpdatedAt: { mohammed: 0, mai: 0 },
  },
  sessions: [],
  drafts: {},
  sync: { status: 'idle', at: 0 },
}
const listeners = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

export const useStore = () => useSyncExternalStore(subscribe, () => state)
export function useT() {
  const lang = useStore().settings.lang
  return (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
}

// ---------- dates ----------
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Monday 00:00 of the week containing d */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ---------- selectors ----------
export const sessionsOf = (sessions: Session[], profile: ProfileKey) =>
  sessions.filter((s) => s.profile === profile && !s.deleted).sort((a, b) => b.finishedAt - a.finishedAt)

export function thisWeek(sessions: Session[], profile: ProfileKey, now = new Date()) {
  const from = dateKey(weekStart(now))
  return sessionsOf(sessions, profile).filter((s) => s.date >= from)
}

/** Mon = Day 1, Wed = Day 2, Fri = Day 3; otherwise the next day not yet done this week. */
export function suggestedDay(sessions: Session[], profile: ProfileKey, now = new Date()): DayId {
  const done = new Set(thisWeek(sessions, profile, now).map((s) => s.dayId))
  const byWeekday: Record<number, DayId> = { 1: 'd1', 3: 'd2', 5: 'd3' }
  const today = byWeekday[now.getDay()]
  if (today && !done.has(today)) return today
  return DAY_IDS.find((d) => !done.has(d)) ?? 'd1'
}

/** Consecutive weeks (ending this week or last week) with at least one session. */
export function weekStreak(sessions: Session[], profile: ProfileKey, now = new Date()) {
  const weeks = new Set(sessionsOf(sessions, profile).map((s) => dateKey(weekStart(parseKey(s.date)))))
  const cur = weekStart(now)
  if (!weeks.has(dateKey(cur))) cur.setDate(cur.getDate() - 7)
  let n = 0
  while (weeks.has(dateKey(cur))) {
    n++
    cur.setDate(cur.getDate() - 7)
  }
  return n
}

export const draftKey = (profile: ProfileKey, dayId: string) => `${profile}:${dayId}`
export const draftSetsDone = (d?: Draft) =>
  d ? Object.values(d.sets).reduce((n, l) => n + l.filter((x) => x.done).length, 0) : 0

/** Last logged weight for an exercise set, used as an input placeholder. */
export function lastKg(sessions: Session[], profile: ProfileKey, exId: string, idx: number) {
  for (const s of sessionsOf(sessions, profile)) {
    const kg = s.sets[exId]?.[idx]?.kg
    if (kg != null) return kg
  }
  return null
}

/** Most recent session where this exercise had at least one ticked set. */
export function exerciseLast(sessions: Session[], profile: ProfileKey, exId: string) {
  for (const s of sessionsOf(sessions, profile)) {
    const logs = s.sets[exId]
    if (!logs?.some((l) => l.done)) continue
    const kgs = logs.map((l) => l.kg).filter((k): k is number => k != null)
    return {
      at: s.finishedAt,
      done: logs.filter((l) => l.done).length,
      total: logs.length,
      kg: kgs.length ? Math.max(...kgs) : null,
    }
  }
  return null
}

// ---------- actions ----------
export async function init() {
  const [settings, drafts, sessions] = await Promise.all([
    kvGet<Partial<Settings>>('settings'),
    kvGet<Record<string, Draft>>('drafts'),
    allSessions(),
  ])
  set({
    ready: true,
    settings: { ...state.settings, ...settings },
    drafts: drafts ?? {},
    sessions,
  })
  void syncNow()
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.sync.at > 60_000) void syncNow()
  })
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch }
  set({ settings })
  void kvSet('settings', settings)
}

export function setWeightLogging(profile: ProfileKey, on: boolean) {
  updateSettings({
    weight: { ...state.settings.weight, [profile]: on },
    weightUpdatedAt: { ...state.settings.weightUpdatedAt, [profile]: Date.now() },
  })
  void syncNow()
}

function writeDraft(key: string, draft: Draft | null) {
  const drafts = { ...state.drafts }
  if (draft) drafts[key] = draft
  else delete drafts[key]
  set({ drafts })
  void kvSet('drafts', drafts)
}

function editSet(dayId: string, exId: string, idx: number, nSets: number, fn: (l: SetLog) => SetLog) {
  const key = draftKey(state.settings.profile, dayId)
  const draft = state.drafts[key] ?? { startedAt: Date.now(), sets: {} }
  const logs = Array.from({ length: nSets }, (_, i) => draft.sets[exId]?.[i] ?? { done: false })
  logs[idx] = fn(logs[idx])
  writeDraft(key, { ...draft, sets: { ...draft.sets, [exId]: logs } })
  return logs[idx]
}

/** Toggles one set; returns true when it is now ticked. */
export const toggleSet = (dayId: string, exId: string, idx: number, nSets: number) =>
  editSet(dayId, exId, idx, nSets, (l) => ({ ...l, done: !l.done })).done

export const setKg = (dayId: string, exId: string, idx: number, nSets: number, kg: number | null) =>
  void editSet(dayId, exId, idx, nSets, (l) => ({ ...l, kg }))

export const clearDraft = (dayId: string) => writeDraft(draftKey(state.settings.profile, dayId), null)

export function finishWorkout(dayId: DayId, exercises: { id: string; sets: number }[]) {
  const profile = state.settings.profile
  const key = draftKey(profile, dayId)
  const draft = state.drafts[key]
  const now = Date.now()
  const sets: Record<string, SetLog[]> = {}
  let setsDone = 0
  let setsTotal = 0
  for (const ex of exercises) {
    sets[ex.id] = Array.from({ length: ex.sets }, (_, i) => draft?.sets[ex.id]?.[i] ?? { done: false })
    setsDone += sets[ex.id].filter((l) => l.done).length
    setsTotal += ex.sets
  }
  const session: Session = {
    id: crypto.randomUUID(),
    profile,
    dayId,
    date: dateKey(new Date()),
    startedAt: draft?.startedAt ?? now,
    finishedAt: now,
    sets,
    setsDone,
    setsTotal,
    updatedAt: now,
    dirty: true,
  }
  set({ sessions: [...state.sessions, session] })
  void putSessions([session])
  writeDraft(key, null)
  void syncNow()
  return session
}

export function deleteSession(id: string) {
  const sessions = state.sessions.map((s) =>
    s.id === id ? { ...s, deleted: true, dirty: true, updatedAt: Date.now() } : s,
  )
  set({ sessions })
  void putSessions(sessions.filter((s) => s.id === id))
  void syncNow()
}

export const pendingCount = (sessions: Session[]) => sessions.filter((s) => s.dirty).length

let syncing = false
export async function syncNow() {
  const household = state.settings.household.trim().toLowerCase()
  if (!syncConfigured || household.length < 6 || syncing || !navigator.onLine) return
  syncing = true
  set({ sync: { ...state.sync, status: 'syncing' } })
  try {
    const pushed = state.sessions.filter((s) => s.dirty)
    const remote = await syncAll(household, pushed, state.settings)

    // merge: newest updatedAt wins; anything we just pushed is now clean
    const pushedAt = new Map(pushed.map((s) => [s.id, s.updatedAt]))
    const byId = new Map(state.sessions.map((s) => [s.id, s]))
    const changed: Session[] = []
    for (const [id, at] of pushedAt) {
      const cur = byId.get(id)
      if (cur && cur.updatedAt === at) {
        const clean = { ...cur, dirty: false }
        byId.set(id, clean)
        changed.push(clean)
      }
    }
    for (const r of remote.sessions) {
      const cur = byId.get(r.id)
      if (!cur || r.updatedAt > cur.updatedAt) {
        byId.set(r.id, r)
        changed.push(r)
      }
    }
    set({ sessions: [...byId.values()] })
    void putSessions(changed)

    const s = state.settings
    const weight = { ...s.weight }
    const weightUpdatedAt = { ...s.weightUpdatedAt }
    for (const p of remote.profiles) {
      if (p.updatedAt > (weightUpdatedAt[p.key] ?? 0)) {
        weight[p.key] = p.weightLogging
        weightUpdatedAt[p.key] = p.updatedAt
      }
    }
    updateSettings({ weight, weightUpdatedAt })
    set({ sync: { status: 'ok', at: Date.now() } })
  } catch (e) {
    set({ sync: { status: 'error', at: Date.now(), error: e instanceof Error ? e.message : String(e) } })
  } finally {
    syncing = false
  }
}
