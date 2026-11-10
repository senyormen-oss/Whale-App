import { useState } from 'react'
import { useToast } from '../../toast'
import { useI18n, formatDate, formatNumber } from '../../i18n'
import { useConfirm } from '../../confirm'
import { localizeService } from '../../data'
import { adminSetOrderStatus, type AdminRequest } from '../../lib/admin'
import Sheet from '../../Sheet'
import NoteEditor from './NoteEditor'
import { Loader2, Phone, MessageSquareText } from '../../icons'

type Filter = 'pending' | 'confirmed' | 'all'

export const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending: { color: '#F5A623', bg: 'rgba(245,166,35,0.14)' },
  confirmed: { color: 'var(--accent-text)', bg: 'rgba(10,186,181,0.14)' },
  completed: { color: 'var(--ok)', bg: 'rgba(74,222,128,0.14)' },
  cancelled: { color: '#ff4d6d', bg: 'rgba(255,77,109,0.14)' },
}

export const smallBtn = { padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: 'none' } as const

export function statusLabelKey(status: string) {
  return (status === 'completed' ? 'status.done' : `status.${status}`) as 'status.pending'
}

export default function AdminRequests({ requests, onChanged }: { requests: AdminRequest[] | null; onChanged: () => void }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [filter, setFilter] = useState<Filter>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<AdminRequest | null>(null)

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
      onChanged()
    } catch (err) {
      const code = (err as { code?: string }).code
      notify(code === '23505' ? t('err.slotTaken') : t('err.updateSession'))
    } finally {
      setBusyId(null)
    }
  }

  const shown = (requests ?? []).filter(r => (filter === 'all' ? true : r.status === filter))

  return (
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
                {t(statusLabelKey(r.status))}
              </span>
            </div>
            <p style={{ margin: '0 0 2px', fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))' }}>
              {r.specialistName} · {formatDate(r.date)}, {r.slot}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>
              {localizeService(r.service)} · {formatNumber(r.amount)} {t('common.uzs')}
              {r.package && <> · <strong style={{ color: 'var(--accent-text)' }}>{t('admin.packageBadge', { used: r.package.used, total: r.package.planTotal })}</strong></>}
            </p>
            {r.note && (
              <p style={{ margin: '8px 0 0', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, background: 'rgba(var(--fg-rgb),0.05)', overflowWrap: 'anywhere' }}>{r.note}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {r.status === 'pending' && (
                <button disabled={busy} onClick={() => setStatus(r, 'confirmed')} style={{ ...smallBtn, background: '#0ABAB5', color: '#080808', opacity: busy ? 0.6 : 1 }}>{t('admin.confirm')}</button>
              )}
              {r.status === 'confirmed' && (
                <button disabled={busy} onClick={() => setStatus(r, 'completed')} style={{ ...smallBtn, background: 'rgba(74,222,128,0.18)', color: 'var(--ok)', opacity: busy ? 0.6 : 1 }}>{t('dash.markDone')}</button>
              )}
              {(r.status === 'pending' || r.status === 'confirmed') && (
                <button disabled={busy} onClick={() => setStatus(r, 'cancelled')} style={{ ...smallBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', opacity: busy ? 0.6 : 1 }}>{t('admin.reject')}</button>
              )}
              <button onClick={() => setNoteFor(r)} style={{ ...smallBtn, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MessageSquareText size={12} strokeWidth={2.2} /> {t('admin.noteFor')}
              </button>
            </div>
          </div>
        )
      })}

      {noteFor && (
        <Sheet title={`${noteFor.clientName} · ${formatDate(noteFor.date)}`} onClose={() => setNoteFor(null)}>
          <NoteEditor kind="order" keyId={noteFor.id} />
        </Sheet>
      )}
    </>
  )
}
