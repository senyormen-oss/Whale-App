import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, X } from './icons'
import { t as translate } from './i18n'

type ToastKind = 'error' | 'success' | 'info'
interface Toast { id: number; kind: ToastKind; message: string }

interface ToastApi {
  notify: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const notify = useCallback((message: string, kind: ToastKind = 'error') => {
    const id = nextId.current++
    setToasts(prev => [...prev.slice(-2), { id, kind, message }])
    window.setTimeout(() => dismiss(id), kind === 'error' ? 5500 : 3500)
  }, [dismiss])

  const api = useMemo(() => ({ notify }), [notify])

  const color = (k: ToastKind) => (k === 'error' ? '#ff4d6d' : k === 'success' ? 'var(--ok)' : '#0ABAB5')

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          width: 'calc(100% - 24px)', maxWidth: 406, display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="slide-down"
            style={{
              pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 14, background: 'var(--sheet)',
              border: `1px solid ${color(t.kind)}55`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              fontSize: 13, color: 'var(--ink)',
            }}
          >
            {t.kind === 'success'
              ? <CheckCircle2 size={17} color={color(t.kind)} strokeWidth={2} style={{ flexShrink: 0 }} />
              : <AlertCircle size={17} color={color(t.kind)} strokeWidth={2} style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label={translate('common.close')}
              style={{ background: 'none', border: 'none', color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', display: 'flex', padding: 2 }}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
