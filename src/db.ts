// Tiny IndexedDB wrapper: a key/value store plus a sessions store.
// Falls back to memory if IndexedDB is unavailable (e.g. some private modes).
import type { Session } from './store'

const mem = { kv: new Map<string, unknown>(), sessions: new Map<string, Session>() }
let dbp: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open('gym-tracker', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv')
        req.result.createObjectStore('sessions', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbp
}

function run<T>(store: 'kv' | 'sessions', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined)
        try {
          const req = fn(db.transaction(store, mode).objectStore(store))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(undefined)
        } catch {
          resolve(undefined)
        }
      }),
  )
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const v = await run<T>('kv', 'readonly', (s) => s.get(key))
  return v ?? (mem.kv.get(key) as T | undefined)
}
export async function kvSet(key: string, value: unknown) {
  mem.kv.set(key, value)
  await run('kv', 'readwrite', (s) => s.put(value, key))
}
export async function allSessions(): Promise<Session[]> {
  const v = await run<Session[]>('sessions', 'readonly', (s) => s.getAll())
  return v ?? [...mem.sessions.values()]
}
export async function putSessions(list: Session[]) {
  for (const s of list) {
    mem.sessions.set(s.id, s)
    await run('sessions', 'readwrite', (st) => st.put(s))
  }
}
