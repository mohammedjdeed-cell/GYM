import { useEffect, useRef, useState } from 'react'
import { num } from '../i18n'
import { useStore, useT } from '../store'
import { Ring, haptic } from './ui'

function beep() {
  try {
    const ctx = new AudioContext()
    const play = (at: number, f: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.25, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.35)
    }
    play(0, 880)
    play(0.4, 1175)
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* no audio – vibration is enough */
  }
}

/**
 * Rest countdown docked above the workout's action bar. `endAt` is a timestamp so it stays right
 * if the phone sleeps. Swipe it down (or tap Skip) to dismiss; −15 / +15 adjust it.
 */
export function RestTimer({ endAt, total, next, onAdjust, onDone }: {
  endAt: number
  total: number
  next: string
  onAdjust: (seconds: number) => void
  onDone: () => void
}) {
  const t = useT()
  const lang = useStore().settings.lang
  const [now, setNow] = useState(Date.now())
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  const left = Math.max(0, Math.ceil((endAt - now) / 1000))
  const over = left === 0

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!over) return
    haptic([300, 150, 300, 150, 500])
    beep()
    const id = setTimeout(onDone, 3500)
    return () => clearTimeout(id)
  }, [over])

  const clock = num(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, lang)

  return (
    <div
      data-testid="rest-timer"
      role="timer"
      className={`absolute inset-x-3 bottom-[calc(100%+.5rem)] z-30 touch-none rounded-[28px] border p-4 shadow-2xl backdrop-blur-md ${
        over ? 'pulse border-accent bg-accent text-onaccent' : 'border-line bg-surface/95'
      }`}
      style={dy ? { transform: `translateY(${dy}px)`, opacity: Math.max(0.3, 1 - dy / 160) } : undefined}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        start.current = e.clientY
      }}
      onPointerMove={(e) => {
        if (start.current != null) setDy(Math.max(0, e.clientY - start.current))
      }}
      onPointerUp={() => {
        if (start.current == null) return
        start.current = null
        if (dy > 60) onDone()
        else setDy(0)
      }}
      onPointerCancel={() => {
        start.current = null
        setDy(0)
      }}
    >
      <div className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-current opacity-20" />
      <div className="flex items-center gap-4">
        {over ? (
          <div className="flex h-24 w-24 flex-none items-center justify-center text-5xl">💪</div>
        ) : (
          <Ring value={(endAt - now) / (total * 1000)} size={96} stroke={8}>
            <span dir="ltr" className="text-2xl font-extrabold tabular-nums">{clock}</span>
          </Ring>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold">{over ? t('restOver') : t('rest')}</div>
          <div className={`truncate text-sm font-semibold ${over ? '' : 'text-muted'}`}>{next}</div>
          {!over && (
            <div className="mt-2 flex gap-2">
              <button onClick={() => { haptic(); onAdjust(-15) }} className="h-12 flex-1 rounded-xl bg-surface2 font-bold" dir="ltr">
                −{num(15, lang)}
              </button>
              <button onClick={() => { haptic(); onAdjust(15) }} className="h-12 flex-1 rounded-xl bg-surface2 font-bold" dir="ltr">
                +{num(15, lang)}
              </button>
              <button onClick={() => { haptic(); onDone() }} className="h-12 flex-[1.3] rounded-xl bg-accent font-bold text-onaccent">
                {t('skip')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
