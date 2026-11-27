import { useEffect, useState } from 'react'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import { fetchMyBlock } from './lib/adminExtra'
import { AlertCircle } from './icons'

/** Tells a blocked user why most actions are unavailable (the database enforces the block). */
export default function BlockedBanner() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [block, setBlock] = useState<{ reason: string } | null>(null)

  useEffect(() => {
    setBlock(null)
    if (!user) return
    fetchMyBlock(user.id).then(setBlock).catch(() => {})
  }, [user])

  if (!block) return null
  return (
    <div role="alert" style={{ margin: '12px 16px 0', padding: '12px 14px', borderRadius: 14, background: 'rgba(255,77,109,0.12)', border: '1px solid rgba(255,77,109,0.35)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <AlertCircle size={18} color="#ff4d6d" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#ff4d6d' }}>{t('blocked.title')}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)' }}>{t('blocked.text')}</p>
        {block.reason && <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{t('blocked.reason', { reason: block.reason })}</p>}
      </div>
    </div>
  )
}
