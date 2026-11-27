import { supabase } from './supabaseClient'

// ---------- Users ----------

export interface AdminUser {
  userId: string
  phone: string
  email: string
  fullName: string
  createdAt: string
  lastSignInAt: string | null
  listings: number
  orders: number
  isAdmin: boolean
  blocked: boolean
  blockReason: string
}

export async function fetchUsers(search: string, offset = 0, limit = 50): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users', { p_search: search, p_limit: limit, p_offset: offset })
  if (error) throw error
  return ((data as any[]) ?? []).map(r => ({
    userId: r.user_id, phone: r.phone, email: r.email, fullName: r.full_name, createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at, listings: r.listings, orders: r.orders, isAdmin: r.is_admin,
    blocked: r.blocked, blockReason: r.block_reason,
  }))
}

export async function setBlocked(userId: string, blocked: boolean, reason = '') {
  const { error } = await supabase.rpc('admin_set_blocked', { p_user_id: userId, p_blocked: blocked, p_reason: reason })
  if (error) throw error
}

/** The signed-in user's own block (null when not blocked). */
export async function fetchMyBlock(userId: string): Promise<{ reason: string } | null> {
  const { data } = await supabase.from('user_blocks').select('reason').eq('user_id', userId).maybeSingle()
  return data ? { reason: data.reason ?? '' } : null
}

// ---------- Reports ----------

export type ReportStatus = 'new' | 'reviewing' | 'resolved' | 'dismissed'

export interface AdminReport {
  id: string
  specialistId: string
  specialistName: string
  ownerId: string | null
  reason: string
  details: string
  status: ReportStatus
  createdAt: string
  reporterName: string
  reporterContact: string
}

export async function fetchReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase.rpc('admin_list_reports', { p_status: null })
  if (error) throw error
  return ((data as any[]) ?? []).map(r => ({
    id: r.id, specialistId: r.specialist_id, specialistName: r.specialist_name, ownerId: r.owner_id, reason: r.reason,
    details: r.details, status: r.status, createdAt: r.created_at, reporterName: r.reporter_name, reporterContact: r.reporter_phone,
  }))
}

export async function setReportStatus(id: string, status: ReportStatus) {
  const { error } = await supabase.from('reports').update({ status }).eq('id', id)
  if (error) throw error
}

// ---------- Reviews ----------

export interface AdminReview {
  id: string
  specialistId: string
  specialistName: string
  authorName: string
  rating: number
  text: string
  createdAt: string
}

export async function fetchAllReviews(): Promise<AdminReview[]> {
  const { data, error } = await supabase.rpc('admin_list_reviews', { p_limit: 200 })
  if (error) throw error
  return ((data as any[]) ?? []).map(r => ({
    id: r.id, specialistId: r.specialist_id, specialistName: r.specialist_name, authorName: r.author_name,
    rating: r.rating, text: r.text, createdAt: r.created_at,
  }))
}

export async function deleteReview(id: string) {
  const { error } = await supabase.rpc('admin_delete_review', { p_review_id: id })
  if (error) throw error
}

// ---------- Statistics ----------

export interface AdminStats {
  users_total: number
  users_7d: number
  users_30d: number
  blocked: number
  listings: Record<string, number> | null
  listings_published: number
  orders: Record<string, number> | null
  orders_7d: number
  orders_30d: number
  revenue_uzs: number
  revenue_usd: number
  reports_new: number
  reviews: number
  orders_by_day: { day: string; n: number }[]
  top_specialists: { id: string; name: string; orders: number; completed: number }[]
}

export async function fetchStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) throw error
  return data as AdminStats
}
