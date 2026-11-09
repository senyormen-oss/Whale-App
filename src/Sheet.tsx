import { useEffect, type ReactNode } from 'react'
import { X } from './icons'
import { useI18n } from './i18n'

/** Bottom sheet with a dimmed backdrop; closes on backdrop tap and Escape. */
export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease both' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430, maxHeight: '92vh', overflowY: 'auto', borderRadius: '24px 24px 0 0', padding: '18px 18px 32px',
          background: 'var(--sheet)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderBottom: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            style={{ background: 'rgba(var(--fg-rgb),0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
