import { supabase } from './supabaseClient'
import { t } from '../i18n'

// ---------- Administration (agency model) ----------
// Every call here is protected by row-level security / SECURITY DEFINER functions:
// only users listed in public.admins get any data or can change anything.

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) return false
  return !!data
}

export interface AdminRequest {
  id: string
  specialistName: string
  clientName: string
  phone: string
  note: string
  date: string
  slot: string
  service: string
  amount: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  createdAt: string
}

/** All orders with client and specialist names resolved. */
export async function fetchAdminRequests(): Promise<AdminRequest[]> {
  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  const rows = orders ?? []
  const clientIds = Array.from(new Set(rows.map(r => r.user_id)))
  const specIds = Array.from(new Set(rows.map(r => r.specialist_id)))
  const [profilesRes, specsRes] = await Promise.all([
    clientIds.length ? supabase.from('profiles').select('id, full_name').in('id', clientIds) : Promise.resolve({ data: [] as any[] }),
    specIds.length ? supabase.from('specialists').select('id, name').in('id', specIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const clientNames: Record<string, string> = {}
  for (const p of profilesRes.data ?? []) clientNames[p.id] = p.full_name
  const specNames: Record<string, string> = {}
  for (const s of specsRes.data ?? []) specNames[s.id] = s.name
  return rows.map(r => ({
    id: r.id,
    specialistName: specNames[r.specialist_id] ?? '—',
    clientName: clientNames[r.user_id] || t('common.client'),
    phone: r.phone ?? '',
    note: r.note ?? '',
    date: r.booking_date as string,
    slot: r.booking_slot as string,
    service: r.service,
    amount: r.amount,
    status: r.status,
    createdAt: r.created_at as string,
  }))
}

export async function adminSetOrderStatus(orderId: string, status: 'confirmed' | 'completed' | 'cancelled'): Promise<void> {
  const { error } = await supabase.rpc('admin_set_order_status', { p_order_id: orderId, p_status: status })
  if (error) throw error
}

export interface AdminListing {
  id: string
  name: string
  categoryKey: string
  city: string
  price: number
  bio: string
  approved: boolean
}

export async function fetchAdminListings(): Promise<AdminListing[]> {
  const { data, error } = await supabase
    .from('specialists')
    .select('id, name, category_key, city, price, bio, approved')
    .order('approved', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, name: r.name, categoryKey: r.category_key, city: r.city, price: r.price, bio: r.bio, approved: !!r.approved,
  }))
}

export async function adminSetListingApproved(specialistId: string, approved: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_listing_approved', { p_specialist_id: specialistId, p_approved: approved })
  if (error) throw error
}
