import { useCallback, useEffect, useState } from 'react'
import { useI18n, formatDate } from '../../i18n'
import { useToast } from '../../toast'
import { useConfirm } from '../../confirm'
import { fetchUsers, setBlocked, type AdminUser } from '../../lib/adminExtra'
import { smallBtn } from './AdminRequests'
import { Loader2, Search, Phone, Mail } from '../../icons'

/** All accounts with search, and blocking / unblocking with a reason. */
export default function AdminUsers() {
  const { t } = useI18n()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback((q: string) => {
    fetchUsers(q).then(setUsers).catch(err => { console.error(err); setUsers([]) })
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => load(query.trim()), 300)
    return () => window.clearTimeout(id)
  }, [query, load])

  async function block(u: AdminUser) {
    setBusy(u.userId)
    try {
      await setBlocked(u.userId, true, reason.trim())
      notify(t('adminUsers.blocked'), 'success')
      setReasonFor(null)
      setReason('')
      load(query.trim())
    } catch (err) {
      console.error(err)
      const msg = (err as { message?: string }).message ?? ''
      notify(/admin role/i.test(msg) ? t('adminUsers.isAdmin') : /yourself/i.test(msg) ? t('adminUsers.self') : t('err.updateSession'))
    } finally {
      setBusy(null)
    }
  }

  async function unblock(u: AdminUser) {
    const ok = await confirm({ title: t('adminUsers.unblockTitle', { name: u.fullName || u.phone || u.email }), confirmLabel: t('adminUsers.unblock') })
    if (!ok) return
    setBusy(u.userId)
    try {
      await setBlocked(u.userId, false)
      notify(t('adminUsers.unblocked'), 'success')
      load(query.trim())
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14 }}>
        <Search size={15} color="rgba(var(--fg-rgb),calc(0.5 * var(--tb)))" strokeWidth={1.8} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('adminUsers.search')} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 15, fontFamily: 'Outfit, Onest, sans-serif' }} />
      </div>

      {users === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
      {users?.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('adminUsers.none')}</p>}

      <div className="card-grid" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(users ?? []).map(u => (
          <div key={u.userId} className="glass" style={{ borderRadius: 16, padding: '12px 14px', border: u.blocked ? '1px solid rgba(255,77,109,0.4)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>{u.fullName || t('common.client')}</p>
                {u.phone && <a href={`tel:+${u.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--accent-text)', textDecoration: 'none' }}><Phone size={12} /> +{u.phone}</a>}
                {u.email && <p style={{ margin: '2px 0 0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, overflowWrap: 'anywhere' }}><Mail size={12} /> {u.email}</p>}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {u.isAdmin && <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800, background: 'rgba(10,186,181,0.15)', color: 'var(--accent-text)' }}>{t('adminUsers.admin')}</span>}
                {u.blocked && <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800, background: 'rgba(255,77,109,0.15)', color: '#ff4d6d' }}>{t('adminUsers.blockedBadge')}</span>}
              </div>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>
              {t('adminUsers.since', { date: formatDate(u.createdAt) })} · {t('adminUsers.listings', { n: u.listings })} · {t('adminUsers.orders', { n: u.orders })}
            </p>
            {u.blocked && u.blockReason && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ff4d6d', overflowWrap: 'anywhere' }}>{u.blockReason}</p>}

            {reasonFor === u.userId ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2} placeholder={t('adminUsers.reason')} style={{ width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderRadius: 12, padding: '9px 11px', color: 'var(--ink)', fontSize: 13, fontFamily: 'Outfit, Onest, sans-serif', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={busy === u.userId} onClick={() => block(u)} style={{ ...smallBtn, background: '#ff4d6d', color: '#fff' }}>{t('adminUsers.block')}</button>
                  <button onClick={() => { setReasonFor(null); setReason('') }} style={{ ...smallBtn, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)' }}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : !u.isAdmin && (
              <div style={{ marginTop: 10 }}>
                {u.blocked
                  ? <button disabled={busy === u.userId} onClick={() => unblock(u)} style={{ ...smallBtn, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)' }}>{t('adminUsers.unblock')}</button>
                  : <button onClick={() => setReasonFor(u.userId)} style={{ ...smallBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }}>{t('adminUsers.block')}</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
