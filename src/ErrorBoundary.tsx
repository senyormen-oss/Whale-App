import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, WifiOff } from './icons'
import { t } from './i18n'

/** Catches render-time crashes so the user sees a recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center',
      }}>
        <AlertCircle size={44} color="#ff4d6d" strokeWidth={1.6} style={{ marginBottom: 16 }} />
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>{t('err.boundaryTitle')}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))', maxWidth: 300, lineHeight: 1.6 }}>
          {t('err.boundaryText')}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '14px 28px', borderRadius: 16, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800 }}
        >
          {t('app.reload')}
        </button>
      </div>
    )
  }
}

/** Slim banner shown while the device has no connection. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null
  return (
    <div
      role="status"
      className="slide-down"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000, padding: '8px 16px',
        background: '#F5A623', color: '#080808', fontSize: 12.5, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <WifiOff size={14} strokeWidth={2.4} /> {t('err.offline')}
    </div>
  )
}
