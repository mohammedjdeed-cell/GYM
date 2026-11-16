import { DAY_IDS, PROFILES, getDay, type ProfileKey } from '../data/plan'
import { locale, num } from '../i18n'
import {
  draftKey,
  draftSetsDone,
  sessionsOf,
  suggestedDay,
  thisWeek,
  updateSettings,
  useStore,
  useT,
  weekStreak,
} from '../store'
import { Card, De } from '../components/ui'

export function Home() {
  const { settings, sessions, drafts } = useStore()
  const t = useT()
  const { lang, profile } = settings
  const now = new Date()

  const week = thisWeek(sessions, profile, now)
  const doneDays = new Set(week.map((s) => s.dayId))
  const weekCount = Math.min(3, doneDays.size)
  // an unfinished workout takes priority over the suggestion
  const inProgress = DAY_IDS.find((d) => draftSetsDone(drafts[draftKey(profile, d)]) > 0)
  const dayId = inProgress ?? suggestedDay(sessions, profile, now)
  const day = getDay(dayId)

  return (
    <>
      <h2 className="mb-2 mt-1 text-sm font-bold text-muted">{t('whoTrains')}</h2>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {(Object.keys(PROFILES) as ProfileKey[]).map((p) => (
          <button
            key={p}
            data-testid={`profile-${p}`}
            aria-pressed={profile === p}
            onClick={() => updateSettings({ profile: p })}
            className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 text-lg font-extrabold ${
              profile === p ? 'border-accent bg-accent text-onaccent' : 'border-line bg-card text-ink'
            }`}
          >
            <span className="text-2xl" aria-hidden>{p === 'mai' ? '🏋️‍♀️' : '🏋️‍♂️'}</span>
            {PROFILES[p][lang]}
          </button>
        ))}
      </div>

      <Card className="mb-4 !bg-soft !border-transparent">
        <div className="text-sm font-bold text-muted">
          {inProgress ? t('continueWorkout') : t('todaySuggested')} ·{' '}
          {new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
        </div>
        <h2 className="mt-1 text-xl font-extrabold" data-testid="suggested-day">{day.title[lang]}</h2>
        <De className="text-sm">{day.de}</De>
        <a
          href={`#/workout/${dayId}`}
          data-testid="start-workout"
          className="mt-3 flex min-h-14 items-center justify-center rounded-2xl bg-accent text-lg font-extrabold text-onaccent"
        >
          {inProgress ? t('continueWorkout') : t('startWorkout')}
        </a>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{t('weekProgress')}</h3>
          <span className="text-sm font-bold text-muted" data-testid="week-count">
            {t('sessionsOf', { a: weekCount, b: 3 })}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DAY_IDS.map((d, i) => {
            const done = doneDays.has(d)
            return (
              <div
                key={d}
                className={`rounded-xl border p-2 text-center ${
                  done ? 'border-accent bg-accent text-onaccent' : 'border-line bg-bg text-muted'
                }`}
              >
                <div className="text-lg font-extrabold">{done ? '✓' : num(i + 1, lang)}</div>
                <div className="text-xs font-semibold leading-tight">{getDay(d).short[lang]}</div>
              </div>
            )
          })}
        </div>
        {weekCount === 3 && <p className="mt-3 text-center font-bold text-accent">{t('weekDone')}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-3xl font-extrabold text-accent">🔥 {num(weekStreak(sessions, profile, now), lang)}</div>
          <div className="text-sm font-semibold text-muted">{t('streak')}</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-extrabold text-accent">{num(sessionsOf(sessions, profile).length, lang)}</div>
          <div className="text-sm font-semibold text-muted">{t('totalSessions')}</div>
        </Card>
      </div>
    </>
  )
}
