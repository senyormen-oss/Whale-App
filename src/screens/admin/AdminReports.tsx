import { useCallback, useEffect, useState } from 'react'
import { useI18n, formatDate } from '../../i18n'
import { useToast } from '../../toast'
import { fetchReports, setReportStatus, type AdminReport, type ReportStatus } from '../../lib/adminExtra'
import { smallBtn } from './AdminRequests'
import { Loader2 } from '../../icons'

const COLORS: Record<ReportStatus, string> = { new: '#ff4d6d', reviewing: '#F5A623', resolved: 'var(--ok)', dismissed: 'rgba(var(--fg-rgb),0.5)' }

/** Complaints about listings: new first; mark as reviewing / resolved / dismissed. */
export default function AdminReports({ onOpenListing, onChanged }: { onOpenListing: (specialistId: string) => void; onChanged: () => void }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const [items, setItems] = useState<AdminReport[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const load = useCallback(() => {
    fetchReports().then(setItems).catch(err => { console.error(err); setItems([]) })
  }, [])
  useEffect(load, [load])

  async function set(r: AdminReport, status: ReportStatus) {
    setBusy(r.id)
    try {
      await setReportStatus(r.id, status)
      notify(t('admin.updated'), 'success')
      load()
      onChanged()
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    } finally {
      setBusy(null)
    }
  }

  const open = (items ?? []).filter(r => r.status === 'new' || r.status === 'reviewing')
  const closed = (items ?? []).filter(r => r.status === 'resolved' || r.status === 'dismissed')
  const list = showClosed ? closed : open

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowClosed(false)} style={{ ...smallBtn, background: !showClosed ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)', color: !showClosed ? '#080808' : 'var(--ink)' }}>{t('adminReports.open')} {open.length || ''}</button>
        <button onClick={() => setShowClosed(true)} style={{ ...smallBtn, background: showClosed ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)', color: showClosed ? '#080808' : 'var(--ink)' }}>{t('adminReports.closed')}</button>
      </div>

      {items === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
      {items && list.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('adminReports.none')}</p>}

      <div className="card-grid" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map(r => (
          <div key={r.id} className="glass" style={{ borderRadius: 16, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => onOpenListing(r.specialistId)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--accent-text)', fontSize: 14, fontWeight: 800, textAlign: 'left' }}>{r.specialistName}</button>
              <span style={{ fontSize: 11, fontWeight: 800, color: COLORS[r.status], flexShrink: 0 }}>{t(`adminReports.status.${r.status}` as 'adminReports.status.new')}</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700 }}>{t(`report.${r.reason}` as 'report.spam')}</p>
            {r.details && <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{r.details}</p>}
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>
              {formatDate(r.createdAt)} · {r.reporterName || t('common.client')}{r.reporterContact ? ` · ${r.reporterContact}` : ''}
            </p>
            {!showClosed && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {r.status === 'new' && <button disabled={busy === r.id} onClick={() => set(r, 'reviewing')} style={{ ...smallBtn, background: 'rgba(245,166,35,0.15)', color: '#C77F0A' }}>{t('adminReports.take')}</button>}
                <button disabled={busy === r.id} onClick={() => set(r, 'resolved')} style={{ ...smallBtn, background: '#0ABAB5', color: '#080808' }}>{t('adminReports.resolve')}</button>
                <button disabled={busy === r.id} onClick={() => set(r, 'dismissed')} style={{ ...smallBtn, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)' }}>{t('adminReports.dismiss')}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
