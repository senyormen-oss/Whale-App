import { useEffect, useState } from 'react'
import { useI18n, formatNumber } from '../../i18n'
import { fetchStats, type AdminStats as Stats } from '../../lib/adminExtra'
import { Loader2 } from '../../icons'

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="glass" style={{ borderRadius: 16, padding: '14px 14px' }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>{label}</p>
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--accent-text)', fontWeight: 700 }}>{hint}</p>}
    </div>
  )
}

/** Key numbers for the Whale team: users, listings, requests, money, complaints. */
export default function AdminStats() {
  const { t } = useI18n()
  const [s, setS] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchStats().then(setS).catch(err => { console.error(err); setError(true) })
  }, [])

  if (error) return <p style={{ margin: 0, fontSize: 13, color: '#ff4d6d' }}>{t('err.updateSession')}</p>
  if (!s) return <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />

  const orders = s.orders ?? {}
  const listings = s.listings ?? {}
  const maxDay = Math.max(1, ...s.orders_by_day.map(d => d.n))

  return (
    <>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Tile label={t('adminStats.users')} value={formatNumber(s.users_total)} hint={t('adminStats.new30', { n: s.users_30d })} />
        <Tile label={t('adminStats.listingsLive')} value={formatNumber(s.listings_published)} hint={listings.pending ? t('adminStats.onReview', { n: listings.pending }) : undefined} />
        <Tile label={t('adminStats.orders30')} value={formatNumber(s.orders_30d)} hint={t('adminStats.week', { n: s.orders_7d })} />
        <Tile label={t('adminStats.revenue')} value={`${formatNumber(Math.round(s.revenue_uzs / 1000) * 1000)} ${t('common.uzs')}`} hint={s.revenue_usd ? `+ $${formatNumber(s.revenue_usd)}` : undefined} />
      </div>

      <div className="glass" style={{ borderRadius: 16, padding: 14 }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800 }}>{t('adminStats.ordersByDay')}</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
          {s.orders_by_day.map(d => (
            <div key={d.day} title={`${d.day}: ${d.n}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{d.n || ''}</span>
              <div style={{ width: '100%', height: `${Math.max(d.n ? 8 : 2, (d.n / maxDay) * 64)}px`, borderRadius: 4, background: d.n ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.1)' }} />
              <span style={{ fontSize: 9, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Tile label={t('status.pending')} value={orders.pending ?? 0} />
        <Tile label={t('status.confirmed')} value={orders.confirmed ?? 0} />
        <Tile label={t('status.done')} value={orders.completed ?? 0} />
        <Tile label={t('status.cancelled')} value={orders.cancelled ?? 0} />
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <Tile label={t('adminStats.reportsNew')} value={s.reports_new} />
        <Tile label={t('adminStats.reviews')} value={s.reviews} />
        <Tile label={t('adminStats.blocked')} value={s.blocked} />
        <Tile label={t('adminStats.new7')} value={s.users_7d} />
      </div>

      {s.top_specialists.length > 0 && (
        <div className="glass" style={{ borderRadius: 16, padding: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>{t('adminStats.top')}</p>
          {s.top_specialists.map((x, i) => (
            <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)', fontSize: 13 }}>
              <span>{i + 1}. {x.name}</span>
              <span style={{ fontWeight: 700 }}>{t('adminStats.topLine', { orders: x.orders, done: x.completed })}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
