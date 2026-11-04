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

export const SUBSCRIPTIONS = [
  { id: 'sub1', name: 'One-time Shoot', price: 350000, description: '1 session, edited materials', level: 'single' as const },
  { id: 'sub2', name: 'Basic', price: 900000, description: '5 videos / month', level: 'bronze' as const, popular: false },
  { id: 'sub3', name: 'Standard', price: 1500000, description: '10 videos / month', level: 'silver' as const, popular: true },
  { id: 'sub4', name: 'Premium', price: 2500000, description: '15–20 videos / month', level: 'gold' as const, popular: false },
]

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
