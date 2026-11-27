import { useCallback, useEffect, useState } from 'react'
import { subscribeToTables } from '../lib/realtime'
import { fetchAdminRequests, fetchAllSpecialists, type AdminRequest } from '../lib/admin'
import { fetchStats } from '../lib/adminExtra'
import type { Specialist } from '../types'
import { useI18n } from '../i18n'
import AdminRequests from './admin/AdminRequests'
import AdminSpecialists from './admin/AdminSpecialists'
import AdminClients from './admin/AdminClients'
import AdminTeam from './admin/AdminTeam'
import AdminUsers from './admin/AdminUsers'
import AdminReports from './admin/AdminReports'
import AdminReviews from './admin/AdminReviews'
import AdminStats from './admin/AdminStats'

type Tab = 'requests' | 'specialists' | 'clients' | 'users' | 'reports' | 'reviews' | 'stats' | 'team'

/** Back-office (CRM) for the Whale team. All data access is enforced by the database, not by this screen. */
export default function AdminPanel() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('requests')
  const [requests, setRequests] = useState<AdminRequest[] | null>(null)
  const [specialists, setSpecialists] = useState<Specialist[] | null>(null)
  const [newReports, setNewReports] = useState(0)

  const load = useCallback(() => {
    fetchAdminRequests().then(setRequests).catch(err => { console.error(err); setRequests(prev => prev ?? []) })
    fetchAllSpecialists().then(setSpecialists).catch(err => { console.error(err); setSpecialists(prev => prev ?? []) })
    fetchStats().then(s => setNewReports(s.reports_new)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    return subscribeToTables(['orders', 'specialists', 'packages'], load)
  }, [load])

  const pending = (requests ?? []).filter(r => r.status === 'pending').length
  const unapproved = (specialists ?? []).filter(s => s.moderationStatus === 'pending').length

  const tabs: { value: Tab; label: string; badge?: number }[] = [
    { value: 'requests', label: t('admin.requests'), badge: pending },
    { value: 'specialists', label: t('admin.specialists'), badge: unapproved },
    { value: 'clients', label: t('admin.clients') },
    { value: 'users', label: t('adminUsers.title') },
    { value: 'reports', label: t('adminReports.title'), badge: newReports },
    { value: 'reviews', label: t('adminReviews.title') },
    { value: 'stats', label: t('adminStats.title') },
    { value: 'team', label: t('admin.team') },
  ]

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="hide-scrollbar" role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
        {tabs.map(x => {
          const on = tab === x.value
          return (
            <button
              key={x.value}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(x.value)}
              style={{
                flexShrink: 0, padding: '8px 13px', borderRadius: 18, border: 'none', fontSize: 12.5, fontWeight: 700,
                background: on ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.07)', color: on ? '#080808' : 'var(--ink)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {x.label}
              {!!x.badge && (
                <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? 'rgba(0,0,0,0.15)' : '#ff4d6d', color: on ? '#080808' : '#fff' }}>{x.badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'requests' && <AdminRequests requests={requests} onChanged={load} />}
      {tab === 'specialists' && <AdminSpecialists specialists={specialists} onChanged={load} />}
      {tab === 'clients' && <AdminClients requests={requests} />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'reports' && <AdminReports onOpenListing={() => setTab('specialists')} onChanged={load} />}
      {tab === 'reviews' && <AdminReviews />}
      {tab === 'stats' && <AdminStats />}
      {tab === 'team' && <AdminTeam />}
    </div>
  )
}
