import { supabase } from './supabaseClient'
import type { Specialist, Review, Order } from '../types'
import { t, formatTime } from '../i18n'

function mapSpecialistRow(row: Record<string, any>): Specialist {
  return {
    id: row.id,
    ownerId: row.owner_id ?? undefined,
    name: row.name,
    category: row.category,
    categoryKey: row.category_key,
    city: row.city,
    age: row.age,
    experience: row.experience,
    projects: row.projects,
    reviews: row.reviews,
    rating: Number(row.rating),
    price: row.price,
    verified: row.verified,
    level: row.level,
    bio: row.bio,
    avatar: row.avatar,
    cover: row.cover,
    portfolio: row.portfolio ?? [],
    tags: row.tags ?? [],
    available: row.available,
    isNew: row.is_new,
  }
}

export async function fetchSpecialists(): Promise<Specialist[]> {
  const { data, error } = await supabase.from('specialists').select('*').order('rating', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapSpecialistRow)
}

export async function fetchReviews(specialistId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('specialist_id', specialistId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    author: row.author_name,
    avatar: row.author_avatar,
    rating: row.rating,
    date: row.created_at as string, // ISO, formatted in the active language at render time
    text: row.text,
    quality: row.quality,
    timing: row.timing,
    communication: row.communication,
  }))
}

/** Booked slots for a specialist across a date range, grouped by `YYYY-MM-DD`. */
export async function fetchBookedSlotsInRange(
  specialistId: string,
  startDateKey: string,
  endDateKey: string
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('booked_slots')
    .select('booking_date, booking_slot')
    .eq('specialist_id', specialistId)
    .gte('booking_date', startDateKey)
    .lte('booking_date', endDateKey)
  if (error) throw error

  const byDate: Record<string, string[]> = {}
  for (const row of data ?? []) {
    const key = row.booking_date as string
    ;(byDate[key] ??= []).push(row.booking_slot)
  }
  return byDate
}

export async function fetchMySpecialistListing(userId: string): Promise<Specialist | null> {
  const { data, error } = await supabase.from('specialists').select('*').eq('owner_id', userId).maybeSingle()
  if (error) throw error
  return data ? mapSpecialistRow(data) : null
}

export interface SpecialistListingInput {
  name: string
  category: string
  categoryKey: string
  city: string
  age: number
  price: number
  bio: string
  tags: string[]
  avatar: string
}

export async function createSpecialistListing(userId: string, input: SpecialistListingInput): Promise<Specialist> {
  const { data, error } = await supabase
    .from('specialists')
    .insert({
      owner_id: userId,
      name: input.name,
      category: input.category,
      category_key: input.categoryKey,
      city: input.city,
      age: input.age,
      experience: 0,
      projects: 0,
      reviews: 0,
      rating: 0,
      price: input.price,
      verified: false,
      level: 'bronze',
      bio: input.bio,
      avatar: input.avatar,
      cover: '',
      portfolio: [],
      tags: input.tags,
      available: true,
      is_new: true,
    })
    .select()
    .single()
  if (error) throw error
  return mapSpecialistRow(data)
}

export async function updateSpecialistListing(specialistId: string, patch: Partial<SpecialistListingInput> & { available?: boolean }): Promise<Specialist> {
  const dbPatch: Record<string, any> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.category !== undefined) dbPatch.category = patch.category
  if (patch.categoryKey !== undefined) dbPatch.category_key = patch.categoryKey
  if (patch.city !== undefined) dbPatch.city = patch.city
  if (patch.age !== undefined) dbPatch.age = patch.age
  if (patch.price !== undefined) dbPatch.price = patch.price
  if (patch.bio !== undefined) dbPatch.bio = patch.bio
  if (patch.tags !== undefined) dbPatch.tags = patch.tags
  if (patch.avatar !== undefined) dbPatch.avatar = patch.avatar
  if (patch.available !== undefined) dbPatch.available = patch.available

  const { data, error } = await supabase.from('specialists').update(dbPatch).eq('id', specialistId).select().single()
  if (error) throw error
  return mapSpecialistRow(data)
}

