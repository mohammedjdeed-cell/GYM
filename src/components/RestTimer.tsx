import { useEffect, useState } from 'react'
import { num } from '../i18n'
import { useStore, useT } from '../store'

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => void ctx.close()
  } catch {
    /* no audio – vibration is enough */
  }
}

/** Floating countdown. `endAt` is a timestamp so it stays correct if the phone sleeps. */
export function RestTimer({ endAt, total, onDone }: { endAt: number; total: number; onDone: () => void }) {
  const t = useT()
  const lang = useStore().settings.lang
  const [now, setNow] = useState(Date.now())
  const left = Math.max(0, Math.ceil((endAt - now) / 1000))
  const over = left === 0

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!over) return
    try {
      navigator.vibrate?.([300, 150, 300, 150, 500])
    } catch {
      /* vibration not supported */
    }
    beep()
    const id = setTimeout(onDone, 4000)
    return () => clearTimeout(id)
  }, [over])

  return (
    <div
      data-testid="rest-timer"
      role="timer"
      className={`fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl overflow-hidden rounded-2xl shadow-xl ${
        over ? 'bg-warn text-onwarn' : 'bg-accent text-onaccent'
      }`}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 px-4">
        <span className="font-bold">{over ? t('restOver') : t('rest')}</span>
        {!over && (
          <span dir="ltr" className="text-2xl font-extrabold tabular-nums">
            {num(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, lang)}
          </span>
        )}
        <button onClick={onDone} className="min-h-12 rounded-xl bg-black/15 px-4 font-bold">
          {over ? '✓' : t('skip')}
        </button>
      </div>
      {!over && (
        <div className="h-1.5 bg-black/20">
          <div
            className="h-full bg-white/80"
            style={{ width: `${Math.min(100, ((endAt - now) / (total * 1000)) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
