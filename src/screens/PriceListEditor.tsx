import { useEffect, useState } from 'react'
import type { Billing, Currency, ListingService } from '../types'
import { useI18n } from '../i18n'
import { useToast } from '../toast'
import { useConfirm } from '../confirm'
import { Select, Switch } from '../Controls'
import { formatServicePrice } from '../data'
import { createService, deleteService, fetchServices, reorderServices, updateService, validateService, type ServiceInput } from '../lib/services'
import { ChevronDown, ChevronUp, Loader2, PenSquare, Receipt, Trash2 } from '../icons'

const MAX_SERVICES = 20
const BILLINGS: Billing[] = ['one_time', 'package', 'monthly', 'quote']

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 12, padding: '11px 13px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', marginBottom: 6, fontWeight: 600 }
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 10, border: 'none', background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--ink)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

function emptyDraft(specialistId: string): ServiceInput {
  return { specialistId, title: '', description: '', billing: 'one_time', sessions: 5, price: null, priceFrom: false, currency: 'UZS' }
}

/** Form for one service: new (no `service`) or editing an existing one. */
function ServiceForm({ specialistId, service, onSaved, onCancel, position }: {
  specialistId: string
  service?: ListingService
  position: number
  onSaved: (s: ListingService) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [d, setD] = useState<ServiceInput>(() => (service ? { ...service } : emptyDraft(specialistId)))
  const [priceText, setPriceText] = useState(service?.price != null ? String(service.price) : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const draft: ServiceInput = { ...d, price: d.billing === 'quote' ? null : Number(priceText.replace(/\s/g, '')) || 0 }
    const problem = validateService(draft)
    if (problem) return setError(t(problem))
    setBusy(true)
    setError(null)
    try {
      onSaved(service ? await updateService(service.id, draft) : await createService(draft, position))
    } catch (err) {
      console.error('Failed to save service', err)
      const msg = (err as { message?: string }).message ?? ''
      setError(/Too many services/i.test(msg) ? t('price.errLimit') : `${t('price.failed')}${(err as { code?: string }).code ? ` (${(err as { code?: string }).code})` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass fade-in" style={{ borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(10,186,181,0.25)' }}>
      <div>
        <label style={labelStyle}>{t('price.serviceTitle')}</label>
        <input value={d.title} onChange={e => setD({ ...d, title: e.target.value })} maxLength={80} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>{t('price.serviceDesc')}</label>
        <textarea value={d.description} onChange={e => setD({ ...d, description: e.target.value })} maxLength={300} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div>
        <label style={labelStyle}>{t('price.billing')}</label>
        <Select<Billing>
          value={d.billing}
          onChange={billing => setD({ ...d, billing })}
          options={BILLINGS.map(b => ({ value: b, label: t(`price.billing.${b}` as 'price.billing.one_time') }))}
          ariaLabel={t('price.billing')}
        />
      </div>
      {d.billing === 'package' && (
        <div>
          <label style={labelStyle}>{t('price.sessionsCount')}</label>
          <input value={String(d.sessions)} onChange={e => setD({ ...d, sessions: Number(e.target.value.replace(/\D/g, '')) || 0 })} inputMode="numeric" maxLength={2} style={inputStyle} />
        </div>
      )}
      {d.billing !== 'quote' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
            <div>
              <label style={labelStyle}>{t('price.amount')}</label>
              <input value={priceText} onChange={e => setPriceText(e.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric" maxLength={13} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('price.currency')}</label>
              <Select<Currency>
                value={d.currency}
                onChange={currency => setD({ ...d, currency })}
                options={[{ value: 'UZS', label: t('common.uzs') }, { value: 'USD', label: 'USD $' }]}
                ariaLabel={t('price.currency')}
              />
            </div>
          </div>
          <Switch checked={d.priceFrom} onChange={priceFrom => setD({ ...d, priceFrom })}>{t('price.from')}</Switch>
        </>
      )}
      {error && <p style={{ margin: 0, fontSize: 12.5, color: '#ff4d6d' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={busy} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 700 }}>{t('common.cancel')}</button>
        <button type="submit" disabled={busy} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 13.5, fontWeight: 800, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : t('price.save')}</button>
      </div>
    </form>
  )
}

/** The price list of one listing: add, edit, delete and reorder services. Used by owners and administrators. */
export default function PriceListEditor({ specialistId }: { specialistId: string }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<ListingService[] | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchServices(specialistId)
      .then(list => { if (!cancelled) setItems(list) })
      .catch(err => { console.error('Failed to load price list', err); if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [specialistId])

  function saved(s: ListingService) {
    setItems(prev => {
      const list = prev ?? []
      return list.some(x => x.id === s.id) ? list.map(x => (x.id === s.id ? s : x)) : [...list, s]
    })
    setEditingId(null)
    notify(t('price.saved'), 'success')
  }

  async function remove(s: ListingService) {
    const ok = await confirm({ title: t('price.deleteTitle', { title: s.title }), confirmLabel: t('price.delete'), danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await deleteService(s.id)
      setItems(prev => (prev ?? []).filter(x => x.id !== s.id))
      notify(t('price.saved'), 'success')
    } catch (err) {
      console.error(err)
      notify(t('price.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items) return
    const next = [...items]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setItems(next)
    setBusy(true)
    try {
      await reorderServices(next.map(s => s.id))
    } catch (err) {
      console.error(err)
      notify(t('price.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Receipt size={16} color="var(--accent-text)" strokeWidth={2} /> {t('price.title')}
        {items && <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{items.length}/{MAX_SERVICES}</span>}
      </h2>
      {items === null && <Loader2 className="spin" size={18} color="var(--accent-text)" strokeWidth={2} />}
      {items && items.length === 0 && editingId !== 'new' && (
        <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('price.editorHint')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(items ?? []).map((s, i) =>
          editingId === s.id ? (
            <ServiceForm key={s.id} specialistId={specialistId} service={s} position={s.position} onSaved={saved} onCancel={() => setEditingId(null)} />
          ) : (
            <div key={s.id} className="glass" style={{ borderRadius: 14, padding: '12px 12px 12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>{s.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 700, color: 'var(--accent-text)' }}>
                  {formatServicePrice(s)}
                  <span style={{ fontWeight: 500, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>
                    {' · '}{s.billing === 'package' ? t('price.sessions', { n: s.sessions }) : t(`price.billing.${s.billing}` as 'price.billing.one_time')}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }} disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="↑"><ChevronUp size={15} strokeWidth={2.2} /></button>
                <button type="button" style={{ ...iconBtn, opacity: i === items!.length - 1 ? 0.3 : 1 }} disabled={busy || i === items!.length - 1} onClick={() => move(i, 1)} aria-label="↓"><ChevronDown size={15} strokeWidth={2.2} /></button>
                <button type="button" style={iconBtn} disabled={busy} onClick={() => setEditingId(s.id)} aria-label={t('price.edit')}><PenSquare size={14} strokeWidth={2} /></button>
                <button type="button" style={{ ...iconBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }} disabled={busy} onClick={() => remove(s)} aria-label={t('price.delete')}><Trash2 size={14} strokeWidth={2} /></button>
              </div>
            </div>
          ),
        )}

        {editingId === 'new' && (
          <ServiceForm specialistId={specialistId} position={items?.length ?? 0} onSaved={saved} onCancel={() => setEditingId(null)} />
        )}

        {items && editingId === null && items.length < MAX_SERVICES && (
          <button
            type="button"
            onClick={() => setEditingId('new')}
            style={{ padding: '12px 0', borderRadius: 14, border: '1.5px dashed rgba(10,186,181,0.55)', background: 'rgba(10,186,181,0.07)', color: 'var(--accent-text)', fontSize: 13.5, fontWeight: 800 }}
          >
            + {t('price.add')}
          </button>
        )}
      </div>
    </div>
  )
}
