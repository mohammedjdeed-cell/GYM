// The household's Firebase project, loaded lazily (the SDK is its own chunk, precached for offline).
// These web config values are public identifiers, not secrets: access is controlled by Google
// sign-in plus firestore.rules. The VITE_FIREBASE_* variables override them, e.g. for a fork.
import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'

const env = import.meta.env
export const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string | undefined) || 'AIzaSyBeTogU-axCpYib8SZgNBkegxU6hbbNz4o',
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || 'gym-e9b75.firebaseapp.com',
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'gym-e9b75',
  appId: (env.VITE_FIREBASE_APP_ID as string | undefined) || '1:934849865049:web:3162a4e7768d2389e09848',
}

export type AuthSdk = typeof import('firebase/auth')
let fb: Promise<{ app: FirebaseApp; auth: Auth; sdk: AuthSdk }> | null = null

/** Firebase app + auth. Sign-in survives restarts and works offline (IndexedDB persistence). */
export const getFirebase = () =>
  (fb ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appSdk, sdk]) => {
    const app = appSdk.initializeApp(firebaseConfig)
    const auth = sdk.initializeAuth(app, {
      persistence: [sdk.indexedDBLocalPersistence, sdk.browserLocalPersistence],
      popupRedirectResolver: sdk.browserPopupRedirectResolver,
    })
    return { app, auth, sdk }
  }))

type Lite = typeof import('firebase/firestore/lite')
let lite: Promise<{ fs: Lite; db: import('firebase/firestore/lite').Firestore }> | null = null
/** Firestore (lite). Requests carry the signed-in user's token, which firestore.rules checks. */
export const getDb = () =>
  (lite ??= Promise.all([getFirebase(), import('firebase/firestore/lite')]).then(([{ app }, fs]) => ({
    fs,
    db: fs.getFirestore(app),
  })))
