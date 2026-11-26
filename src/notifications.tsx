import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabaseClient'
import { subscribeToTables } from './lib/realtime'
import { useAuth } from './auth'
import { useToast } from './toast'
import { t, formatDate } from './i18n'
import { formatOrderPrice, localizeService } from './data'
import type { Billing, Currency } from './types'

export type NotificationKind =
  | 'new_request' | 'request_confirmed' | 'request_cancelled' | 'request_completed'
  | 'client_cancelled' | 'listing_approved' | 'listing_rejected' | 'listing_needs_changes'

export interface AppNotification {
  id: string
  kind: NotificationKind
  orderId: string | null
  specialistId: string | null
  data: Record<string, any>
  read: boolean
  createdAt: string
}

/** Title and one detail line of a notification, in the active language. */
export function describeNotification(n: AppNotification): { title: string; detail: string } {
  const d = n.data
  const who = d.specialist_name ?? ''
  const when = d.date ? `${formatDate(d.date)}, ${String(d.slot ?? '').replace('-', '–')}` : ''
  const price = d.amount != null ? formatOrderPrice({ amount: Number(d.amount), currency: (d.currency ?? 'UZS') as Currency, billing: (d.billing ?? 'one_time') as Billing }) : ''
  const svc = d.service ? localizeService(d.service) : ''
  switch (n.kind) {
    case 'new_request':
      return { title: t('notif.newRequest', { name: who }), detail: [svc, price, when].filter(Boolean).join(' · ') }
    case 'request_confirmed':
      return { title: t('notif.confirmed', { name: who }), detail: [svc, when].filter(Boolean).join(' · ') }
    case 'request_cancelled':
      return { title: t('notif.cancelled', { name: who }), detail: [svc, when].filter(Boolean).join(' · ') }
    case 'request_completed':
      return { title: t('notif.completed', { name: who }), detail: t('notif.leaveReview') }
    case 'client_cancelled':
      return { title: t('notif.clientCancelled', { name: who }), detail: [svc, when].filter(Boolean).join(' · ') }
    case 'listing_approved':
      return { title: t('notif.listingApproved', { name: who }), detail: '' }
    case 'listing_rejected':
      return { title: t('notif.listingRejected', { name: who }), detail: d.comment ?? '' }
    case 'listing_needs_changes':
      return { title: t('notif.listingNeedsChanges', { name: who }), detail: d.comment ?? '' }
  }
}

interface NotificationsState {
  items: AppNotification[]
  unread: number
  markAllRead: () => void
}

const Ctx = createContext<NotificationsState>({ items: [], unread: 0, markAllRead: () => {} })

const map = (r: Record<string, any>): AppNotification => ({
  id: r.id, kind: r.kind, orderId: r.order_id, specialistId: r.specialist_id, data: r.data ?? {}, read: !!r.read_at, createdAt: r.created_at,
})

/** Loads the signed-in user's notifications, keeps them live, and shows a toast for each new one. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { notify } = useToast()
  const [items, setItems] = useState<AppNotification[]>([])
  const seen = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40)
    if (error) { console.error('Failed to load notifications', error); return }
    const list = (data ?? []).map(map)
    if (seen.current) {
      for (const n of list) if (!seen.current.has(n.id) && !n.read) notify(describeNotification(n).title, 'success')
    }
    seen.current = new Set(list.map(n => n.id))
    setItems(list)
  }, [user, notify])

  useEffect(() => {
    seen.current = null
    setItems([])
    if (!user) return
    load()
    return subscribeToTables(['notifications'], load)
  }, [user, load])

  const markAllRead = useCallback(() => {
    if (!items.some(n => !n.read)) return
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    supabase.rpc('mark_notifications_read').then(({ error }) => error && console.error(error))
  }, [items])

  return <Ctx.Provider value={{ items, unread: items.filter(n => !n.read).length, markAllRead }}>{children}</Ctx.Provider>
}

export const useNotifications = () => useContext(Ctx)

// ---------- Telegram linking ----------

export const TELEGRAM_BOT = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined)?.replace(/^@/, '') ?? ''

export async function fetchTelegramLinked(userId: string): Promise<boolean> {
  const { data } = await supabase.from('telegram_links').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export async function telegramLinkUrl(): Promise<string> {
  const { data, error } = await supabase.rpc('create_telegram_link_code')
  if (error) throw error
  return `https://t.me/${TELEGRAM_BOT}?start=${data}`
}

export async function unlinkTelegram(userId: string) {
  const { error } = await supabase.from('telegram_links').delete().eq('user_id', userId)
  if (error) throw error
}
