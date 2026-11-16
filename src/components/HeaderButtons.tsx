import { updateSettings, useStore, useT } from '../store'
import { Icon, haptic } from './ui'

/** Language switch + settings, shown at the top of every main screen. */
export function HeaderButtons() {
  const t = useT()
  const lang = useStore().settings.lang
  return (
    <div className="flex flex-none gap-2">
      <button
        data-testid="lang-toggle"
        onClick={() => {
          haptic()
          updateSettings({ lang: lang === 'ar' ? 'en' : 'ar' })
        }}
        aria-label={t('language')}
        className="h-12 min-w-12 rounded-full bg-surface2 px-3 text-sm font-extrabold"
      >
        {lang === 'ar' ? 'EN' : 'ع'}
      </button>
      <a href="#/settings" aria-label={t('settings')} className="flex h-12 w-12 items-center justify-center rounded-full bg-surface2">
        <Icon name="settings" className="h-5 w-5" />
      </a>
    </div>
  )
}
