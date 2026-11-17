// Google sign-in (Firebase Auth) and household membership.
//
// Each person signs in with their own Google account and claims "Mohammed" or "Mai" inside the
// household. A claim can only be made once, so after both have signed in nobody else can join,
// even with the household code. Firestore layout:
//   users/{uid}                         → { household, profile }
//   households/{code}/claims/{profile}  → { uid, name, email }
import type { UserCredential } from 'firebase/auth'
import type { ProfileKey } from './data/plan'
import { getDb, getFirebase } from './firebase'

export const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export interface AuthUser {
  uid: string
  email: string
  name: string
  photo: string | null
}
export interface Member {
  household: string
  profile: ProfileKey
}
export interface CalToken {
  token: string
  exp: number
}

/**
 * Development-only shortcut so the UI can be tested without a Google account:
 * localStorage['gym-dev'] = 'mohammed' | 'mai'. Not present in production builds.
 */
export const devProfile: ProfileKey | null = import.meta.env.DEV
  ? ((localStorage.getItem('gym-dev') as ProfileKey | null) ?? null)
  : null

const toUser = (u: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): AuthUser => ({
  uid: u.uid,
  email: u.email ?? '',
  name: u.displayName ?? '',
  photo: u.photoURL,
})

export async function watchAuth(cb: (u: AuthUser | null) => void) {
  if (devProfile) return cb({ uid: `dev-${devProfile}`, email: `${devProfile}@example.com`, name: devProfile, photo: null })
  const { auth, sdk } = await getFirebase()
  // finishes a redirect sign-in (used when popups aren't allowed, e.g. some iPhone home-screen apps)
  sdk.getRedirectResult(auth).then(keepToken, () => {})
  sdk.onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null))
}

let tokenSink: (t: CalToken) => void = () => {}
/** Where Google Calendar access tokens go when a sign-in grants them. */
export const onCalendarToken = (fn: (t: CalToken) => void) => (tokenSink = fn)

async function keepToken(res: UserCredential | null) {
  if (!res) return
  const { sdk } = await getFirebase()
  const token = sdk.GoogleAuthProvider.credentialFromResult(res)?.accessToken
  // Google access tokens live one hour; refresh a little early
  if (token) tokenSink({ token, exp: Date.now() + 55 * 60_000 })
}

async function provider(email?: string) {
  const { sdk } = await getFirebase()
  const p = new sdk.GoogleAuthProvider()
  p.addScope(CAL_SCOPE)
  p.setCustomParameters(email ? { login_hint: email } : { prompt: 'select_account' })
  return p
}

const POPUP_UNSUPPORTED = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request']
const code = (e: unknown) => (e as { code?: string })?.code ?? ''

/** Sign in with Google. Also asks for Google Calendar access, so both happen in one step. */
export async function signIn() {
  const { auth, sdk } = await getFirebase()
  const p = await provider()
  try {
    await keepToken(await sdk.signInWithPopup(auth, p))
  } catch (e) {
    if (code(e) === 'auth/popup-closed-by-user') return
    if (POPUP_UNSUPPORTED.includes(code(e))) return sdk.signInWithRedirect(auth, p)
    throw e
  }
}

/** Fresh Google Calendar token for the signed-in user (one tap: Google remembers the consent). */
export async function reconnectCalendar(email: string) {
  if (devProfile) return tokenSink({ token: 'dev-token', exp: Date.now() + 55 * 60_000 })
  const { auth, sdk } = await getFirebase()
  if (!auth.currentUser) throw new Error('not signed in')
  const p = await provider(email)
  try {
    await keepToken(await sdk.reauthenticateWithPopup(auth.currentUser, p))
  } catch (e) {
    if (code(e) === 'auth/popup-closed-by-user') return
    if (POPUP_UNSUPPORTED.includes(code(e))) return sdk.reauthenticateWithRedirect(auth.currentUser, p)
    throw e
  }
}

export async function signOutNow() {
  if (devProfile) {
    localStorage.removeItem('gym-dev')
    return location.reload()
  }
  const { auth, sdk } = await getFirebase()
  await sdk.signOut(auth)
}

// ---------- membership ----------
export async function fetchMember(uid: string): Promise<Member | null> {
  const { fs, db } = await getDb()
  const snap = await fs.getDoc(fs.doc(db, `users/${uid}`))
  const d = snap.data()
  return d && typeof d.household === 'string' && (d.profile === 'mohammed' || d.profile === 'mai')
    ? { household: d.household, profile: d.profile }
    : null
}

export type Claims = Partial<Record<ProfileKey, { uid: string; name: string }>>
export async function readClaims(household: string): Promise<Claims> {
  const { fs, db } = await getDb()
  const snap = await fs.getDocs(fs.collection(db, `households/${household}/claims`))
  const out: Claims = {}
  for (const d of snap.docs) out[d.id as ProfileKey] = { uid: String(d.data().uid), name: String(d.data().name ?? '') }
  return out
}

/** Claims a profile for this Google account. Returns false when someone else already has it. */
export async function claim(household: string, profile: ProfileKey, user: AuthUser) {
  const { fs, db } = await getDb()
  const ref = fs.doc(db, `households/${household}/claims/${profile}`)
  const cur = await fs.getDoc(ref)
  if (cur.exists() && cur.data().uid !== user.uid) return false
  if (!cur.exists()) await fs.setDoc(ref, { uid: user.uid, name: user.name, email: user.email, at: Date.now() })
  await fs.setDoc(fs.doc(db, `users/${user.uid}`), { household, profile })
  return true
}
