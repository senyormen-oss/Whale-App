import { supabase } from './supabaseClient'
import { mapSpecialistRow } from './queries'
import { t } from '../i18n'
import type { Specialist } from '../types'

// ---------- Administration (agency model) ----------
// Every call here is protected by row-level security / SECURITY DEFINER functions:
// only users listed in public.admins get any data or can change anything.

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) return false
  return !!data
}

export interface PackageInfo {
  id: string
  planTotal: number
  used: number
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  expiresAt: string | null
  price: number
  plan: string
  specialistId: string
  userId: string
}

export interface AdminRequest {
  id: string
  userId: string
  specialistId: string
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
  package: PackageInfo | null
}

export function mapPackageRow(r: Record<string, any>): PackageInfo {
  return {
    id: r.id,
    planTotal: r.sessions_total,
    used: r.sessions_used,
    status: r.status,
    expiresAt: r.expires_at ?? null,
    price: r.price,
    plan: r.plan,
    specialistId: r.specialist_id,
    userId: r.user_id,
  }
}

export async function fetchAdminPackages(): Promise<PackageInfo[]> {
  const { data, error } = await supabase.from('packages').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPackageRow)
}

/** All orders with client and specialist names and package info resolved. */
export async function fetchAdminRequests(): Promise<AdminRequest[]> {
  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  const rows = orders ?? []
  const clientIds = Array.from(new Set(rows.map(r => r.user_id)))
  const specIds = Array.from(new Set(rows.map(r => r.specialist_id)))
  const [profilesRes, specsRes, packages] = await Promise.all([
    clientIds.length ? supabase.from('profiles').select('id, full_name').in('id', clientIds) : Promise.resolve({ data: [] as any[] }),
    specIds.length ? supabase.from('specialists').select('id, name').in('id', specIds) : Promise.resolve({ data: [] as any[] }),
    fetchAdminPackages().catch(() => [] as PackageInfo[]),
  ])
  const clientNames: Record<string, string> = {}
  for (const p of profilesRes.data ?? []) clientNames[p.id] = p.full_name
  const specNames: Record<string, string> = {}
  for (const s of specsRes.data ?? []) specNames[s.id] = s.name
  const packagesById: Record<string, PackageInfo> = {}
  for (const p of packages) packagesById[p.id] = p
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    specialistId: r.specialist_id,
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
    package: r.package_id ? packagesById[r.package_id] ?? null : null,
  }))
}

export async function adminSetOrderStatus(orderId: string, status: 'confirmed' | 'completed' | 'cancelled'): Promise<void> {
  const { error } = await supabase.rpc('admin_set_order_status', { p_order_id: orderId, p_status: status })
  if (error) throw error
}

export async function adminSetPackage(packageId: string, status: 'active' | 'cancelled' | 'completed', extendDays = 0): Promise<void> {
  const { error } = await supabase.rpc('admin_set_package', { p_package_id: packageId, p_status: status, p_extend_days: extendDays })
  if (error) throw error
}

// ---------- Specialists ----------

/** Every listing (approved or not), with all fields. */
export async function fetchAllSpecialists(): Promise<Specialist[]> {
  const { data, error } = await supabase.from('specialists').select('*').order('approved', { ascending: true }).order('name')
  if (error) throw error
  return (data ?? []).map(mapSpecialistRow)
}

export interface SpecialistPayload {
  id?: string
  name: string
  category: string
  category_key: string
  city: string
  age: number
  price: number
  experience: number
  bio: string
  qualification: string
  tags: string[]
  avatar: string
  cover: string
  portfolio: string[]
  level: string
  available: boolean
  verified: boolean
  approved: boolean
}

export async function adminUpsertSpecialist(payload: SpecialistPayload): Promise<string> {
  const { data, error } = await supabase.rpc('admin_upsert_specialist', { p: payload })
  if (error) throw error
  return data as string
}

export async function adminModerateListing(
  specialistId: string,
  status: 'pending' | 'approved' | 'rejected' | 'needs_changes',
  comment = '',
): Promise<void> {
  const { error } = await supabase.rpc('admin_moderate_listing', { p_specialist_id: specialistId, p_status: status, p_comment: comment })
  if (error) throw error
}

export async function adminSetListingApproved(specialistId: string, approved: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_listing_approved', { p_specialist_id: specialistId, p_approved: approved })
  if (error) throw error
}

// ---------- CRM notes ----------

export async function fetchNote(kind: 'client' | 'order' | 'specialist', key: string): Promise<string> {
  const { data, error } = await supabase.from('crm_notes').select('note').eq('kind', kind).eq('key', key).maybeSingle()
  if (error) throw error
  return data?.note ?? ''
}

export async function saveNote(kind: 'client' | 'order' | 'specialist', key: string, note: string): Promise<void> {
  const { error } = await supabase.from('crm_notes').upsert({ kind, key, note, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ---------- Team ----------

export interface TeamMember { userId: string; email: string; phone: string; fullName: string }

export async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('admin_list_admins')
  if (error) throw error
  return ((data as any[]) ?? []).map(r => ({ userId: r.user_id, email: r.email ?? '', phone: r.phone ?? '', fullName: r.full_name ?? '' }))
}

/** `contact` is the e-mail or phone number the person signed up with. */
export async function setTeamRole(contact: string, admin: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_role', { p_email: contact, p_admin: admin })
  if (error) throw error
}

export interface UserContact { email: string; phone: string; fullName: string }

/** E-mail, phone and name of an account (for moderators verifying a listing). */
export async function fetchUserContact(userId: string): Promise<UserContact | null> {
  const { data, error } = await supabase.rpc('admin_user_contact', { p_user_id: userId })
  if (error) throw error
  const row = ((data as any[]) ?? [])[0]
  return row ? { email: row.email ?? '', phone: row.phone ?? '', fullName: row.full_name ?? '' } : null
}
