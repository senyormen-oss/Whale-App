import { supabase } from './supabaseClient'
import type { SocialKey, Socials } from '../types'

export const MAX_VIDEOS = 8
export const MAX_CERTIFICATES = 10
export const SOCIAL_KEYS: SocialKey[] = ['instagram', 'youtube', 'tiktok', 'behance', 'website']

const MESSENGER = /(t\.me\/|telegram|wa\.me\/|whatsapp|viber)/i

export type VideoLink =
  | { kind: 'youtube'; id: string; url: string }
  | { kind: 'instagram' | 'tiktok'; url: string }

/** Recognises a YouTube / Instagram / TikTok link; null for anything else. */
export function parseVideo(raw: string): VideoLink | null {
  const input = raw.trim()
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
  const handle = input.replace(/^@/, '')
  if (/^[\w.]{2,30}$/.test(handle) && !handle.includes('..') && key !== 'website' && !/\.[a-z]{2,}$/i.test(handle)) {
    const base = { instagram: 'https://instagram.com/', youtube: 'https://youtube.com/@', tiktok: 'https://tiktok.com/@', behance: 'https://behance.net/', website: '' }[key]
    return base + handle
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
