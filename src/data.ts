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

// Booking packages. Prices are derived from the specialist's own per-session
// price (sessions x price, minus a bulk discount), so the amount charged always
// matches what the specialist advertises.
const PLAN_TEMPLATES = [
  { id: 'sub1', name: 'One-time Shoot', description: '1 session, edited materials', level: 'single' as const, sessions: 1, discount: 0, popular: false },
  { id: 'sub2', name: 'Basic', description: '5 sessions', level: 'bronze' as const, sessions: 5, discount: 0.1, popular: false },
  { id: 'sub3', name: 'Standard', description: '10 sessions', level: 'silver' as const, sessions: 10, discount: 0.15, popular: true },
  { id: 'sub4', name: 'Premium', description: '20 sessions', level: 'gold' as const, sessions: 20, discount: 0.2, popular: false },
]

export function getSubscriptionPlans(basePrice: number) {
  return PLAN_TEMPLATES.map(p => ({
    ...p,
    price: Math.round((p.sessions * basePrice * (1 - p.discount)) / 1000) * 1000,
  }))
}

export const AVAILABLE_SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00']

export function formatPrice(amount: number) {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' UZS'
}

export function getLevelConfig(level: string) {
  const configs: Record<string, { label: string; color: string }> = {
    bronze:   { label: 'Bronze',   color: '#CD7F32' },
    silver:   { label: 'Silver',   color: '#C0C0C0' },
    gold:     { label: 'Gold',     color: '#FFD700' },
    platinum: { label: 'Platinum', color: '#E5E4E2' },
  }
  return configs[level] ?? configs.bronze
}
