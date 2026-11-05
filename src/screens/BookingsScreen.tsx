import { useEffect, useState } from 'react'
import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { fetchMyReviewedOrderIds } from '../lib/queries'
import { useI18n, formatDate, formatNumber } from '../i18n'
import { useConfirm } from '../confirm'
import { localizeService } from '../data'
import ReviewModal from './ReviewModal'
import { ClipboardList, Star } from '../icons'

interface Props {
  onNavigate: (screen: Screen) => void
}

const STATUS_CONFIG: Record<string, { label: Parameters<typeof import('../i18n').t>[0]; color: string; bg: string }> = {
  pending:   { label: 'status.pending',   color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  confirmed: { label: 'status.confirmed', color: 'var(--accent-text)', bg: 'rgba(10,186,181,0.12)' },
  completed: { label: 'status.done',      color: 'var(--ok)', bg: 'rgba(74,222,128,0.12)' },
  cancelled: { label: 'status.cancelled', color: '#ff4d6d', bg: 'rgba(255,77,109,0.12)' },
}

const actionBtn = {
  padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
  fontFamily: 'Outfit, sans-serif',
} as const

export default function BookingsScreen({ onNavigate }: Props) {
  const { t } = useI18n()
  const confirm = useConfirm()
  const { orders, cancelOrder } = useAppStore()
  const { user } = useAuth()
  const { specialists, reload: reloadSpecialists } = useSpecialists()
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [reviewing, setReviewing] = useState<{ orderId: string; specialistId: string; name: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchMyReviewedOrderIds(user.id)
      .then(ids => setReviewed(new Set(ids)))
      .catch(err => console.error('Failed to load reviewed orders', err))
  }, [user, orders.length])

  async function handleCancel(orderId: string) {
    const ok = await confirm({ title: t('bookings.cancelTitle'), message: t('bookings.cancelText'), confirmLabel: t('bookings.cancelConfirm'), cancelLabel: t('bookings.keep'), danger: true })
    if (!ok) return
    setBusyId(orderId)
    await cancelOrder(orderId)
    setBusyId(null)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ padding: '56px 20px 20px', background: 'linear-gradient(180deg, var(--bg-header) 0%, var(--bg) 100%)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{t('bookings.title')}</h1>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px', color: 'rgba(var(--fg-rgb),0.4)' }}>
          <ClipboardList size={44} color="rgba(var(--fg-rgb),0.25)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <p>{t('bookings.empty')}</p>
        </div>
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(order => {
            const sp = specialists.find(s => s.id === order.specialistId)
            if (!sp) return null
            const status = STATUS_CONFIG[order.status]
            const canReview = order.status === 'completed' && !reviewed.has(order.id)
            const canCancel = order.status === 'pending' || order.status === 'confirmed'
            return (
              <div
                key={order.id}
                className="glass fade-up"
                style={{ borderRadius: 18, padding: '14px 16px', border: '1px solid rgba(var(--fg-rgb),0.08)' }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate({ name: 'specialist', id: sp.id })}
                  onKeyDown={e => e.key === 'Enter' && onNavigate({ name: 'specialist', id: sp.id })}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}
                >
                  <img src={sp.avatar} alt={sp.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--surface)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{sp.name}</p>
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(var(--fg-rgb),0.45)' }}>{localizeService(order.service)}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),0.3)' }}>{formatDate(order.date)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                      {formatNumber(order.amount)}
                    </p>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: status.bg, color: status.color }}>
                      {t(status.label)}
                    </span>
                  </div>
                </div>

                {(canReview || canCancel) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                    {canReview && (
                      <button
                        onClick={() => setReviewing({ orderId: order.id, specialistId: sp.id, name: sp.name })}
                        style={{ ...actionBtn, background: '#0ABAB5', color: '#080808', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Star size={12} fill="#080808" strokeWidth={0} /> {t('bookings.review')}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={busyId === order.id}
                        style={{ ...actionBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', opacity: busyId === order.id ? 0.6 : 1 }}
                      >
                        {busyId === order.id ? t('bookings.cancelling') : t('bookings.cancel')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          orderId={reviewing.orderId}
          specialistId={reviewing.specialistId}
          specialistName={reviewing.name}
          onClose={() => setReviewing(null)}
          onSubmitted={() => {
            setReviewed(prev => new Set(prev).add(reviewing.orderId))
            setReviewing(null)
            reloadSpecialists() // rating/review count are recalculated by the database
          }}
        />
      )}
    </div>
  )
}
