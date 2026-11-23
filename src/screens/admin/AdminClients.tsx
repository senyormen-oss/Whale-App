import { useMemo, useState } from 'react'
import { useToast } from '../../toast'
import { useI18n, formatDate, formatNumber } from '../../i18n'
import { localizeService } from '../../data'
import { adminSetPackage, type AdminRequest, type PackageInfo } from '../../lib/admin'
import Sheet from '../../Sheet'
import NoteEditor from './NoteEditor'
import { STATUS_COLORS, smallBtn, statusLabelKey } from './AdminRequests'
import { Loader2, Phone, Search } from '../../icons'

interface ClientRow {
  userId: string
  name: string
  phone: string
  requests: AdminRequest[]
  completedTotal: number
  lastAt: string
  packages: PackageInfo[]
}

function PackageLine({ pkg, onChanged }: { pkg: PackageInfo; onChanged: () => void }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  async function act(status: 'active' | 'cancelled', extend = 0) {
    setBusy(true)
    try {
      await adminSetPackage(pkg.id, status, extend)
      notify(t('admin.updated'), 'success')
      onChanged()
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--fg-rgb),0.05)', marginBottom: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
        {localizeService(pkg.plan)} · {t('pkg.sessionsUsed', { used: pkg.used, total: pkg.planTotal })}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>
        {t(`pkg.${pkg.status}` as 'pkg.active')}{pkg.expiresAt ? ` · ${t('pkg.until', { date: formatDate(pkg.expiresAt) })}` : ''}
      </p>
      {(pkg.status === 'active' || pkg.status === 'pending') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {pkg.status === 'active' && <button disabled={busy} onClick={() => act('active', 30)} style={{ ...smallBtn, padding: '6px 12px', background: 'rgba(10,186,181,0.15)', color: 'var(--accent-text)' }}>{t('admin.extend')}</button>}
          <button disabled={busy} onClick={() => act('cancelled')} style={{ ...smallBtn, padding: '6px 12px', background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }}>{t('admin.cancelPackage')}</button>
        </div>
      )}
    </div>
  )
}

/** CRM view of everyone who sent a request: history, packages and internal notes. */
export default function AdminClients({ requests }: { requests: AdminRequest[] | null }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const clients = useMemo<ClientRow[]>(() => {
    const map = new Map<string, ClientRow>()
    for (const r of requests ?? []) {
      const row = map.get(r.userId) ?? { userId: r.userId, name: r.clientName, phone: '', requests: [], completedTotal: 0, lastAt: r.createdAt, packages: [] }
      row.requests.push(r)
      if (!row.phone && r.phone) row.phone = r.phone
      if (r.status === 'completed' && r.currency === 'UZS') row.completedTotal += r.amount
      if (r.createdAt > row.lastAt) row.lastAt = r.createdAt
      if (r.package && !row.packages.some(p => p.id === r.package!.id)) row.packages.push(r.package)
      map.set(r.userId, row)
    }
    return Array.from(map.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
  }, [requests])

  const q = query.trim().toLowerCase()
  const shown = q ? clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')) : clients
  const open = clients.find(c => c.userId === openId) ?? null

  return (
    <>
      <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 14 }}>
        <Search size={15} color="rgba(var(--fg-rgb),calc(0.5 * var(--tb)))" strokeWidth={1.8} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('admin.search')} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 15, fontFamily: 'Outfit, sans-serif' }} />
      </div>

      {requests === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
      {requests !== null && shown.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{t('admin.noClients')}</p>
      )}

      {shown.map(c => (
        <button key={c.userId} onClick={() => setOpenId(c.userId)} className="glass pop-in" style={{ borderRadius: 16, padding: '12px 14px', textAlign: 'left', width: '100%', color: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
            <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', flexShrink: 0 }}>{formatDate(c.lastAt)}</span>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>
            {c.phone || '—'} · {t('admin.requestsCount', { n: c.requests.length })}
            {c.completedTotal > 0 && <> · {formatNumber(c.completedTotal)} {t('common.uzs')}</>}
          </p>
        </button>
      ))}

      {open && (
        <Sheet title={open.name} onClose={() => setOpenId(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {open.phone && (
              <a href={`tel:${open.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: 'var(--accent-text)', textDecoration: 'none' }}>
                <Phone size={16} strokeWidth={2.2} /> {open.phone}
              </a>
            )}
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))' }}>
              {t('admin.requestsCount', { n: open.requests.length })} · {t('admin.completedTotal')}: {formatNumber(open.completedTotal)} {t('common.uzs')}
            </p>

            {open.packages.length > 0 && (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('admin.packages')}</p>
                {open.packages.map(p => <PackageLine key={p.id} pkg={p} onChanged={() => setOpenId(null)} />)}
              </div>
            )}

            <div>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('admin.history')}</p>
              {open.requests.slice(0, 15).map(r => {
                const sc = STATUS_COLORS[r.status]
                return (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{r.specialistName}</p>
                      <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{formatDate(r.date)}, {r.slot} · {localizeService(r.service)}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, alignSelf: 'center' }}>{t(statusLabelKey(r.status))}</span>
                  </div>
                )
              })}
            </div>

            <NoteEditor kind="client" keyId={open.userId} />
          </div>
        </Sheet>
      )}
    </>
  )
}
