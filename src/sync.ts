// Optional Firebase (Cloud Firestore) sync. Without the VITE_FIREBASE_* variables the app is
// local-only and the Firebase SDK is never even downloaded.
//
// Data layout – the household code is part of the path, and firestore.rules only allows access
// to documents under a code, never listing the codes themselves:
//   households/{code}/profiles/{mohammed|mai}
//   households/{code}/sessions/{sessionId}     (set logs are stored inside the session document)
import type { Firestore } from 'firebase/firestore/lite'
import { PROFILES, type DayId, type ProfileKey } from './data/plan'
import { kvGet, kvSet } from './db'
import type { Session, SetLog, Settings } from './store'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}
export const syncConfigured = Boolean(config.apiKey && config.projectId)

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

type Lite = typeof import('firebase/firestore/lite')
let sdk: Promise<{ fs: Lite; db: Firestore }> | null = null
const load = () =>
  (sdk ??= Promise.all([import('firebase/app'), import('firebase/firestore/lite')]).then(([app, fs]) => ({
    fs,
    db: fs.getFirestore(app.initializeApp(config)),
  })))

/** Overlap when asking for "changes since last sync", to tolerate server clock jitter. */
const OVERLAP_MS = 5 * 60_000

export async function syncAll(household: string, dirty: Session[], settings: Settings) {
  const { fs, db } = await load()
  const base = `households/${household}`

  // 1. profiles: read both, then write ours where it is newer
  const profileSnap = await fs.getDocs(fs.collection(db, `${base}/profiles`))
  const profiles: RemoteProfile[] = profileSnap.docs.map((d) => ({
    key: d.id as ProfileKey,
    weightLogging: Boolean(d.data().weightLogging),
    updatedAt: Number(d.data().updatedAt ?? 0),
  }))
  const batch = fs.writeBatch(db)
  let writes = 0
  for (const key of Object.keys(PROFILES) as ProfileKey[]) {
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

  return { sessions, profiles }
}
