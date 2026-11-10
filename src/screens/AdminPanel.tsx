import { useCallback, useEffect, useState } from 'react'
import { subscribeToTables } from '../lib/realtime'
import { fetchAdminRequests, fetchAllSpecialists, type AdminRequest } from '../lib/admin'
import type { Specialist } from '../types'
import { useI18n } from '../i18n'
import Segmented from '../Segmented'
import AdminRequests from './admin/AdminRequests'
import AdminSpecialists from './admin/AdminSpecialists'
import AdminClients from './admin/AdminClients'
import AdminTeam from './admin/AdminTeam'

type Tab = 'requests' | 'specialists' | 'clients' | 'team'

/** Back-office (CRM) for the Whale team. All data access is enforced by the database, not by this screen. */
export default function AdminPanel() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('requests')
  const [requests, setRequests] = useState<AdminRequest[] | null>(null)
  const [specialists, setSpecialists] = useState<Specialist[] | null>(null)

  const load = useCallback(() => {
    fetchAdminRequests().then(setRequests).catch(err => { console.error(err); setRequests(prev => prev ?? []) })
    fetchAllSpecialists().then(setSpecialists).catch(err => { console.error(err); setSpecialists(prev => prev ?? []) })
  }, [])

  useEffect(() => {
    load()
    return subscribeToTables(['orders', 'specialists', 'packages'], load)
  }, [load])

  const pending = (requests ?? []).filter(r => r.status === 'pending').length
  const unapproved = (specialists ?? []).filter(s => !s.approved).length

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        fontSize={11.5}
        options={[
          { value: 'requests', label: `${t('admin.requests')}${pending ? ` ${pending}` : ''}` },
          { value: 'specialists', label: `${t('admin.specialists')}${unapproved ? ` ${unapproved}` : ''}` },
          { value: 'clients', label: t('admin.clients') },
          { value: 'team', label: t('admin.team') },
        ]}
      />

      {tab === 'requests' && <AdminRequests requests={requests} onChanged={load} />}
      {tab === 'specialists' && <AdminSpecialists specialists={specialists} onChanged={load} />}
      {tab === 'clients' && <AdminClients requests={requests} />}
      {tab === 'team' && <AdminTeam />}
    </div>
  )
}
