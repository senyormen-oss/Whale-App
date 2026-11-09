import { useState } from 'react'
import Sheet from '../Sheet'
import { useToast } from '../toast'
import { useI18n } from '../i18n'
import { createReport, type ReportReason } from '../lib/queries'
import { Check } from '../icons'

const REASONS: { value: ReportReason; key: 'report.spam' | 'report.fraud' | 'report.inappropriate' | 'report.fake' | 'report.other' }[] = [
  { value: 'spam', key: 'report.spam' },
  { value: 'fraud', key: 'report.fraud' },
  { value: 'inappropriate', key: 'report.inappropriate' },
  { value: 'fake', key: 'report.fake' },
  { value: 'other', key: 'report.other' },
]

/** Report a listing to the moderators (reviewed manually in the database). */
export default function ReportModal({ specialistId, specialistName, onClose }: { specialistId: string; specialistName: string; onClose: () => void }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    try {
      await createReport(specialistId, reason, details.trim().slice(0, 1000))
      notify(t('report.sent'), 'success')
      onClose()
    } catch (err) {
      console.error('Failed to send report', err)
      notify(t('report.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('report.title', { name: specialistName })} onClose={onClose}>
      <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {REASONS.map(r => {
          const active = reason === r.value
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setReason(r.value)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                border: `1px solid ${active ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.1)'}`,
                background: active ? 'rgba(10,186,181,0.12)' : 'rgba(var(--fg-rgb),0.04)', color: 'var(--ink)', fontSize: 14,
                transition: 'all 0.2s ease',
              }}
            >
              {t(r.key)}
              {active && <Check size={16} color="var(--accent-text)" strokeWidth={2.6} />}
            </button>
          )
        })}
      </div>
      <textarea
        value={details}
        onChange={e => setDetails(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t('report.details')}
        style={{ width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderRadius: 12, padding: '12px 14px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', resize: 'vertical' }}
      />
      <button
        onClick={send}
        disabled={busy}
        style={{ width: '100%', marginTop: 14, padding: '14px 0', borderRadius: 14, border: 'none', background: '#ff4d6d', color: '#fff', fontSize: 15, fontWeight: 800, opacity: busy ? 0.7 : 1 }}
      >
        {busy ? t('auth.sending') : t('report.send')}
      </button>
    </Sheet>
  )
}
