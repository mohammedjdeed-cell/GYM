import { useState } from 'react'
import { machineOf, videosOf, youtubeSearchUrl, type Variant } from '../data/plan'
import { useStore, useT } from '../store'
import { Sheet } from './Sheet'
import { De, Icon, Segmented } from './ui'

export const machinePhotoUrl = (photo: string) => `${import.meta.env.BASE_URL}assets/machines/${photo}`

/** The machine's photo, or a neutral placeholder when there is no machine or no photo file yet. */
export function MachinePhoto({ ex, className = '' }: { ex: Variant; className?: string }) {
  const lang = useStore().settings.lang
  const m = machineOf(ex)
  const [broken, setBroken] = useState<string | null>(null)
  if (m && broken !== m.photo) {
    return (
      <div className={`flex items-center justify-center bg-photo ${className}`}>
        <img
          src={machinePhotoUrl(m.photo)}
          alt={`${m.name[lang]} – ${m.model}`}
          className="h-full w-full object-contain p-2"
          draggable={false}
          onError={() => setBroken(m.photo)}
        />
      </div>
    )
  }
  return (
    <div data-testid="machine-placeholder" className={`flex flex-col items-center justify-center gap-2 bg-surface2 text-muted ${className}`}>
      <Icon name="dumbbell" className="h-14 w-14" />
      <span className="px-4 text-center text-sm font-semibold">{m ? m.name[lang] : (ex.equipment?.[lang] ?? '')}</span>
    </div>
  )
}

export function VideoSheet({ ex, onClose }: { ex: Variant; onClose: () => void }) {
  const t = useT()
  const lang = useStore().settings.lang
  const online = navigator.onLine
  const search = youtubeSearchUrl(ex.videoQuery)
  const videos = videosOf(ex)
  const [pick, setPick] = useState(0)
  const video = videos[pick]
  return (
    <Sheet title={ex.name[lang]} sub={<De className="text-sm">{ex.de}</De>} onClose={onClose}>
      {videos.length > 1 && (
        <div className="mb-3">
          <Segmented
            value={pick}
            onChange={setPick}
            options={videos.map((v, i) => ({ value: i, label: v.kind === 'gym80' ? t('videoGym80') : t('videoHowto') }))}
          />
        </div>
      )}
      {video && online ? (
        <>
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <iframe
              key={video.id}
              data-testid="video-frame"
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&playsinline=1`}
              title={ex.name[lang]}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <p className="mt-2 text-xs text-muted">{video.kind === 'gym80' ? t('videoGym80Hint') : t('videoHowtoHint')}</p>
          <a href={search} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center text-sm font-semibold text-muted underline">
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
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-ytsoft px-4 font-bold text-yt"
          >
            <Icon name="play" className="h-5 w-5" /> {t('searchYoutube')}
          </a>
        </div>
      )}
    </Sheet>
  )
}

export function MachineSheet({ ex, onClose }: { ex: Variant; onClose: () => void }) {
  const t = useT()
  const lang = useStore().settings.lang
  const m = machineOf(ex)
  const title = m ? m.name[lang] : (ex.equipment?.[lang] ?? t('noMachine'))
  return (
    <Sheet
      title={title}
      sub={
        m ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span dir="ltr" data-testid="machine-model" className="inline-block rounded-full bg-soft px-3 py-0.5 text-sm font-bold text-accentink">
              gym80 · {m.model}
            </span>
            <De speak className="text-sm">{m.de}</De>
          </div>
        ) : (
          ex.equipment && <De speak className="text-sm">{ex.equipment.de}</De>
        )
      }
      onClose={onClose}
    >
      <MachinePhoto ex={ex} className="aspect-[4/3] w-full overflow-hidden rounded-3xl border border-line" />
      <h3 className="mb-1 mt-4 text-sm font-bold text-muted">{m ? t('howToSetup') : t('howToDo')}</h3>
      <p data-testid="machine-setup" className="text-[1.02rem] leading-relaxed">{ex.setup[lang]}</p>
      {m && <p className="mt-3 rounded-2xl bg-surface2 p-3 text-sm text-muted">{t('askStaff', { x: m.de })}</p>}
      {m?.url && (
        <a href={m.url} target="_blank" rel="noopener" className="mt-2 flex min-h-12 items-center text-sm font-semibold text-muted underline">
          {t('openMachinePage')} ↗
        </a>
      )}
    </Sheet>
  )
}
