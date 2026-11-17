// Firebase (Cloud Firestore) sync between the two phones. Requests are made as the signed-in
// Google user; firestore.rules only lets the two claimed members of a household in.
//
// Data layout:
//   households/{code}/profiles/{mohammed|mai}   weight-logging switch
//   households/{code}/schedule/{mohammed|mai}   moved/skipped sessions, membership start, fee
//   households/{code}/sessions/{sessionId}      one workout (set logs inside)
import { PROFILES, type DayId, type ProfileKey } from './data/plan'
import { kvGet, kvSet } from './db'
import { getDb } from './firebase'
import type { Sched } from './schedule'
import type { Session, SetLog, Settings } from './store'

export const syncConfigured = true

export interface RemoteProfile {
  key: ProfileKey
  weightLogging: boolean
  updatedAt: number
}

interface SessionDoc {
  profile: ProfileKey
  dayId: DayId
  date: string
  startedAt: number
  finishedAt: number
  sets: Record<string, { done: boolean; kg: number | null }[]>
  setsDone: number
  setsTotal: number
  deleted: boolean
  updatedAt: number
  syncedAt?: { toMillis(): number }
}

/** Overlap when asking for "changes since last sync", to tolerate server clock jitter. */
const OVERLAP_MS = 5 * 60_000
const KEYS = Object.keys(PROFILES) as ProfileKey[]

export async function syncAll(household: string, dirty: Session[], settings: Settings, schedule: Record<ProfileKey, Sched>) {
  const { fs, db } = await getDb()
  const base = `households/${household}`

  // 1. profiles + schedules: read both, then write ours where it is newer
  const [profileSnap, schedSnap] = await Promise.all([
    fs.getDocs(fs.collection(db, `${base}/profiles`)),
    fs.getDocs(fs.collection(db, `${base}/schedule`)),
  ])
  const profiles: RemoteProfile[] = profileSnap.docs.map((d) => ({
    key: d.id as ProfileKey,
    weightLogging: Boolean(d.data().weightLogging),
    updatedAt: Number(d.data().updatedAt ?? 0),
  }))
  const schedules: Partial<Record<ProfileKey, Sched>> = {}
  for (const d of schedSnap.docs) {
    const r = d.data()
    schedules[d.id as ProfileKey] = {
      moves: (r.moves ?? {}) as Record<string, string>,
      since: String(r.since ?? ''),
      price: Number(r.price ?? 30),
      updatedAt: Number(r.updatedAt ?? 0),
    }
  }

  const batch = fs.writeBatch(db)
  let writes = 0
  for (const key of KEYS) {
    const remote = profiles.find((p) => p.key === key)
    const localAt = settings.weightUpdatedAt[key] ?? 0
    if (!remote || localAt > remote.updatedAt) {
      batch.set(fs.doc(db, `${base}/profiles/${key}`), {
        name: PROFILES[key].en,
        weightLogging: settings.weight[key],
        updatedAt: localAt,
      })
      writes++
    }
    const rs = schedules[key]
    const ls = schedule[key]
    if (!rs || ls.updatedAt > rs.updatedAt) {
      batch.set(fs.doc(db, `${base}/schedule/${key}`), { ...ls })
      writes++
    }
  }

  // 2. push sessions that have not reached the server yet (a batch holds up to 500 writes)
  for (const s of dirty.slice(0, 400)) {
    const sets: SessionDoc['sets'] = {}
    for (const [exId, logs] of Object.entries(s.sets)) {
      sets[exId] = logs.map((l) => ({ done: l.done, kg: l.kg ?? null }))
    }
    batch.set(fs.doc(db, `${base}/sessions/${s.id}`), {
      profile: s.profile,
      dayId: s.dayId,
      date: s.date,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      sets,
      setsDone: s.setsDone,
      setsTotal: s.setsTotal,
      deleted: Boolean(s.deleted),
      updatedAt: s.updatedAt,
      syncedAt: fs.serverTimestamp(),
    })
    writes++
  }
  if (writes) await batch.commit()

  // 3. pull sessions written since our last pull (by server time, so phone clocks don't matter)
  const cursorKey = `syncCursor:${household}`
  const cursor = (await kvGet<number>(cursorKey)) ?? 0
  const sessionSnap = await fs.getDocs(
    fs.query(
      fs.collection(db, `${base}/sessions`),
      fs.where('syncedAt', '>', fs.Timestamp.fromMillis(Math.max(0, cursor - OVERLAP_MS))),
    ),
  )
  let newest = cursor
  const sessions: Session[] = sessionSnap.docs.map((d) => {
    const r = d.data() as SessionDoc
    newest = Math.max(newest, r.syncedAt?.toMillis() ?? 0)
    const sets: Record<string, SetLog[]> = {}
    for (const [exId, logs] of Object.entries(r.sets ?? {})) sets[exId] = logs.map((l) => ({ done: l.done, kg: l.kg }))
    return {
      id: d.id,
      profile: r.profile,
      dayId: r.dayId,
      date: r.date,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      sets,
      setsDone: r.setsDone,
      setsTotal: r.setsTotal,
      updatedAt: r.updatedAt,
      deleted: r.deleted,
      dirty: false,
    }
  })
  if (newest > cursor) await kvSet(cursorKey, newest)

  return { sessions, profiles, schedules }
}
