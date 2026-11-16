import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../store'

/**
 * Bottom sheet. Closes by: swipe down on the header, tapping the backdrop, the ✕ button,
 * Escape, or the Android back button. Opening pushes a history entry so "back" closes the
 * sheet instead of leaving the app.
 */
export function Sheet({ title, sub, onClose, children }: {
  title: ReactNode
  sub?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const t = useT()
  const [dy, setDy] = useState(0)
  const startY = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const requestClose = () => {
    if (history.state?.sheet) history.back() // the popstate handler below does the actual close
    else onCloseRef.current()
  }

  useEffect(() => {
    if (!history.state?.sheet) history.pushState({ sheet: true }, '')
    const onPop = () => onCloseRef.current()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="sheet-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={requestClose} data-testid="sheet-backdrop" />
      <div
        data-testid="sheet"
        className="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-[28px] border-t border-line bg-surface shadow-2xl"
        style={dy ? { transform: `translateY(${dy}px)`, animation: 'none' } : undefined}
      >
        <div
          data-testid="sheet-grab"
          className="flex-none touch-none select-none px-4 pb-2 pt-2"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            startY.current = e.clientY
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* capture is a nicety; dragging still works without it */
            }
          }}
          onPointerMove={(e) => {
            if (startY.current != null) setDy(Math.max(0, e.clientY - startY.current))
          }}
          onPointerUp={() => {
            if (startY.current == null) return
            startY.current = null
            if (dy > 90) requestClose()
            else setDy(0)
          }}
          onPointerCancel={() => {
            startY.current = null
            setDy(0)
          }}
        >
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug">{title}</h2>
              {sub}
            </div>
            <button
              onClick={requestClose}
              aria-label={t('close')}
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-surface2 text-xl text-muted"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
