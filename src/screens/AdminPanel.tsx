import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../toast'
import { useI18n, formatDate, formatNumber } from '../i18n'
import { useConfirm } from '../confirm'
import { subscribeToTables } from '../lib/realtime'
import {
  fetchAdminRequests, adminSetOrderStatus, fetchAdminListings, adminSetListingApproved,
  type AdminRequest, type AdminListing,
} from '../lib/admin'
import { categoryLabel } from '../data'
import Segmented from '../Segmented'
import { Loader2, Phone, CheckCircle2, X } from '../icons'

type Tab = 'requests' | 'listings'
type Filter = 'pending' | 'confirmed' | 'all'

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending: { color: '#F5A623', bg: 'rgba(245,166,35,0.14)' },
  confirmed: { color: 'var(--accent-text)', bg: 'rgba(10,186,181,0.14)' },
  completed: { color: 'var(--ok)', bg: 'rgba(74,222,128,0.14)' },
  cancelled: { color: '#ff4d6d', bg: 'rgba(255,77,109,0.14)' },
}

const smallBtn = { padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: 'none' } as const

/** Back-office for the Whale team: incoming requests and listing approvals. */
export default function AdminPanel() {
  const { t } = useI18n()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('requests')
  const [filter, setFilter] = useState<Filter>('pending')
  const [requests, setRequests] = useState<AdminRequest[] | null>(null)
  const [listings, setListings] = useState<AdminListing[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchAdminRequests().then(setRequests).catch(err => { console.error(err); setRequests(prev => prev ?? []) })
    fetchAdminListings().then(setListings).catch(err => { console.error(err); setListings(prev => prev ?? []) })
  }, [])

  useEffect(() => {
    load()
    return subscribeToTables(['orders', 'specialists'], load)
  }, [load])

  async function setStatus(r: AdminRequest, status: 'confirmed' | 'completed' | 'cancelled') {
    if (status === 'cancelled') {
      const ok = await confirm({
        title: t('admin.cancelTitle'), message: t('admin.cancelText'),
        confirmLabel: t('bookings.cancelConfirm'), cancelLabel: t('bookings.keep'), danger: true,
      })
      if (!ok) return
    }
    setBusyId(r.id)
    try {
      await adminSetOrderStatus(r.id, status)
      notify(t('admin.updated'), 'success')
      load()
    } catch (err) {
      const code = (err as { code?: string }).code
      notify(code === '23505' ? t('err.slotTaken') : t('err.updateSession'))
    } finally {
      setBusyId(null)
    }
  }

  async function setApproved(l: AdminListing, approved: boolean) {
    setBusyId(l.id)
    try {
      await adminSetListingApproved(l.id, approved)
      notify(t('admin.updated'), 'success')
      load()
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    } finally {
      setBusyId(null)
    }
  }

  const shown = (requests ?? []).filter(r => (filter === 'all' ? true : r.status === filter))
  const pendingCount = (requests ?? []).filter(r => r.status === 'pending').length
  const unapproved = (listings ?? []).filter(l => !l.approved).length

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'requests', label: `${t('admin.requests')}${pendingCount ? ` · ${pendingCount}` : ''}` },
          { value: 'listings', label: `${t('admin.listings')}${unapproved ? ` · ${unapproved}` : ''}` },
        ]}
      />

      {tab === 'requests' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['pending', 'confirmed', 'all'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...smallBtn, background: filter === f ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)',
                  color: filter === f ? '#080808' : 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))', transition: 'all 0.2s ease',
                }}
              >
                {f === 'pending' ? t('admin.new') : f === 'confirmed' ? t('status.confirmed') : t('search.all')}
              </button>
            ))}
          </div>

          {requests === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
          {requests !== null && shown.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{t('admin.noRequests')}</p>
          )}

          {shown.map(r => {
            const sc = STATUS_COLORS[r.status]
            const busy = busyId === r.id
            return (
              <div key={r.id} className="glass pop-in" style={{ borderRadius: 18, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, overflowWrap: 'anywhere' }}>{r.clientName}</p>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 14, fontWeight: 700, color: 'var(--accent-text)', textDecoration: 'none' }}>
                        <Phone size={13} strokeWidth={2.2} /> {r.phone}
                      </a>
                    )}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, flexShrink: 0 }}>
                    {t(r.status === 'completed' ? 'status.done' : (`status.${r.status}` as 'status.pending'))}
                  </span>
                </div>
                <p style={{ margin: '0 0 2px', fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))' }}>
                  {r.specialistName} · {formatDate(r.date)}, {r.slot}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>
                  {r.service} · {formatNumber(r.amount)} {t('common.uzs')}
                </p>
                {r.note && (
                  <p style={{ margin: '8px 0 0', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, background: 'rgba(var(--fg-rgb),0.05)', overflowWrap: 'anywhere' }}>{r.note}</p>
                )}
                {(r.status === 'pending' || r.status === 'confirmed') && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {r.status === 'pending' && (
                      <button disabled={busy} onClick={() => setStatus(r, 'confirmed')} style={{ ...smallBtn, background: '#0ABAB5', color: '#080808', opacity: busy ? 0.6 : 1 }}>{t('admin.confirm')}</button>
                    )}
                    {r.status === 'confirmed' && (
                      <button disabled={busy} onClick={() => setStatus(r, 'completed')} style={{ ...smallBtn, background: 'rgba(74,222,128,0.18)', color: 'var(--ok)', opacity: busy ? 0.6 : 1 }}>{t('dash.markDone')}</button>
                    )}
                    <button disabled={busy} onClick={() => setStatus(r, 'cancelled')} style={{ ...smallBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', opacity: busy ? 0.6 : 1 }}>{t('admin.reject')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {tab === 'listings' && (
        <>
          {listings === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
          {listings !== null && listings.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{t('admin.noListings')}</p>
          )}
          {(listings ?? []).map(l => (
            <div key={l.id} className="glass pop-in" style={{ borderRadius: 18, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{l.name}</p>
                <span style={{ fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, color: l.approved ? 'var(--ok)' : '#F5A623' }}>
                  {l.approved && <CheckCircle2 size={12} strokeWidth={2.4} />}
                  {l.approved ? t('admin.approved') : t('admin.awaiting')}
                </span>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 12.5, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))' }}>
                {categoryLabel(l.categoryKey)} · {l.city} · {formatNumber(l.price)} {t('common.uzs')}
              </p>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', overflowWrap: 'anywhere' }}>{l.bio.slice(0, 160)}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {!l.approved ? (
                  <button disabled={busyId === l.id} onClick={() => setApproved(l, true)} style={{ ...smallBtn, background: '#0ABAB5', color: '#080808' }}>{t('admin.approve')}</button>
                ) : (
                  <button disabled={busyId === l.id} onClick={() => setApproved(l, false)} style={{ ...smallBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <X size={12} strokeWidth={2.4} /> {t('admin.hide')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
