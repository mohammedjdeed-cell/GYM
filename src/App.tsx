import { useEffect, useState } from 'react'
import { DAY_IDS, PROFILES, type DayId } from './data/plan'
import { suggestedDay, useStore, useT } from './store'
import { Home } from './screens/Home'
import { Week } from './screens/Week'
import { Workout } from './screens/Workout'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import { HeaderButtons } from './components/HeaderButtons'
import { Login, Setup, Splash } from './screens/Gate'
import { Icon, haptic } from './components/ui'

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

/** Status-bar colour follows the active theme. */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

export default function App() {
  const { ready, settings, sessions, auth, schedule } = useStore()
  const t = useT()
  const [page, arg] = useRoute()
  const { lang, profile } = settings

  useEffect(() => {
    const html = document.documentElement
    html.lang = lang
    html.dir = lang === 'ar' ? 'rtl' : 'ltr'
    html.dataset.profile = profile
    document.title = t('appName')
    syncThemeColor()
  }, [lang, profile])

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', syncThemeColor)
    return () => mq.removeEventListener('change', syncThemeColor)
  }, [])

  if (!ready) return null
  if (auth.status === 'loading' || auth.memberStatus === 'loading') return <Splash />
  if (auth.status === 'out') return <Login />
  if (!auth.member) return <Setup />

  const workoutDay: DayId = DAY_IDS.includes(arg as DayId) ? (arg as DayId) : suggestedDay(sessions, profile, schedule[profile])
  const current = ['week', 'workout', 'history', 'settings'].includes(page) ? page : ''

  // the workout is a full-screen focus mode with its own controls
  if (current === 'workout') return <Workout key={`${profile}:${workoutDay}`} dayId={workoutDay} />

  const tabs = [
    { id: '', href: '#/', icon: 'home', label: t('navHome') },
    { id: 'week', href: '#/week', icon: 'calendar', label: t('navWeek') },
    { id: 'workout', href: `#/workout/${workoutDay}`, icon: 'dumbbell', label: t('navWorkout') },
    { id: 'history', href: '#/history', icon: 'history', label: t('navHistory') },
  ]
  const titles: Record<string, string> = {
    week: t('schedule'),
    history: `${t('history')} · ${PROFILES[profile][lang]}`,
    settings: t('settings'),
  }

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))]">
      {current !== '' && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-extrabold">{titles[current]}</h1>
          <HeaderButtons />
        </header>
      )}

      <main>
        {current === '' && <Home />}
        {current === 'week' && <Week />}
        {current === 'history' && <History />}
        {current === 'settings' && <Settings />}
      </main>

      <nav className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-20 mx-auto max-w-xl rounded-[28px] border border-line bg-surface/90 p-1.5 shadow-xl backdrop-blur-md">
        <div className="flex">
          {tabs.map((tab) => {
            const on = current === tab.id
            return (
              <a
                key={tab.id}
                href={tab.href}
                onClick={() => haptic(8)}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-extrabold transition-colors ${
                  on ? 'bg-soft text-accentink' : 'text-muted'
                }`}
              >
                <Icon name={tab.icon} className="h-6 w-6" />
                {tab.label}
              </a>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
