import { useEffect, useState } from 'react'
import type { Billing, Currency, ListingService, Tier } from '../types'
import { useI18n } from '../i18n'
import { useToast } from '../toast'
import { useConfirm } from '../confirm'
import { Select, Switch } from '../Controls'
import { formatServicePrice, serviceDetails } from '../data'
import { createService, deleteService, fetchServices, reorderServices, updateService, validateService, type ServiceInput } from '../lib/services'
import { ChevronDown, ChevronUp, Loader2, PenSquare, Receipt, Trash2 } from '../icons'

const MAX_SERVICES = 20
const TIERS: Tier[] = ['basic', 'standard', 'premium']
type Mode = 'tier' | 'single' | 'monthly'

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 12, padding: '11px 13px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, Onest, sans-serif', outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', marginBottom: 6, fontWeight: 600 }
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 10, border: 'none', background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--ink)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const subTitle: React.CSSProperties = { margin: '14px 0 8px', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\D/g, '')) || 0)

function draftFor(specialistId: string, mode: Mode, tierName: string, tier: Tier | null): ServiceInput {
  return {
    specialistId, title: mode === 'tier' ? tierName : '', description: '',
    billing: mode === 'monthly' ? 'monthly' : 'one_time', sessions: 5, price: null, priceFrom: false, currency: 'UZS',
    tier, quantity: null, shootDays: null, duration: '', terms: '',
  }
}

