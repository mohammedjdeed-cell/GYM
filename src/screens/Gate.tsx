// Sign-in screen and first-time household setup.
import { useEffect, useState, type ReactNode } from 'react'
import { PROFILES, type ProfileKey } from '../data/plan'
import { readClaims, signIn, type Claims } from '../auth'
import { joinHousehold, signOut, updateSettings, useStore, useT } from '../store'
import { Card, Icon, haptic } from '../components/ui'

function Shell({ children }: { children: ReactNode }) {
  const { lang } = useStore().settings
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button
        onClick={() => updateSettings({ lang: lang === 'ar' ? 'en' : 'ar' })}
        className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] h-12 min-w-12 rounded-full bg-surface2 px-3 text-sm font-extrabold"
        data-testid="lang-toggle"
      >
        {lang === 'ar' ? 'EN' : 'ع'}
      </button>
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-accent text-onaccent shadow-lg">
        <Icon name="dumbbell" className="h-10 w-10" />
      </div>
      {children}
    </div>
  )
}

const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

export function Login() {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <Shell>
      <h1 className="text-center text-3xl font-extrabold">{t('signInTitle')}</h1>
      <p className="mt-2 text-center text-muted">{t('signInSub')}</p>
      <button
        data-testid="sign-in"
        disabled={busy}
        onClick={async () => {
          haptic()
          setBusy(true)
          setErr('')
          try {
            await signIn()
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e))
          } finally {
            setBusy(false)
          }
        }}
        className="mt-8 flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white text-lg font-extrabold text-[#1f1f1f] shadow-sm active:scale-[.98] disabled:opacity-60"
      >
        <GoogleG />
        {busy ? t('loading') : t('signInGoogle')}
      </button>
      {err && <p className="mt-3 text-center text-sm font-semibold text-red-500">{t('signInErr', { e: err })}</p>}
      <p className="mt-6 text-center text-xs leading-relaxed text-muted">{t('signInWhy')}</p>
    </Shell>
  )
}

export function Setup() {
  const { settings, auth } = useStore()
  const t = useT()
  const { lang } = settings
  const [code, setCode] = useState(settings.household)
  const [claims, setClaims] = useState<Claims | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const clean = code.trim().toLowerCase()

  useEffect(() => {
    setClaims(null)
    if (clean.length < 6) return
    const id = setTimeout(() => {
      readClaims(clean).then(setClaims, (e) => setErr(navigator.onLine ? String(e?.message ?? e) : t('offlineErr')))
    }, 400)
    return () => clearTimeout(id)
  }, [clean])

  const pick = async (p: ProfileKey) => {
    haptic()
    setBusy(true)
    setErr('')
    try {
      const r = await joinHousehold(clean, p)
      if (r === 'taken') setErr(t('takenErr'))
    } catch (e) {
      setErr(navigator.onLine ? t('setupErr', { e: e instanceof Error ? e.message : String(e) }) : t('offlineErr'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="text-center text-3xl font-extrabold">{t('setupTitle')}</h1>
      <p className="mt-2 text-center text-sm text-muted">{t('setupSub')}</p>
      {auth.memberStatus === 'error' && <p className="mt-3 text-center text-sm font-semibold text-red-500">{auth.error}</p>}
      <Card className="mt-6">
        <label className="block text-sm font-semibold text-muted" htmlFor="household">{t('household')}</label>
        <input
          id="household"
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 h-14 w-full rounded-xl border border-line bg-bg px-3 text-lg"
        />
        <p className="mt-1 text-xs text-muted">{t('householdHint')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(Object.keys(PROFILES) as ProfileKey[]).map((p) => {
            const c = claims?.[p]
            const mine = c?.uid === auth.user?.uid
            const taken = !!c && !mine
            return (
              <button
                key={p}
                data-testid={`claim-${p}`}
                disabled={!claims || taken || busy}
                onClick={() => pick(p)}
                className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-line bg-surface2 p-3 font-extrabold active:scale-[.98] disabled:opacity-40"
              >
                <span className="text-xl">{PROFILES[p][lang]}</span>
                <span className="text-xs font-semibold text-muted">
                  {taken ? t('takenBy', { n: c.name || '—' }) : clean.length >= 6 && !claims ? t('checking') : ''}
                </span>
              </button>
            )
          })}
        </div>
        {err && <p className="mt-3 text-sm font-semibold text-red-500">{err}</p>}
      </Card>
      <button onClick={() => void signOut()} className="mt-4 min-h-12 text-sm font-bold text-muted">
        {auth.user?.email} · {t('signOut')}
      </button>
    </Shell>
  )
}

export function Splash() {
  const t = useT()
  return (
    <Shell>
      <p className="text-center text-muted">{t('loading')}</p>
    </Shell>
  )
}
