import { useState } from 'react'
import { PROFILES, type ProfileKey } from '../data/plan'
import { locale, num } from '../i18n'
import { pendingCount, setWeightLogging, syncNow, updateSettings, useStore, useT } from '../store'
import { syncConfigured } from '../sync'
import { Card, Segmented, Toggle } from '../components/ui'

export function Settings() {
  const { settings, sessions, sync } = useStore()
  const t = useT()
  const { lang } = settings
  const [code, setCode] = useState(settings.household)
  const pending = pendingCount(sessions)

  return (
    <>

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
        <h3 className="font-bold">{t('weightLog')}</h3>
        <p className="text-sm text-muted">{t('weightLogHint')}</p>
        {(Object.keys(PROFILES) as ProfileKey[]).map((p) => (
          <div key={p} className="flex items-center justify-between border-b border-line py-1 last:border-0">
            <span className="font-semibold">{PROFILES[p][lang]}</span>
            <Toggle on={settings.weight[p]} onChange={(v) => setWeightLogging(p, v)} label={`${t('weightLog')} – ${PROFILES[p][lang]}`} />
          </div>
        ))}
      </Card>

      <Card>
        <h3 className="font-bold">{t('sync')}</h3>
        {!syncConfigured ? (
          <p className="mt-1 text-sm text-muted" data-testid="sync-off">{t('syncOffHint')}</p>
        ) : (
          <>
            <label className="mt-2 block text-sm font-semibold text-muted" htmlFor="household">{t('household')}</label>
            <div className="mt-1 flex gap-2">
              <input
                id="household"
                dir="ltr"
                autoCapitalize="none"
                autoCorrect="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-base"
              />
              <button
                onClick={() => {
                  updateSettings({ household: code.trim().toLowerCase() })
                  void syncNow()
                }}
                disabled={code.trim().length < 6}
                className="min-h-12 rounded-xl bg-accent px-4 font-bold text-onaccent disabled:opacity-40"
              >
                {t('save')}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">{t('householdHint')}</p>

            <button
              onClick={() => void syncNow()}
              disabled={settings.household.length < 6 || sync.status === 'syncing'}
              className="mt-3 min-h-12 w-full rounded-xl border border-line bg-bg font-bold disabled:opacity-40"
            >
              {sync.status === 'syncing' ? t('syncing') : t('syncNow')}
            </button>
            <p className="mt-2 text-sm text-muted">
              {settings.household.length < 6
                ? t('syncNeedCode')
                : sync.status === 'error'
                  ? t('syncErr', { e: sync.error ?? '' })
                  : sync.status === 'ok'
                    ? t('syncOk', { t: new Intl.DateTimeFormat(locale(lang), { timeStyle: 'short' }).format(sync.at) })
                    : ''}
              {pending > 0 && ` · ${t('pending', { n: pending })}`}
            </p>
          </>
        )}
      </Card>
    </>
  )
}
