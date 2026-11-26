import { supabase } from './supabaseClient'
import type { Billing, Currency, ListingService, Tier } from '../types'

export function mapServiceRow(r: Record<string, any>): ListingService {
  return {
    id: r.id,
    specialistId: r.specialist_id,
    title: r.title,
    description: r.description ?? '',
    billing: r.billing as Billing,
    sessions: r.sessions ?? 1,
    price: r.price ?? null,
    priceFrom: !!r.price_from,
    currency: (r.currency ?? 'UZS') as Currency,
    position: r.position ?? 0,
    tier: (r.tier ?? null) as Tier | null,
    quantity: r.quantity ?? null,
    shootDays: r.shoot_days ?? null,
    duration: r.duration ?? '',
    terms: r.terms ?? '',
  }
}

/** A listing's price list, in the owner's order. */
export async function fetchServices(specialistId: string): Promise<ListingService[]> {
  const { data, error } = await supabase
    .from('listing_services')
    .select('*')
    .eq('specialist_id', specialistId)
    .order('position')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map(mapServiceRow)
}

export type ServiceInput = Omit<ListingService, 'id' | 'position'>

/** Checks a service the way the database does, so the form can say what is wrong before saving. */
export function validateService(s: ServiceInput): 'price.errTitle' | 'price.errPrice' | 'price.errSessions' | 'price.errQuantity' | null {
  const title = s.title.trim()
  if (title.length < 2 || title.length > 80) return 'price.errTitle'
  if (s.billing === 'package' && (!Number.isInteger(s.sessions) || s.sessions < 2 || s.sessions > 50)) return 'price.errSessions'
  if (s.quantity != null && (!Number.isInteger(s.quantity) || s.quantity < 1 || s.quantity > 1000)) return 'price.errQuantity'
  if (s.shootDays != null && (!Number.isInteger(s.shootDays) || s.shootDays < 1 || s.shootDays > 31)) return 'price.errQuantity'
  if (s.billing !== 'quote') {
    const p = s.price ?? 0
    const ok = s.currency === 'UZS' ? p >= 1000 && p <= 100_000_000 : p >= 1 && p <= 100_000
    if (!Number.isInteger(p) || !ok) return 'price.errPrice'
  }
  return null
}

function toRow(s: ServiceInput) {
  const quote = s.billing === 'quote'
  return {
    specialist_id: s.specialistId,
    title: s.title.trim(),
    description: s.description.trim(),
    billing: s.billing,
    sessions: s.billing === 'package' ? s.sessions : 1,
    price: quote ? null : s.price,
    price_from: quote ? false : s.priceFrom,
    currency: s.currency,
    tier: s.tier,
    quantity: s.quantity,
    shoot_days: s.billing === 'monthly' ? s.shootDays : null,
    duration: s.duration.trim(),
    terms: s.terms.trim(),
  }
}

export async function createService(s: ServiceInput, position: number): Promise<ListingService> {
  const { data, error } = await supabase.from('listing_services').insert({ ...toRow(s), position }).select().single()
  if (error) throw error
  return mapServiceRow(data)
}

export async function updateService(id: string, s: ServiceInput): Promise<ListingService> {
  const { specialist_id: _ignored, ...row } = toRow(s)
  const { data, error } = await supabase.from('listing_services').update(row).eq('id', id).select().single()
  if (error) throw error
  return mapServiceRow(data)
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from('listing_services').delete().eq('id', id)
  if (error) throw error
}

/** Saves a new order of the list (positions 0..n-1). */
export async function reorderServices(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from('listing_services').update({ position: i }).eq('id', ids[i])
    if (error) throw error
  }
}
