// Google Calendar sync: every planned session becomes an event in the signed-in person's own
// calendar, and the event follows the app – moved sessions move, skipped ones disappear, and
// past ones turn ✅ green (went) or ❌ red (missed, with the money lost).
//
// Event ids are derived from the planned date, so re-running is idempotent and nothing else in
// the calendar is ever touched. Only events whose body changed since the last run are sent.

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export interface EventBody {
  summary: string
  description: string
  location: string
  colorId: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  reminders: { useDefault: boolean; overrides?: { method: string; minutes: number }[] }
  extendedProperties: { private: Record<string, string> }
}
export interface Desired {
  id: string
  /** the date the event is on, YYYY-MM-DD (decides whether it is inside the sync window) */
  date: string
  body: EventBody
}
/** What was last written to Google, per event id. */
export type CalCache = Record<string, { h: string; date: string }>

export class CalendarAuthError extends Error {}

/** Google event ids allow only a–v and 0–9. */
export const eventId = (kind: 's' | 'e', profileIdx: number, date: string) => `g${kind}${profileIdx}${date.replace(/-/g, '')}`

/** Google's own reason for a failed call, kept short. */
async function why(res: Response) {
  const text = await res.text().catch(() => '')
  const msg = text.match(/"message":\s*"([^"]+)/)?.[1]
  return `Google Calendar: HTTP ${res.status}${msg ? ` – ${msg.slice(0, 120)}` : ''}`
}

const hash = (b: EventBody) => JSON.stringify(b)

export function diff(desired: Desired[], cache: CalCache, from: string, to: string) {
  const want = new Map(desired.map((d) => [d.id, d]))
  const upserts = desired.filter((d) => cache[d.id]?.h !== hash(d.body))
  const deletes = Object.entries(cache)
    .filter(([id, c]) => !want.has(id) && c.date >= from && c.date <= to)
    .map(([id]) => id)
  return { upserts, deletes }
}

async function call(token: string, method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) throw new CalendarAuthError('expired')
  if (res.status === 403) {
    const msg = await res.text()
    // missing calendar permission → ask again; anything else (API disabled, quota) is a real error
    if (/insufficient.*scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(msg)) throw new CalendarAuthError('scope')
    if (/SERVICE_DISABLED|has not been used|is disabled/i.test(msg)) throw new Error('api-off')
    throw new Error(msg.match(/"message":\s*"([^"]+)/)?.[1] ?? `HTTP 403`)
  }
  return res
}

async function upsert(token: string, d: Desired, known: boolean) {
  const body = { ...d.body, status: 'confirmed' }
  const put = () => call(token, 'PUT', `${API}/${d.id}`, body)
  const post = () => call(token, 'POST', API, { id: d.id, ...body })
  let res: Response
  if (known) {
    res = await put()
    if (res.status === 404) res = await post()
  } else {
    res = await post()
    // 409: the id already exists (e.g. written from another phone, or deleted earlier) – update
    // it instead, which also brings a deleted event back
    if (res.status === 409) res = await put()
  }
  if (!res.ok) throw new Error(await why(res))
}

async function remove(token: string, id: string) {
  const res = await call(token, 'DELETE', `${API}/${id}`)
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(await why(res))
}

/** Applies the difference. Returns the new cache (also on failure, with what did get through). */
export async function push(token: string, desired: Desired[], cache: CalCache, from: string, to: string) {
  const { upserts, deletes } = diff(desired, cache, from, to)
  const next = { ...cache }
  let error: unknown = null
  try {
    for (const d of upserts) {
      await upsert(token, d, !!cache[d.id])
      next[d.id] = { h: hash(d.body), date: d.date }
    }
    for (const id of deletes) {
      await remove(token, id)
      delete next[id]
    }
  } catch (e) {
    error = e
  }
  return { cache: next, error }
}
