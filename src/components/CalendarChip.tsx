import { connectCalendar, useStore, useT } from '../store'
import { Icon, haptic } from './ui'

/** Shown only when Google Calendar has changes waiting and needs one tap to get a fresh permission. */
export function CalendarChip() {
  const { cal } = useStore()
  const t = useT()
  if (cal.status !== 'needs-auth' && cal.status !== 'error') return null
  return (
    <button
      data-testid="cal-chip"
      onClick={() => {
        haptic()
        void connectCalendar()
      }}
      className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2 text-start active:scale-[.99]"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-soft text-accentink">
        <Icon name="calendar" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-bold">
        {cal.status === 'error' ? t('calErr', { e: cal.error ?? '' }) : t('calNeeds', { n: cal.pending })}
      </span>
      <span className="flex-none rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-onaccent">{t('calUpdate')}</span>
    </button>
  )
}
