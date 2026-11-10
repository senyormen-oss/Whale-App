import { useEffect, useState } from 'react'
import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { fetchMyReviewedOrderIds } from '../lib/queries'
import { useI18n, formatDate, formatNumber } from '../i18n'
import { useConfirm } from '../confirm'
import { fetchMyPackages, isPackageUsable } from '../lib/packages'
import type { PackageInfo } from '../lib/admin'
import { formatDate as fmtDate } from '../i18n'
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
  const [packages, setPackages] = useState<PackageInfo[]>([])

  useEffect(() => {
    if (!user) return
    fetchMyPackages(user.id).then(setPackages).catch(err => console.error('Failed to load packages', err))
  }, [user, orders])

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
    <div style={{ minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ padding: '56px 20px 20px', background: 'linear-gradient(180deg, var(--bg-header) 0%, transparent 100%)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{t('bookings.title')}</h1>
      </div>

      {packages.filter(p => p.status === 'active' || p.status === 'pending').length > 0 && (
        <div style={{ padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t('pkg.title')}</h2>
          {packages.filter(p => p.status === 'active' || p.status === 'pending').map(p => {
            const sp = specialists.find(s => s.id === p.specialistId)
            const usable = isPackageUsable(p)
            const expired = p.status === 'active' && !!p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()
            return (
              <div key={p.id} className="glass pop-in" style={{ borderRadius: 18, padding: 16, border: '1px solid rgba(10,186,181,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{sp?.name ?? '—'} · {localizeService(p.plan)}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: expired ? '#ff4d6d' : 'var(--accent-text)' }}>
                    {expired ? t('pkg.expired') : t('pkg.left', { n: p.planTotal - p.used })}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(var(--fg-rgb),0.1)', marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${(p.used / p.planTotal) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #0ABAB5, #08918d)', transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>
                  {p.status === 'pending' ? t('pkg.pending') : `${t('pkg.sessionsUsed', { used: p.used, total: p.planTotal })}${p.expiresAt ? ` · ${t('pkg.until', { date: fmtDate(p.expiresAt) })}` : ''}`}
                </p>
                {usable && sp && (
                  <button
                    onClick={() => onNavigate({ name: 'booking', specialistId: p.specialistId, packageId: p.id })}
                    className="tiffany-glow"
                    style={{ marginTop: 12, width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800 }}
                  >
                    {t('pkg.bookNext')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px', color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>
          <ClipboardList size={44} color="rgba(var(--fg-rgb),calc(0.25 * var(--tb)))" strokeWidth={1.5} style={{ marginBottom: 12 }} />
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
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{localizeService(order.service)}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.3 * var(--tb)))' }}>{formatDate(order.date)}</p>
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

                {order.status === 'pending' && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))' }}>
                    {t('bookings.pendingNote')}
                  </p>
                )}

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
