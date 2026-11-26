import type { ListingService, Tier } from '../types'
import { useI18n } from '../i18n'
import { formatServicePrice, serviceDetails } from '../data'

const TIER_ORDER: Tier[] = ['basic', 'standard', 'premium']
const groupTitle = { margin: '14px 0 8px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' } as const

/**
 * A listing's price list as clients see it: the three tariffs as cards, one-off services and packages,
 * and monthly contracts as a separate offer. `selectedId` / `onPick` make it a chooser (booking screen).
 */
export default function PriceListView({ services, onPick, selectedId, disabled }: {
  services: ListingService[]
  onPick?: (s: ListingService) => void
  selectedId?: string | null
  disabled?: boolean
}) {
  const { t } = useI18n()
  const tiers = TIER_ORDER.map(tier => services.find(s => s.tier === tier)).filter((s): s is ListingService => !!s)
  const singles = services.filter(s => !s.tier && s.billing !== 'monthly')
  const monthly = services.filter(s => s.billing === 'monthly')

  const pickable = !!onPick && !disabled
  const card = (s: ListingService, big: boolean) => {
    const sel = selectedId === s.id
    const details = serviceDetails(s)
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => pickable && onPick!(s)}
        disabled={!pickable}
        style={{
          width: '100%', textAlign: 'left', borderRadius: 16, padding: big ? '14px 16px' : '12px 14px',
          border: `1px solid ${sel ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)'}`,
          background: sel ? 'linear-gradient(135deg, rgba(10,186,181,0.2) 0%, rgba(10,186,181,0.05) 100%)' : 'rgba(var(--fg-rgb),0.04)',
          color: 'var(--ink)', cursor: pickable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 4,
        }}
      >
        {s.tier && <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>{t(`price.tier.${s.tier}` as 'price.tier.basic')}</span>}
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <span style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>{s.title}</span>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--accent-text)', flexShrink: 0, textAlign: 'right' }}>{formatServicePrice(s)}</span>
        </span>
        {details && <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))' }}>{details}</span>}
        {s.description && <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))', overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{s.description}</span>}
        {s.terms && <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{s.terms}</span>}
      </button>
    )
  }

  return (
    <div>
      {tiers.length > 0 && (
        <>
          <p style={{ ...groupTitle, marginTop: 0 }}>{t('price.tiers')}</p>
          <div className="tier-grid">{tiers.map(s => card(s, true))}</div>
        </>
      )}
      {singles.length > 0 && (
        <>
          <p style={tiers.length ? groupTitle : { ...groupTitle, marginTop: 0 }}>{t('price.singles')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{singles.map(s => card(s, false))}</div>
        </>
      )}
      {monthly.length > 0 && (
        <>
          <p style={tiers.length || singles.length ? groupTitle : { ...groupTitle, marginTop: 0 }}>{t('price.monthlyTitle')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{monthly.map(s => card(s, true))}</div>
        </>
      )}
    </div>
  )
}
