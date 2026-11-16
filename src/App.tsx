import { useEffect, useState, type ReactNode } from 'react'
import { DAY_IDS, type DayId } from './data/plan'
import { suggestedDay, updateSettings, useStore, useT } from './store'
import { Home } from './screens/Home'
import { Week } from './screens/Week'
import { Workout } from './screens/Workout'
import { History } from './screens/History'
import { Settings } from './screens/Settings'

function useRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => {
      setHash(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash.replace(/^#\/?/, '').split('/')
}

const icons: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  week: <path d="M4 5h16v15H4zM4 10h16M8 3v4M16 3v4" />,
  workout: <path d="M7 12h10M4 9v6M7 7v10M17 7v10M20 9v6" />,
  history: <path d="M12 7v5l3 2M12 3a9 9 0 1 0 9 9" />,
}

export default function App() {
  const { ready, settings, sessions } = useStore()
  const t = useT()
  const [page, arg] = useRoute()
  const { lang } = settings

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = t('appName')
  }, [lang])

  if (!ready) return null

  const workoutDay: DayId = DAY_IDS.includes(arg as DayId)
    ? (arg as DayId)
    : suggestedDay(sessions, settings.profile)
  const tabs = [
    { id: '', href: '#/', icon: 'home', label: t('navHome') },
    { id: 'week', href: '#/week', icon: 'week', label: t('navWeek') },
    { id: 'workout', href: `#/workout/${workoutDay}`, icon: 'workout', label: t('navWorkout') },
    { id: 'history', href: '#/history', icon: 'history', label: t('navHistory') },
  ]
  const current = ['week', 'workout', 'history', 'settings'].includes(page) ? page : ''

  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-[max(.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight">{t('appName')}</h1>
          <p className="text-sm text-muted">{t('appSub')}</p>
        </div>
        <div className="flex flex-none gap-2">
          <button
            data-testid="lang-toggle"
            onClick={() => updateSettings({ lang: lang === 'ar' ? 'en' : 'ar' })}
            aria-label={t('language')}
            className="h-12 min-w-12 rounded-xl border border-line bg-card px-3 text-sm font-bold"
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>
          <a
            href="#/settings"
            aria-label={t('settings')}
            className={`flex h-12 w-12 items-center justify-center rounded-xl border border-line text-xl ${
              current === 'settings' ? 'bg-accent text-onaccent' : 'bg-card'
            }`}
          >
            ⚙
          </a>
        </div>
      </header>

      <main className="px-4 pt-2">
        {current === '' && <Home />}
        {current === 'week' && <Week />}
        {current === 'workout' && <Workout key={`${settings.profile}:${workoutDay}`} dayId={workoutDay} />}
        {current === 'history' && <History />}
        {current === 'settings' && <Settings />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          {tabs.map((tab) => (
            <a
              key={tab.id}
              href={tab.href}
              aria-current={current === tab.id ? 'page' : undefined}
              className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold ${
                current === tab.id ? 'text-accent' : 'text-muted'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {icons[tab.icon]}
              </svg>
              {tab.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
