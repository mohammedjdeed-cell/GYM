import { PROFILES } from '../data/plan'
import { locale, num } from '../i18n'
import {
  connectCalendar,
  pendingCount,
  setWeightLogging,
  signOut,
  syncNow,
  updateSched,
  updateSettings,
  useStore,
  useT,
} from '../store'
import { Card, Segmented, Toggle } from '../components/ui'

export function Settings() {
  const { settings, sessions, sync, auth, cal, schedule } = useStore()
  const t = useT()
  const { lang, profile } = settings
  const pending = pendingCount(sessions)
  const sched = schedule[profile]
  const time = (at: number) => new Intl.DateTimeFormat(locale(lang), { timeStyle: 'short' }).format(at)

  return (
    <>
      <Card className="mb-3">
        <h3 className="mb-2 font-bold">{t('account')}</h3>
        <div className="flex items-center gap-3">
          {auth.user?.photo ? (
            <img src={auth.user.photo} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent font-extrabold text-onaccent">
              {PROFILES[profile][lang].slice(0, 2)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold" data-testid="signed-in-as">{t('signedInAs', { n: PROFILES[profile][lang] })}</div>
            <div className="truncate text-sm text-muted" dir="ltr">{auth.user?.email}</div>
          </div>
        </div>
        <button
          data-testid="sign-out"
          onClick={() => confirm(t('confirmSignOut')) && void signOut()}
          className="mt-3 min-h-12 w-full rounded-xl border border-line font-bold"
        >
          {t('signOut')}
        </button>
      </Card>

      <Card className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{t('calTitle')}</h3>
          <Toggle on={settings.calendar} onChange={(v) => updateSettings({ calendar: v })} label={t('calSyncOn')} />
        </div>
        <p className="text-sm text-muted">{t('calHint')}</p>
        {settings.calendar && (
          <>
            <label className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{t('gymTime')}</span>
              <input
                type="time"
                dir="ltr"
                value={settings.gymTime}
                onChange={(e) => e.target.value && updateSettings({ gymTime: e.target.value })}
                className="h-12 rounded-xl border border-line bg-bg px-3 text-base"
                data-testid="gym-time"
              />
            </label>
            <button
              data-testid="cal-update"
              onClick={() => void connectCalendar()}
              disabled={cal.status === 'syncing'}
              className="mt-3 min-h-12 w-full rounded-xl bg-accent font-bold text-onaccent disabled:opacity-50"
            >
              {cal.status === 'syncing' ? t('calSyncing') : t('calUpdate')}
            </button>
            <p className="mt-2 text-sm text-muted" data-testid="cal-status">
              {cal.status === 'ok'
                ? t('calOk', { t: time(cal.at) })
                : cal.status === 'needs-auth'
                  ? t('calNeeds', { n: cal.pending })
                  : cal.status === 'error'
                    ? t('calErr', { e: cal.error ?? '' })
                    : ''}
            </p>
            <p className="mt-1 text-xs text-muted">{t('calTokenNote')}</p>
          </>
        )}
      </Card>

      <Card className="mb-3">
        <h3 className="mb-2 font-bold">{t('membership')}</h3>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{t('fee')}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            dir="ltr"
            defaultValue={sched.price}
            onBlur={(e) => {
              const v = Number(e.target.value)
              if (v >= 0 && v !== sched.price) updateSched(profile, { price: v })
            }}
            className="h-12 w-28 rounded-xl border border-line bg-bg px-3 text-base"
            data-testid="fee"
          />
        </label>
        <label className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{t('since')}</span>
          <input
            type="date"
            dir="ltr"
            value={sched.since}
            onChange={(e) => e.target.value && updateSched(profile, { since: e.target.value })}
            className="h-12 rounded-xl border border-line bg-bg px-3 text-base"
            data-testid="since"
          />
        </label>
        <p className="mt-1 text-xs text-muted">{t('sinceHint')}</p>
      </Card>

      <Card className="mb-3">
        <h3 className="mb-2 font-bold">{t('language')}</h3>
        <Segmented
          value={lang}
          onChange={(v) => updateSettings({ lang: v })}
          options={[
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Card>

      <Card className="mb-3">
        <h3 className="font-bold">{t('restTimer')}</h3>
        <p className="mb-2 text-sm text-muted">{t('restTimerHint')}</p>
        <Segmented
          value={settings.rest}
          onChange={(v) => updateSettings({ rest: v })}
          options={[
            { value: 0, label: t('off') },
            { value: 60, label: `${num(60, lang)} ${t('sec')}` },
            { value: 90, label: `${num(90, lang)} ${t('sec')}` },
            { value: 120, label: `${num(120, lang)} ${t('sec')}` },
          ]}
        />
      </Card>

      <Card className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold">{t('weightLog')}</h3>
            <p className="text-sm text-muted">{t('weightLogHint')}</p>
          </div>
          <Toggle on={settings.weight[profile]} onChange={(v) => setWeightLogging(profile, v)} label={t('weightLog')} />
        </div>
      </Card>

      <Card>
        <h3 className="font-bold">{t('sync')}</h3>
        <p className="mt-1 text-sm text-muted">
          {t('household')}: <b dir="ltr">{settings.household}</b>
        </p>
        <button
          onClick={() => void syncNow()}
          disabled={sync.status === 'syncing'}
          className="mt-3 min-h-12 w-full rounded-xl border border-line bg-bg font-bold disabled:opacity-40"
        >
          {sync.status === 'syncing' ? t('syncing') : t('syncNow')}
        </button>
        <p className="mt-2 text-sm text-muted">
          {sync.status === 'error' ? t('syncErr', { e: sync.error ?? '' }) : sync.status === 'ok' ? t('syncOk', { t: time(sync.at) }) : ''}
          {pending > 0 && ` · ${t('pending', { n: pending })}`}
        </p>
      </Card>
    </>
  )
}
