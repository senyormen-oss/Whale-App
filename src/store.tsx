import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabaseClient'
import { subscribeToTables } from './lib/realtime'
import { useAuth } from './auth'
import { useToast } from './toast'
import { t, formatTime } from './i18n'
import type { Conversation, Message, Order } from './types'

const NOTIF_PREF_KEY = 'whale.notificationsEnabled'

function mapOrderRow(row: Record<string, any>): Order {
  return {
    id: row.id,
    specialistId: row.specialist_id,
    date: row.booking_date as string, // ISO; formatted at render time
    rawDate: row.booking_date,
    service: row.service,
    status: row.status,
    amount: row.amount,
  }
}

function mapConversationRow(row: Record<string, any>): Conversation {
  return {
    id: row.id,
    specialistId: row.specialist_id,
    lastMessage: row.last_message,
    lastTime: formatTime(row.last_time),
    unread: row.unread,
    specialistUnread: row.specialist_unread,
  }
}

function mapMessageRow(row: Record<string, any>): Message {
  return {
    id: row.id,
    from: row.sender,
    text: row.text,
    time: formatTime(row.created_at),
    type: row.message_type,
    image: row.image_url ?? undefined,
  }
}

interface BookingInput {
  specialistId: string
  dateKey: string
  slot: string
  serviceName: string
  amount: number
}

interface AppStore {
  ready: boolean
  orders: Order[]
  conversations: Conversation[]
  messagesByConversation: Record<string, Message[]>
  favorites: string[]
  notificationsEnabled: boolean
  loadMessages: (conversationId: string) => Promise<void>
  /** Sends a message as the signed-in client. Counters/summary are maintained by the database. */
  sendMessage: (conversationId: string, message: { text: string; type?: 'text' | 'image'; image?: string }) => Promise<boolean>
  markConversationRead: (conversationId: string) => Promise<void>
  toggleFavorite: (specialistId: string) => Promise<void>
  toggleNotifications: () => void
  /** Returns the id of the conversation with this specialist, creating it if needed. */
  startConversation: (specialistId: string) => Promise<string | null>
  /** Cancels one of the user's own bookings (the database frees the slot). */
  cancelOrder: (orderId: string) => Promise<boolean>
  /** Permanently deletes the account and its data (right to erasure). */
  deleteAccount: () => Promise<boolean>
  /** Demo-mode booking: slot + order are created atomically and confirmed immediately. */
  confirmBooking: (input: BookingInput) => Promise<{ order: Order; conversationId: string } | { error: string }>
  /**
   * Real-gateway booking: slot + order are created atomically as 'pending';
   * the payment webhook flips the order to 'confirmed' once the money arrives.
   */
  createPendingOrder: (input: BookingInput) => Promise<{ order: Order } | { error: string }>
}

const AppStoreContext = createContext<AppStore | null>(null)

/** The booking function raises short English validation errors; map them to the active language. */
function bookingServerMessage(message: string): string | null {
  const map: [string, Parameters<typeof t>[0]][] = [
    ['Invalid time slot', 'err.invalidSlot'],
    ['Invalid amount', 'err.invalidAmount'],
    ['You cannot book your own listing', 'err.ownListing'],
    ['not accepting bookings', 'err.notAvailable'],
    ['Choose a valid date', 'err.dateRange'],
    ['Specialist not found', 'err.bookingFailed'],
    ['Invalid service', 'err.bookingFailed'],
    ['Invalid status', 'err.bookingFailed'],
  ]
  for (const [text, key] of map) if (message.includes(text)) return t(key)
  return null
}

function bookingErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') return t('err.slotTaken')
  if (error.code === '28000') return t('err.signInAgain')
  return bookingServerMessage(error.message) ?? t('err.bookingFailed')
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { notify } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({})
  const [favorites, setFavorites] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem(NOTIF_PREF_KEY) !== 'false'
    } catch {
      return true
    }
  })

  const fetchThread = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Failed to load messages', error)
      return
    }
    setMessagesByConversation(prev => ({ ...prev, [conversationId]: (data ?? []).map(mapMessageRow) }))
  }, [])

  const refreshData = useCallback(async () => {
    if (!user) return
    const [ordersRes, convsRes, favsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').eq('user_id', user.id).order('last_time', { ascending: false }),
      supabase.from('favorites').select('specialist_id').eq('user_id', user.id),
    ])
    if (ordersRes.error || convsRes.error || favsRes.error) {
      console.error('Failed to refresh data', ordersRes.error ?? convsRes.error ?? favsRes.error)
      return
    }
    setOrders((ordersRes.data ?? []).map(mapOrderRow))
    setConversations((convsRes.data ?? []).map(mapConversationRow))
    setFavorites((favsRes.data ?? []).map(row => row.specialist_id))
  }, [user])

  // Initial load / user change
  useEffect(() => {
    if (!user) {
      setOrders([])
      setConversations([])
      setMessagesByConversation({})
      setFavorites([])
      setReady(true)
      return
    }
    let cancelled = false
    setReady(false)
    refreshData().finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [user, refreshData])

  // Realtime: new messages / order status changes arrive without a reload
  const loadedThreadsRef = useRef<string[]>([])
  loadedThreadsRef.current = Object.keys(messagesByConversation)
  useEffect(() => {
    if (!user) return
    return subscribeToTables(['messages', 'conversations', 'orders'], () => {
      refreshData()
      loadedThreadsRef.current.forEach(id => fetchThread(id))
    })
  }, [user, refreshData, fetchThread])

  const book = useCallback(async (input: BookingInput, status: 'pending' | 'confirmed'): Promise<{ order: Order } | { error: string }> => {
    if (!user) return { error: t('err.signInAgain') }
    const { data, error } = await supabase.rpc('create_booking', {
      p_specialist_id: input.specialistId,
      p_date: input.dateKey,
      p_slot: input.slot,
      p_service: input.serviceName,
      p_amount: input.amount,
      p_status: status,
    })
    if (error || !data) return { error: bookingErrorMessage(error ?? { message: '' }) }
    const order = mapOrderRow(data as Record<string, any>)
    setOrders(prev => [order, ...prev])
    return { order }
  }, [user])

  const store = useMemo<AppStore>(() => ({
    ready,
    orders,
    conversations,
    messagesByConversation,
    favorites,
    notificationsEnabled,

    async loadMessages(conversationId) {
      await fetchThread(conversationId)
    },

    async sendMessage(conversationId, message) {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender: 'me',
          text: message.text,
          message_type: message.type ?? 'text',
          image_url: message.image ?? null,
        })
        .select()
        .single()
      if (error || !data) {
        console.error('Failed to send message', error)
        notify(t('err.messageNotSent'))
        return false
      }
      const mapped = mapMessageRow(data)
      setMessagesByConversation(prev => {
        const existing = prev[conversationId] ?? []
        return existing.some(m => m.id === mapped.id) ? prev : { ...prev, [conversationId]: [...existing, mapped] }
      })
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, lastMessage: message.type === 'image' ? t('chat.photo') : message.text, lastTime: mapped.time } : c
      ))
      return true
    },

    async markConversationRead(conversationId) {
      setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, unread: 0 } : c)))
      const { error } = await supabase.from('conversations').update({ unread: 0 }).eq('id', conversationId)
      if (error) console.error('Failed to mark conversation read', error)
    },

    async toggleFavorite(specialistId) {
      if (!user) return
      const isFav = favorites.includes(specialistId)
      setFavorites(prev => (isFav ? prev.filter(id => id !== specialistId) : [...prev, specialistId]))
      const { error } = isFav
        ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('specialist_id', specialistId)
        : await supabase.from('favorites').insert({ user_id: user.id, specialist_id: specialistId })
      if (error) {
        console.error('Failed to update favorite', error)
        setFavorites(prev => (isFav ? [...prev, specialistId] : prev.filter(id => id !== specialistId)))
        notify(t('err.favorites'))
      }
    },

    toggleNotifications() {
      setNotificationsEnabled(prev => {
        const next = !prev
        try {
          localStorage.setItem(NOTIF_PREF_KEY, String(next))
        } catch {
          // Preference just won't persist across sessions — not critical.
        }
        return next
      })
    },

    async startConversation(specialistId) {
      if (!user) return null
      const existing = conversations.find(c => c.specialistId === specialistId)
      if (existing) return existing.id
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, specialist_id: specialistId })
        .select()
        .single()
      if (error || !data) {
        console.error('Failed to start conversation', error)
        notify(t('err.openChat'))
        return null
      }
      setConversations(prev => [mapConversationRow(data), ...prev])
      return data.id
    },

    async cancelOrder(orderId) {
      const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
      if (error) {
        console.error('Failed to cancel order', error)
        notify(t('err.cancel'))
        return false
      }
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: 'cancelled' } : o)))
      notify(t('toast.cancelled'), 'success')
      return true
    },

    async deleteAccount() {
      if (!user) return false
      // Remove the user's uploaded images first (storage cannot be cascaded from SQL).
      try {
        const { data: files } = await supabase.storage.from('chat-images').list(user.id, { limit: 1000 })
        if (files && files.length > 0) {
          await supabase.storage.from('chat-images').remove(files.map(f => `${user.id}/${f.name}`))
        }
      } catch (err) {
        console.error('Failed to remove uploaded images', err)
      }
      const { error } = await supabase.rpc('delete_my_account')
      if (error) {
        console.error('Failed to delete account', error)
        notify(t('err.deleteAccount'))
        return false
      }
      await signOut()
      return true
    },

    async confirmBooking(input) {
      const result = await book(input, 'confirmed')
      if ('error' in result) return result

      // The database trigger has already opened the conversation and posted the
      // confirmation message; fetch it so we can take the user straight to the chat.
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user!.id)
        .eq('specialist_id', input.specialistId)
        .maybeSingle()
      if (error || !conv) return { error: t('err.chatAfterBooking') }

      setConversations(prev => [mapConversationRow(conv), ...prev.filter(c => c.id !== conv.id)])
      return { order: result.order, conversationId: conv.id }
    },

    async createPendingOrder(input) {
      return book(input, 'pending')
    },
  }), [ready, orders, conversations, messagesByConversation, favorites, notificationsEnabled, user, fetchThread, book, notify, signOut])

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
  return ctx
}
