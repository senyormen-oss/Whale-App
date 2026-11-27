import { useCallback, useEffect, useState } from 'react'
import { useI18n, formatDate } from '../../i18n'
import { useToast } from '../../toast'
import { useConfirm } from '../../confirm'
import { deleteReview, fetchAllReviews, type AdminReview } from '../../lib/adminExtra'
import { smallBtn } from './AdminRequests'
import { Loader2, Star } from '../../icons'

/** Latest reviews; the team can remove fake or abusive ones (the rating is recalculated). */
export default function AdminReviews() {
  const { t } = useI18n()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<AdminReview[] | null>(null)
  const [onlyLow, setOnlyLow] = useState(false)

  const load = useCallback(() => {
    fetchAllReviews().then(setItems).catch(err => { console.error(err); setItems([]) })
  }, [])
  useEffect(load, [load])

  async function remove(r: AdminReview) {
    const ok = await confirm({ title: t('adminReviews.deleteTitle'), message: r.text.slice(0, 160), confirmLabel: t('adminReviews.delete'), danger: true })
    if (!ok) return
    try {
      await deleteReview(r.id)
      setItems(prev => (prev ?? []).filter(x => x.id !== r.id))
      notify(t('adminReviews.deleted'), 'success')
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    }
  }

  const list = (items ?? []).filter(r => !onlyLow || r.rating <= 2)

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOnlyLow(false)} style={{ ...smallBtn, background: !onlyLow ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)', color: !onlyLow ? '#080808' : 'var(--ink)' }}>{t('adminReviews.all')}</button>
        <button onClick={() => setOnlyLow(true)} style={{ ...smallBtn, background: onlyLow ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)', color: onlyLow ? '#080808' : 'var(--ink)' }}>{t('adminReviews.low')}</button>
      </div>

      {items === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
      {items && list.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('adminReviews.none')}</p>}

      <div className="card-grid" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map(r => (
          <div key={r.id} className="glass" style={{ borderRadius: 16, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{r.specialistName}</strong>
              <span style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                {Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={12} color="#FFD700" fill="#FFD700" strokeWidth={0} />)}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{r.text}</p>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{r.authorName} · {formatDate(r.createdAt)}</p>
            <button onClick={() => remove(r)} style={{ ...smallBtn, marginTop: 10, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }}>{t('adminReviews.delete')}</button>
          </div>
        ))}
      </div>
    </>
  )
}
