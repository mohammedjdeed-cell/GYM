// Optional Supabase sync. Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app is local-only
// and the Supabase client is never even downloaded.
// All access goes through two SQL functions (see supabase/schema.sql) that require the household code.
import { PROFILES, type DayId, type ProfileKey } from './data/plan'
import type { Session, SetLog, Settings } from './store'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const syncConfigured = Boolean(url && anonKey)

export interface RemoteProfile {
  key: ProfileKey
  weightLogging: boolean
  updatedAt: number
}

interface RemoteSetLog {
  exercise_id: string
  set_no: number
  done: boolean
  weight_kg: number | null
}
interface RemoteSession {
  id: string
  profile_id: string
  day_id: string
  date: string
  started_at: string
  finished_at: string
  sets_done: number
  sets_total: number
  deleted: boolean
  updated_at: string
  set_logs: RemoteSetLog[]
}

const iso = (ms: number) => new Date(ms).toISOString()

let clientP: Promise<import('@supabase/supabase-js').SupabaseClient> | null = null
const client = () =>
  (clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } }),
  ))

export async function syncAll(household: string, dirty: Session[], settings: Settings) {
  const sb = await client()

  const push = await sb.rpc('gym_push', {
    p_household: household,
    p_profiles: (Object.keys(PROFILES) as ProfileKey[]).map((key) => ({
      key,
      name: PROFILES[key].en,
      weight_logging: settings.weight[key],
      updated_at: iso(settings.weightUpdatedAt[key] ?? 0),
    })),
    p_sessions: dirty.map((s) => ({
      id: s.id,
      profile: s.profile,
      day_id: s.dayId,
      date: s.date,
      started_at: iso(s.startedAt),
      finished_at: iso(s.finishedAt),
      sets_done: s.setsDone,
      sets_total: s.setsTotal,
      deleted: Boolean(s.deleted),
      updated_at: iso(s.updatedAt),
    })),
    p_set_logs: dirty.flatMap((s) =>
      Object.entries(s.sets).flatMap(([exercise_id, logs]) =>
        logs.map((l, i) => ({
          session_id: s.id,
          exercise_id,
          set_no: i + 1,
          done: l.done,
          weight_kg: l.kg ?? null,
        })),
      ),
    ),
  })
  if (push.error) throw new Error(push.error.message)

  const pull = await sb.rpc('gym_pull', { p_household: household })
  if (pull.error) throw new Error(pull.error.message)
  const data = pull.data as {
    profiles: { key: ProfileKey; weight_logging: boolean; updated_at: string }[]
    sessions: RemoteSession[]
  }

  const sessions: Session[] = data.sessions.map((r) => {
    const sets: Record<string, SetLog[]> = {}
    for (const l of [...r.set_logs].sort((a, b) => a.set_no - b.set_no)) {
      ;(sets[l.exercise_id] ??= []).push({ done: l.done, kg: l.weight_kg })
    }
    return {
      id: r.id,
      profile: r.profile_id.split(':').pop() as ProfileKey,
      dayId: r.day_id as DayId,
      date: r.date,
      startedAt: Date.parse(r.started_at),
      finishedAt: Date.parse(r.finished_at),
      sets,
      setsDone: r.sets_done,
      setsTotal: r.sets_total,
      updatedAt: Date.parse(r.updated_at),
      deleted: r.deleted,
      dirty: false,
    }
  })
  const profiles: RemoteProfile[] = data.profiles.map((p) => ({
    key: p.key,
    weightLogging: p.weight_logging,
    updatedAt: Date.parse(p.updated_at),
  }))
  return { sessions, profiles }
}
