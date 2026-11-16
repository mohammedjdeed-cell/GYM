import { useState } from 'react'
import { machineOf, youtubeSearchUrl, type Exercise } from '../data/plan'
import { useStore, useT } from '../store'
import { Sheet } from './Sheet'
import { De } from './ui'

export function VideoSheet({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const t = useT()
  const lang = useStore().settings.lang
  const online = navigator.onLine
  const search = youtubeSearchUrl(ex.videoQuery)
  return (
    <Sheet title={ex.name[lang]} sub={<De className="text-sm">{ex.de}</De>} onClose={onClose}>
      {ex.videoId && online ? (
        <>
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <iframe
              data-testid="video-frame"
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${ex.videoId}?rel=0&playsinline=1`}
              title={ex.name[lang]}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <a
            href={search}
            target="_blank"
            rel="noopener"
            className="mt-3 flex min-h-12 items-center justify-center text-sm font-semibold text-muted underline"
          >
            {t('otherVideos')}
          </a>
        </>
      ) : (
        <div className="py-4 text-center">
          <p className="mb-4 text-muted">{online ? t('noVideo') : t('offlineVideo')}</p>
          <a
            href={search}
            target="_blank"
            rel="noopener"
            data-testid="video-search"
            className="flex min-h-14 items-center justify-center rounded-2xl bg-ytsoft px-4 font-bold text-yt"
          >
            ▶ {t('searchYoutube')}
          </a>
        </div>
      )}
    </Sheet>
  )
}

const PlaceholderIcon = () => (
  <svg
    viewBox="0 0 64 64"
    className="h-16 w-16"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="6" y="14" width="52" height="38" rx="6" />
    <circle cx="32" cy="33" r="10" />
    <path d="M22 14l3-5h14l3 5" />
  </svg>
)

export function MachineSheet({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const t = useT()
  const lang = useStore().settings.lang
  const m = machineOf(ex)
  const [broken, setBroken] = useState(false)
  const title = m ? m.name[lang] : (ex.equipment?.[lang] ?? t('noMachine'))
  return (
    <Sheet
      title={title}
      sub={
        m ? (
          <span
            dir="ltr"
            data-testid="machine-model"
            className="mt-1 inline-block rounded-full bg-soft px-3 py-0.5 text-sm font-bold text-accent"
          >
            gym80 · {m.model}
          </span>
        ) : (
          ex.equipment && <De className="text-sm">{ex.equipment.de}</De>
        )
      }
      onClose={onClose}
    >
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-bg text-muted">
        {m && !broken ? (
          <img
            src={`${import.meta.env.BASE_URL}assets/machines/${m.photo}`}
            alt={`${m.name[lang]} – ${m.model}`}
            className="h-full w-full object-contain"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2" data-testid="machine-placeholder">
            <PlaceholderIcon />
            <span className="text-sm">{m ? t('photoMissing') : t('noMachine')}</span>
            {m && (
              <span dir="ltr" className="text-xs opacity-70">
                assets/machines/{m.photo}
              </span>
            )}
          </div>
        )}
      </div>

      <h3 className="mb-1 mt-4 text-sm font-bold text-muted">{m ? t('howToSetup') : t('howToDo')}</h3>
      <p data-testid="machine-setup">{ex.setup[lang]}</p>

      {m && (
        <a
          href={m.url}
          target="_blank"
          rel="noopener"
          className="mt-3 flex min-h-12 items-center text-sm font-semibold text-muted underline"
        >
          {t('openMachinePage')} ↗
        </a>
      )}
    </Sheet>
  )
}