export interface SpecialistOrder extends Order {
  clientName: string
  bookingSlot: string
  rawDate: string
}

/** Orders booked against a specialist's own listing, with the client's display name resolved. */
export async function fetchSpecialistOrders(specialistId: string): Promise<SpecialistOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('specialist_id', specialistId)
    .order('booking_date', { ascending: true })
  if (error) throw error
  const rows = data ?? []

  const clientIds = Array.from(new Set(rows.map(r => r.user_id)))
  const namesById: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', clientIds)
    for (const p of profiles ?? []) namesById[p.id] = p.full_name || t('common.client')
  }

  return rows.map(row => ({
    id: row.id,
    specialistId: row.specialist_id,
    date: row.booking_date as string, // ISO; formatted at render time
    rawDate: row.booking_date,
    service: row.service,
    status: row.status,
    amount: row.amount,
    clientName: namesById[row.user_id] ?? t('common.client'),
    bookingSlot: row.booking_slot,
  }))
}

export async function markOrderCompleted(orderId: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)
  if (error) throw error
}

// ---------- Specialist-side inbox ----------

export interface InboxItem {
  id: string
  clientName: string
  lastMessage: string
  lastTime: string
  unread: number
}

/** Conversations on the specialist's own listing, newest first, with the client's name. */
export async function fetchSpecialistInbox(specialistId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('specialist_id', specialistId)
    .order('last_time', { ascending: false })
  if (error) throw error
  const rows = data ?? []

  const ids = Array.from(new Set(rows.map(r => r.user_id)))
  const names: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
    for (const p of profiles ?? []) names[p.id] = p.full_name || t('common.client')
  }

  return rows.map(r => ({
    id: r.id,
    clientName: names[r.user_id] ?? t('common.client'),
    lastMessage: r.last_message,
    lastTime: formatTime(r.last_time),
    unread: r.specialist_unread ?? 0,
  }))
}

export async function fetchThread(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id as string,
    from: row.sender as 'me' | 'them',
    text: row.text as string,
    time: formatTime(row.created_at),
    type: row.message_type as 'text' | 'image',
    image: (row.image_url ?? undefined) as string | undefined,
  }))
}

/** Sends a message as the specialist (sender = 'them' from the client's point of view). */
export async function sendSpecialistMessage(conversationId: string, text: string, image?: string): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender: 'them',
    text,
    message_type: image ? 'image' : 'text',
    image_url: image ?? null,
  })
  if (error) throw error
}

export async function markSpecialistRead(conversationId: string): Promise<void> {
  const { error } = await supabase.from('conversations').update({ specialist_unread: 0 }).eq('id', conversationId)
  if (error) throw error
}

// ---------- Reviews ----------

export async function fetchMyReviewedOrderIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('reviews').select('order_id').eq('author_id', userId).not('order_id', 'is', null)
  if (error) throw error
  return (data ?? []).map(r => r.order_id as string)
}

export interface ReviewInput {
  orderId: string
  specialistId: string
  rating: number
  quality: number
  timing: number
  communication: number
  text: string
}

/** The server stamps the author's name from their profile and enforces "completed orders only". */
export async function createReview(userId: string, input: ReviewInput): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    order_id: input.orderId,
    specialist_id: input.specialistId,
    author_id: userId,
    author_name: 'Client',
    rating: input.rating,
    quality: input.quality,
    timing: input.timing,
    communication: input.communication,
    text: input.text,
  })
  if (error) throw error
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export async function uploadChatImage(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(t('err.imageOnly'))
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(t('err.imageTooLarge'))

  const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('chat-images').upload(path, file, { contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from('chat-images').getPublicUrl(path)
  return data.publicUrl
}

/** If this user has a specialist listing, keep its public photo in sync with their profile photo. */
export async function updateSpecialistAvatarIfAny(userId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase.from('specialists').update({ avatar: avatarUrl }).eq('owner_id', userId)
  if (error) throw error
}