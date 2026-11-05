import { t, formatNumber } from './i18n'
import type { Key } from './locales/en'

// `label` is the canonical (English) value stored in the database; use categoryLabel() for display.
export const CATEGORIES = [
  { key: 'video',   label: 'Videographer',    color: '#E64D4D' },
  { key: 'mobile',  label: 'Mobilographer',   color: '#E6844D' },
  { key: 'smm',     label: 'SMM',             color: '#E6C94D' },
  { key: 'target',  label: 'Targeting',       color: '#4DE6A0' },
  { key: 'content', label: 'Content Creator', color: '#4DB5E6' },
  { key: 'blogger', label: 'Blogger',         color: '#844DE6' },
  { key: 'photo',   label: 'Photographer',    color: '#E64DA8' },
  { key: 'prog',    label: 'Programmer',      color: '#4D84E6' },
  { key: 'web',     label: 'Web Developer',   color: '#0ABAB5' },
  { key: 'design',  label: 'Designer',        color: '#C94DE6' },
  { key: 'model',   label: 'Model',           color: '#E6A44D' },
] as const

export function categoryLabel(key: string): string {
  return t(`cat.${key}` as Key)
}

// Booking packages. Prices are derived from the specialist's own per-session
// price (sessions x price, minus a bulk discount), so the amount charged always
// matches what the specialist advertises.
const PLAN_TEMPLATES = [
  { id: 'sub1', canonical: 'One-time Shoot', level: 'single' as const, sessions: 1, discount: 0, popular: false },
  { id: 'sub2', canonical: 'Basic', level: 'bronze' as const, sessions: 5, discount: 0.1, popular: false },
  { id: 'sub3', canonical: 'Standard', level: 'silver' as const, sessions: 10, discount: 0.15, popular: true },
  { id: 'sub4', canonical: 'Premium', level: 'gold' as const, sessions: 20, discount: 0.2, popular: false },
]

export function getSubscriptionPlans(basePrice: number) {
  return PLAN_TEMPLATES.map(p => ({
    ...p,
    name: t(`plan.${p.id}.name` as Key),
    description: t(`plan.${p.id}.desc` as Key),
    price: Math.round((p.sessions * basePrice * (1 - p.discount)) / 1000) * 1000,
  }))
}

/** Order service names are stored in English; show them in the active language. */
export function localizeService(stored: string): string {
  const plan = PLAN_TEMPLATES.find(p => p.canonical === stored)
  return plan ? t(('plan.' + plan.id + '.name') as Key) : stored
}

export const AVAILABLE_SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00']

export function formatPrice(amount: number) {
  return `${formatNumber(amount)} ${t('common.uzs')}`
}

export function getLevelConfig(level: string) {
  const colors: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
  }
  const key = level in colors ? level : 'bronze'
  return { label: t(`level.${key}` as Key), color: colors[key] }
}