/** Form for one service. `mode` decides which fields make sense. */
function ServiceForm({ specialistId, service, mode, tier, position, onSaved, onCancel }: {
  specialistId: string
  service?: ListingService
  mode: Mode
  tier?: Tier
  position: number
  onSaved: (s: ListingService) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [d, setD] = useState<ServiceInput>(() =>
    service ? { ...service } : draftFor(specialistId, mode, tier ? t(`price.tier.${tier}` as 'price.tier.basic') : '', tier ?? null))
  const [priceText, setPriceText] = useState(service?.price != null ? String(service.price) : '')
  const [qtyText, setQtyText] = useState(service?.quantity != null ? String(service.quantity) : '')
  const [daysText, setDaysText] = useState(service?.shootDays != null ? String(service.shootDays) : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const draft: ServiceInput = {
      ...d,
      price: d.billing === 'quote' ? null : Number(priceText.replace(/\s/g, '')) || 0,
      quantity: num(qtyText),
      shootDays: mode === 'monthly' ? num(daysText) : null,
    }
    const problem = validateService(draft)
    if (problem) return setError(t(problem))
    setBusy(true)
    setError(null)
    try {
      onSaved(service ? await updateService(service.id, draft) : await createService(draft, position))
    } catch (err) {
      console.error('Failed to save service', err)
      const msg = (err as { message?: string }).message ?? ''
      const code = (err as { code?: string }).code
      setError(/Too many services/i.test(msg) ? t('price.errLimit') : `${t('price.failed')}${code ? ` (${code})` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const singleTypes: Billing[] = ['one_time', 'package', 'quote']

  return (
    <form onSubmit={submit} className="glass fade-in" style={{ borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(10,186,181,0.25)' }}>
      <div>
        <label style={labelStyle}>{t('price.serviceTitle')}</label>
        <input value={d.title} onChange={e => setD({ ...d, title: e.target.value })} maxLength={80} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>{mode === 'monthly' ? t('price.extras') : t('price.serviceDesc')}</label>
        <textarea value={d.description} onChange={e => setD({ ...d, description: e.target.value })} maxLength={300} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      {mode === 'single' && (
        <div>
          <label style={labelStyle}>{t('price.type')}</label>
          <Select<Billing>
            value={d.billing}
            onChange={billing => setD({ ...d, billing })}
            options={singleTypes.map(b => ({ value: b, label: t(`price.billing.${b}` as 'price.billing.one_time') }))}
            ariaLabel={t('price.type')}
          />
        </div>
      )}
      {mode === 'single' && d.billing === 'package' && (
        <div>
          <label style={labelStyle}>{t('price.sessionsCount')}</label>
          <input value={String(d.sessions)} onChange={e => setD({ ...d, sessions: Number(e.target.value.replace(/\D/g, '')) || 0 })} inputMode="numeric" maxLength={2} style={inputStyle} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: mode === 'monthly' ? '1fr 1fr' : '1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>{mode === 'monthly' ? t('price.quantityMonthly') : t('price.quantity')}</label>
          <input value={qtyText} onChange={e => setQtyText(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} style={inputStyle} />
        </div>
        {mode === 'monthly' && (
          <div>
            <label style={labelStyle}>{t('price.shootDays')}</label>
            <input value={daysText} onChange={e => setDaysText(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={2} style={inputStyle} />
          </div>
        )}
      </div>

      {d.billing !== 'quote' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
            <div>
              <label style={labelStyle}>{mode === 'monthly' ? t('price.monthlyPrice') : t('price.amount')}</label>
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

      {mode !== 'monthly' && (
        <div>
          <label style={labelStyle}>{t('price.duration')}</label>
          <input value={d.duration} onChange={e => setD({ ...d, duration: e.target.value })} maxLength={60} placeholder={t('price.durationPlaceholder')} style={inputStyle} />
        </div>
      )}
      <div>
        <label style={labelStyle}>{t('price.terms')}</label>
        <textarea value={d.terms} onChange={e => setD({ ...d, terms: e.target.value })} maxLength={500} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      {error && <p style={{ margin: 0, fontSize: 12.5, color: '#ff4d6d' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={busy} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 700 }}>{t('common.cancel')}</button>
        <button type="submit" disabled={busy} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 13.5, fontWeight: 800, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : t('price.save')}</button>
      </div>
    </form>
  )
}

/** "My services and tariffs" of one listing: three tariffs, one-off services and packages, monthly contracts. */
export default function PriceListEditor({ specialistId }: { specialistId: string }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<ListingService[] | null>(null)
  // 'new-single' | 'new-monthly' | 'new-tier:<tier>' | <service id>
  const [editing, setEditing] = useState<string | null>(null)
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
    setEditing(null)
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

  async function move(group: ListingService[], index: number, dir: -1 | 1) {
    if (!items) return
    const j = index + dir
    if (j < 0 || j >= group.length) return
    const a = group[index], b = group[j]
    const order = items.map(x => x.id)
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id)
    ;[order[ia], order[ib]] = [order[ib], order[ia]]
    setItems(order.map(id => items.find(x => x.id === id)!))
    setBusy(true)
    try {
      await reorderServices(order)
    } catch (err) {
      console.error(err)
      notify(t('price.failed'))
    } finally {
      setBusy(false)
    }
  }

  const list = items ?? []
  const singles = list.filter(s => !s.tier && s.billing !== 'monthly')
  const monthly = list.filter(s => s.billing === 'monthly')
  const full = list.length >= MAX_SERVICES

  function row(s: ListingService, group: ListingService[] | null, i: number, mode: Mode) {
    if (editing === s.id) {
      return <ServiceForm key={s.id} specialistId={specialistId} service={s} mode={mode} position={s.position} onSaved={saved} onCancel={() => setEditing(null)} />
    }
    const details = serviceDetails(s)
    return (
      <div key={s.id} className="glass" style={{ borderRadius: 14, padding: '12px 12px 12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {s.tier && <p style={{ margin: '0 0 2px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>{t(`price.tier.${s.tier}` as 'price.tier.basic')}</p>}
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>{s.title}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 700, color: 'var(--accent-text)' }}>
            {formatServicePrice(s)}
            {details && <span style={{ fontWeight: 500, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}> · {details}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {group && (
            <>
              <button type="button" style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }} disabled={busy || i === 0} onClick={() => move(group, i, -1)} aria-label="↑"><ChevronUp size={15} strokeWidth={2.2} /></button>
              <button type="button" style={{ ...iconBtn, opacity: i === group.length - 1 ? 0.3 : 1 }} disabled={busy || i === group.length - 1} onClick={() => move(group, i, 1)} aria-label="↓"><ChevronDown size={15} strokeWidth={2.2} /></button>
            </>
          )}
          <button type="button" style={iconBtn} disabled={busy} onClick={() => setEditing(s.id)} aria-label={t('price.edit')}><PenSquare size={14} strokeWidth={2} /></button>
          <button type="button" style={{ ...iconBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }} disabled={busy} onClick={() => remove(s)} aria-label={t('price.delete')}><Trash2 size={14} strokeWidth={2} /></button>
        </div>
      </div>
    )
  }

  const addBtn = (key: string, label: string) => (
    <button
      type="button"
      onClick={() => setEditing(key)}
      disabled={full}
      style={{ padding: '11px 0', borderRadius: 14, border: '1.5px dashed rgba(10,186,181,0.55)', background: 'rgba(10,186,181,0.07)', color: 'var(--accent-text)', fontSize: 13.5, fontWeight: 800, opacity: full ? 0.4 : 1 }}
    >
      + {label}
    </button>
  )

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Receipt size={16} color="var(--accent-text)" strokeWidth={2} /> {t('price.myServices')}
        {items && <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{items.length}/{MAX_SERVICES}</span>}
      </h2>
      {items === null && <Loader2 className="spin" size={18} color="var(--accent-text)" strokeWidth={2} />}
      {items && items.length === 0 && editing === null && (
        <p style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('price.editorHint')}</p>
      )}

      {items && (
        <>
          <p style={subTitle}>{t('price.tiers')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TIERS.map(tier => {
              const s = list.find(x => x.tier === tier)
              if (s) return row(s, null, 0, 'tier')
              if (editing === `new-tier:${tier}`) {
                return <ServiceForm key={tier} specialistId={specialistId} mode="tier" tier={tier} position={TIERS.indexOf(tier)} onSaved={saved} onCancel={() => setEditing(null)} />
              }
              return (
                <div key={tier} className="glass" style={{ borderRadius: 14, padding: '12px 12px 12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t(`price.tier.${tier}` as 'price.tier.basic')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{t('price.tierEmpty')}</p>
                  </div>
                  <button type="button" disabled={full} onClick={() => setEditing(`new-tier:${tier}`)} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 12, fontWeight: 800, opacity: full ? 0.4 : 1 }}>{t('price.fillTier')}</button>
                </div>
              )
            })}
          </div>

          <p style={subTitle}>{t('price.singles')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {singles.map((s, i) => row(s, singles, i, 'single'))}
            {editing === 'new-single'
              ? <ServiceForm specialistId={specialistId} mode="single" position={list.length} onSaved={saved} onCancel={() => setEditing(null)} />
              : addBtn('new-single', t('price.addSingle'))}
          </div>

          <p style={subTitle}>{t('price.monthlyTitle')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {monthly.map((s, i) => row(s, monthly, i, 'monthly'))}
            {editing === 'new-monthly'
              ? <ServiceForm specialistId={specialistId} mode="monthly" position={list.length} onSaved={saved} onCancel={() => setEditing(null)} />
              : addBtn('new-monthly', t('price.addMonthly'))}
          </div>
        </>
      )}
    </div>
  )
}
