import { supabase } from './supabaseClient'

export interface Interval { id: string; start: string; end: string }
export interface WeeklyInterval extends Interval { weekday: number }
export interface DayOverride { day: string; blocked: boolean }
export interface DaySlot extends Interval { day: string }

export interface Schedule {
  weekly: WeeklyInterval[]
  days: DayOverride[]
  daySlots: DaySlot[]
}

const hm = (t: string) => t.slice(0, 5)

/** Minutes since midnight of "HH:MM". */
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** "09:00-11:00" -> [09:00, 11:00]; legacy "09:00" -> two-hour session. */
export function slotRange(slot: string): [number, number] {
  const [a, b] = slot.split('-')
  const s = toMin(a)
  return [s, b ? toMin(b) : s + 120]
}

export const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1]

/** Times for the pickers: 06:00 … 23:30 every 30 minutes, plus 24:00 is not allowed (time of day). */
export const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const m = 6 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})

export async function fetchSchedule(specialistId: string, fromKey: string, toKey: string): Promise<Schedule> {
  const [w, d, s] = await Promise.all([
    supabase.from('specialist_weekly_hours').select('*').eq('specialist_id', specialistId).order('start_time'),
    supabase.from('specialist_days').select('*').eq('specialist_id', specialistId).gte('day', fromKey).lte('day', toKey),
    supabase.from('specialist_day_slots').select('*').eq('specialist_id', specialistId).gte('day', fromKey).lte('day', toKey).order('start_time'),
  ])
  const err = w.error ?? d.error ?? s.error
  if (err) throw err
  return {
    weekly: (w.data ?? []).map(r => ({ id: r.id, weekday: r.weekday, start: hm(r.start_time), end: hm(r.end_time) })),
    days: (d.data ?? []).map(r => ({ day: r.day, blocked: r.blocked })),
    daySlots: (s.data ?? []).map(r => ({ id: r.id, day: r.day, start: hm(r.start_time), end: hm(r.end_time) })),
  }
}

/** True when the listing has never set any schedule (clients then see the old fixed times). */
export async function hasAnySchedule(specialistId: string): Promise<boolean> {
  const [w, d] = await Promise.all([
    supabase.from('specialist_weekly_hours').select('id', { count: 'exact', head: true }).eq('specialist_id', specialistId),
    supabase.from('specialist_days').select('day', { count: 'exact', head: true }).eq('specialist_id', specialistId),
  ])
  return (w.count ?? 0) + (d.count ?? 0) > 0
}

export async function addWeekly(specialistId: string, weekday: number, start: string, end: string) {
  const { error } = await supabase.from('specialist_weekly_hours').insert({ specialist_id: specialistId, weekday, start_time: start, end_time: end })
  if (error) throw error
}

export async function deleteWeekly(id: string) {
  const { error } = await supabase.from('specialist_weekly_hours').delete().eq('id', id)
  if (error) throw error
}

/** Gives a date its own intervals, starting from a copy of the given ones (usually the weekly hours). */
export async function makeDayOwn(specialistId: string, day: string, copy: { start: string; end: string }[]) {
  const { error } = await supabase.from('specialist_days').upsert({ specialist_id: specialistId, day, blocked: false })
  if (error) throw error
  await supabase.from('specialist_day_slots').delete().eq('specialist_id', specialistId).eq('day', day)
  if (copy.length) {
    const { error: e2 } = await supabase.from('specialist_day_slots').insert(copy.map(c => ({ specialist_id: specialistId, day, start_time: c.start, end_time: c.end })))
    if (e2) throw e2
  }
}

export async function blockDay(specialistId: string, day: string) {
  await supabase.from('specialist_day_slots').delete().eq('specialist_id', specialistId).eq('day', day)
  const { error } = await supabase.from('specialist_days').upsert({ specialist_id: specialistId, day, blocked: true })
  if (error) throw error
}

/** Removes the date's own settings: it follows the weekly schedule again. */
export async function resetDay(specialistId: string, day: string) {
  const { error } = await supabase.from('specialist_days').delete().eq('specialist_id', specialistId).eq('day', day)
  if (error) throw error
}

export async function addDaySlot(specialistId: string, day: string, start: string, end: string) {
  const { error } = await supabase.from('specialist_day_slots').insert({ specialist_id: specialistId, day, start_time: start, end_time: end })
  if (error) throw error
}

export async function deleteDaySlot(id: string) {
  const { error } = await supabase.from('specialist_day_slots').delete().eq('id', id)
  if (error) throw error
}

/** Free slots a client can book, grouped by date (from the database, so it always matches what booking accepts). */
export async function fetchFreeSlots(specialistId: string, fromKey: string, toKey: string): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.rpc('listing_slots', { p_specialist_id: specialistId, p_from: fromKey, p_to: toKey })
  if (error) throw error
  const out: Record<string, string[]> = {}
  for (const r of (data as { day: string; slot: string }[]) ?? []) (out[r.day] ??= []).push(r.slot)
  return out
}

export async function specialistSetOrderStatus(orderId: string, status: 'confirmed' | 'cancelled' | 'completed') {
  const { error } = await supabase.rpc('specialist_set_order_status', { p_order_id: orderId, p_status: status })
  if (error) throw error
}

/** "09:00-11:00" -> "09:00–11:00" for display. */
export const showSlot = (slot: string) => slot.replace('-', '–')
