import { supabase } from './supabaseClient'
import type { SocialKey, Socials } from '../types'

export const MAX_VIDEOS = 8
export const MAX_CERTIFICATES = 10
export const SOCIAL_KEYS: SocialKey[] = ['instagram', 'youtube', 'tiktok', 'behance', 'website']

const MESSENGER = /(t\.me\/|telegram|wa\.me\/|whatsapp|viber)/i

export type VideoLink =
  | { kind: 'youtube'; id: string; url: string }
  | { kind: 'instagram' | 'tiktok'; url: string }
  | { kind: 'file'; url: string }

const VIDEO_BUCKET = 'portfolio-videos'
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

/** Uploads a video file of the portfolio; returns its public link. */
export async function uploadPortfolioVideo(file: File, userId: string): Promise<string> {
  const type = file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : '')
  if (!VIDEO_TYPES.includes(type)) throw new Error('video-type')
  if (file.size > MAX_VIDEO_BYTES) throw new Error('video-size')
  const ext = (file.name.split('.').pop() ?? 'mp4').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp4'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: type })
  if (error) throw error
  return supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best-effort removal of an uploaded portfolio video (links to other sites are ignored). */
export async function removePortfolioVideo(url: string): Promise<void> {
  const marker = `/${VIDEO_BUCKET}/`
  if (!url.includes(marker)) return
  const path = decodeURIComponent(url.split(marker)[1].split('?')[0])
  const { error } = await supabase.storage.from(VIDEO_BUCKET).remove([path])
  if (error) console.error('Failed to remove video', error)
}

export const isUploadedVideo = (url: string) => url.includes(`/storage/v1/object/public/${VIDEO_BUCKET}/`)

/** Recognises an uploaded video or a YouTube / Instagram / TikTok link; null for anything else. */
export function parseVideo(raw: string): VideoLink | null {
  const input = raw.trim()
  if (isUploadedVideo(input) && input.startsWith('https://')) return { kind: 'file', url: input }
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.replace(/^(www\.|m\.)/, '').toLowerCase()
  const url = `https://${u.hostname.toLowerCase()}${u.pathname}${u.search}`
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return /^[\w-]{11}$/.test(id) ? { kind: 'youtube', id, url: `https://youtu.be/${id}` } : null
  }
  if (host === 'youtube.com') {
    const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? ''
    return /^[\w-]{11}$/.test(id) ? { kind: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` } : null
  }
  if (host === 'instagram.com' && /^\/(p|reel|reels|tv)\/[\w-]+/.test(u.pathname)) return { kind: 'instagram', url }
  if ((host === 'tiktok.com' || host === 'vm.tiktok.com') && u.pathname.length > 1) return { kind: 'tiktok', url }
  return null
}

const SOCIAL_HOSTS: Record<SocialKey, RegExp> = {
  instagram: /^(www\.)?instagram\.com$/,
  youtube: /^(www\.|m\.)?(youtube\.com|youtu\.be)$/,
  tiktok: /^(www\.|vm\.)?tiktok\.com$/,
  behance: /^(www\.)?behance\.net$/,
  website: /^[a-z0-9.-]+\.[a-z]{2,}$/,
}

/**
 * Turns what a specialist typed ("@name", "instagram.com/name", a full link) into a https link,
 * '' for an empty field, or null when it is not valid for that network (or is a messenger link).
 */
export function normalizeSocial(key: SocialKey, raw: string): string | null {
  const input = raw.trim()
  if (!input) return ''
  if (MESSENGER.test(input)) return null
  if (key !== 'website') {
    // "@name", or a bare name that is not a link to this network ("studio.uz" on Instagram is a username).
    const looksLikeLink = input.includes('/') || SOCIAL_HOSTS[key].test(input.toLowerCase().replace(/^https?:\/\//, ''))
    if (input.startsWith('@') || !looksLikeLink) {
      const handle = input.replace(/^@/, '')
      if (!/^[\w.-]{2,30}$/.test(handle) || handle.includes('..')) return null
      const base = { instagram: 'https://instagram.com/', youtube: 'https://youtube.com/@', tiktok: 'https://tiktok.com/@', behance: 'https://behance.net/' }[key]
      return base + handle
    }
  }
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  if (!SOCIAL_HOSTS[key].test(host)) return null
  const out = `https://${host}${u.pathname === '/' ? '' : u.pathname}${u.search}`
  return out.length <= 200 ? out : null
}

export interface PrivateContacts { telegram: string; whatsapp: string }

/** Telegram / WhatsApp of a listing: readable only by its owner and the Whale team. */
export async function fetchPrivateContacts(specialistId: string): Promise<PrivateContacts> {
  const { data, error } = await supabase.from('specialist_contacts').select('telegram, whatsapp').eq('specialist_id', specialistId).maybeSingle()
  if (error) throw error
  return { telegram: data?.telegram ?? '', whatsapp: data?.whatsapp ?? '' }
}

export function normalizeTelegram(raw: string): string | null {
  const v = raw.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')
  if (!v) return ''
  return /^[A-Za-z0-9_]{4,32}$/.test(v) ? `@${v}` : null
}

export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return ''
  return digits.length >= 9 && digits.length <= 15 ? `+${digits}` : null
}

export async function savePrivateContacts(specialistId: string, c: PrivateContacts): Promise<void> {
  const { error } = await supabase
    .from('specialist_contacts')
    .upsert({ specialist_id: specialistId, telegram: c.telegram, whatsapp: c.whatsapp, updated_at: new Date().toISOString() })
  if (error) throw error
}

export function socialsEqual(a: Socials, b: Socials) {
  return SOCIAL_KEYS.every(k => (a[k] ?? '') === (b[k] ?? ''))
}
