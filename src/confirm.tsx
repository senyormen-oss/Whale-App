import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from './i18n'
import { AlertCircle } from './icons'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive. */
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Animated, translated replacement for window.confirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [closing, setClosing] = useState(false)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(opts => {
    setClosing(false)
    setOptions(opts)
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
    })
  }, [])

  function close(result: boolean) {
    setClosing(true)
    window.setTimeout(() => {
      setOptions(null)
      resolver.current?.(result)
      resolver.current = null
    }, 180)
  }

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={options.title}
          onClick={() => close(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
            opacity: closing ? 0 : 1, transition: 'opacity 0.18s ease', animation: 'fadeIn 0.2s ease both',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 340, borderRadius: 22, padding: 22, textAlign: 'center',
              background: 'var(--surface)', border: '1px solid rgba(var(--fg-rgb),0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              transform: closing ? 'scale(0.94)' : 'scale(1)', transition: 'transform 0.18s ease',
              animation: 'popIn 0.28s cubic-bezier(.22,.68,0,1.2) both',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: options.danger ? 'rgba(255,77,109,0.12)' : 'rgba(10,186,181,0.12)',
            }}>
              <AlertCircle size={24} color={options.danger ? '#ff4d6d' : '#0ABAB5'} strokeWidth={1.8} />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>{options.title}</h2>
            {options.message && (
              <p style={{ margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.55, color: 'rgba(var(--fg-rgb),0.6)' }}>{options.message}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: options.message ? 0 : 18 }}>
              <button
                autoFocus
                onClick={() => close(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)', fontSize: 14, fontWeight: 700 }}
              >
                {options.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                onClick={() => close(true)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 800,
                  background: options.danger ? '#ff4d6d' : '#0ABAB5', color: options.danger ? 'var(--ink)' : 'var(--bg)',
                }}
              >
                {options.confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
