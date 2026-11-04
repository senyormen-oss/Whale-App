import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabaseClient'
import { useAuth } from './auth'
import type { Conversation, Message, Order } from './types'

const NOTIF_PREF_KEY = 'whale.notificationsEnabled'

function mapOrderRow(row: Record<string, any>): Order {
  return {
    id: row.id,
    specialistId: row.specialist_id,
    date: new Date(row.booking_date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }),
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
    lastTime: new Date(row.last_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    unread: row.unread,
  }
}

function mapMessageRow(row: Record<string, any>): Message {
  return {
    id: row.id,
    from: row.sender,
    text: row.text,
    time: new Date(row.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    type: row.message_type,
    image: row.image_url ?? undefined,
  }
}

interface AppStore {
  ready: boolean
  orders: Order[]
  conversations: Conversation[]
  messagesByConversation: Record<string, Message[]>
  favorites: string[]
  notificationsEnabled: boolean
  loadMessages: (conversationId: string) => Promise<void>
  sendMessage: (conversationId: string, message: { from: 'me' | 'them'; text: string; type?: 'text' | 'image'; image?: string }) => Promise<void>
  markConversationRead: (conversationId: string) => Promise<void>
  toggleFavorite: (specialistId: string) => Promise<void>
  toggleNotifications: () => void
  clearAllData: () => Promise<void>
  confirmBooking: (input: {
    specialistId: string
    dateKey: string
    slot: string
    serviceName: string
    amount: number
  }) => Promise<{ order: Order; conversationId: string } | { error: string }>
  /**
   * Reserves the slot and creates the order in 'pending' status, for the
   * real Click/Payme redirect flow — confirmation to 'confirmed' happens
   * server-side via the payment webhook once the gateway reports success,
   * not from this call. Poll or refetch orders after the user returns from
   * the payment page to see the final status.
   */
  createPendingOrder: (input: {
    specialistId: string
    dateKey: string
    slot: string
    serviceName: string
    amount: number
  }) => Promise<{ order: Order } | { error: string }>
}

const AppStoreContext = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
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

    Promise.all([
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').eq('user_id', user.id).order('last_time', { ascending: false }),
      supabase.from('favorites').select('specialist_id').eq('user_id', user.id),
    ]).then(([ordersRes, convsRes, favsRes]) => {
      if (cancelled) return
      setOrders((ordersRes.data ?? []).map(mapOrderRow))
      setConversations((convsRes.data ?? []).map(mapConversationRow))
      setFavorites((favsRes.data ?? []).map(row => row.specialist_id))
      setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  const store = useMemo<AppStore>(() => ({
    ready,
    orders,
    conversations,
    messagesByConversation,
    favorites,
    notificationsEnabled,

    async loadMessages(conversationId) {
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
    },

    async sendMessage(conversationId, message) {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender: message.from,
          text: message.text,
          message_type: message.type ?? 'text',
          image_url: message.image ?? null,
        })
        .select()
        .single()
      if (error || !data) {
        console.error('Failed to send message', error)
        return
      }
      const mapped = mapMessageRow(data)
      setMessagesByConversation(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] ?? []), mapped],
      }))

      const unreadIncrement = message.from === 'them' ? 1 : 0
      const conv = conversations.find(c => c.id === conversationId)
      await supabase
        .from('conversations')
        .update({ last_message: message.text, last_time: new Date().toISOString(), unread: (conv?.unread ?? 0) + unreadIncrement })
        .eq('id', conversationId)
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, lastMessage: message.text, lastTime: mapped.time, unread: c.unread + unreadIncrement } : c
      ))
    },

    async markConversationRead(conversationId) {
      setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, unread: 0 } : c)))
      await supabase.from('conversations').update({ unread: 0 }).eq('id', conversationId)
    },

    async toggleFavorite(specialistId) {
      if (!user) return
      const isFav = favorites.includes(specialistId)
      setFavorites(prev => (isFav ? prev.filter(id => id !== specialistId) : [...prev, specialistId]))
      if (isFav) {
        await supabase.from('favorites').delete().eq('user_id', user.id).eq('specialist_id', specialistId)
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, specialist_id: specialistId })
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

    async clearAllData() {
      if (!user) return
      await Promise.all([
        supabase.from('messages').delete().in(
          'conversation_id',
          (await supabase.from('conversations').select('id').eq('user_id', user.id)).data?.map(r => r.id) ?? []
        ),
        supabase.from('conversations').delete().eq('user_id', user.id),
        supabase.from('orders').delete().eq('user_id', user.id),
        supabase.from('favorites').delete().eq('user_id', user.id),
      ])
      setOrders([])
      setConversations([])
      setMessagesByConversation({})
      setFavorites([])
    },

    async confirmBooking({ specialistId, dateKey, slot, serviceName, amount }) {
      if (!user) return { error: 'You must be signed in to book.' }

      // The unique constraint on (specialist_id, booking_date, booking_slot) is the
      // real safety net against double-booking — two clients racing for the same
      // slot will have exactly one insert succeed here, regardless of what the
      // calendar UI showed either of them a moment earlier.
      const { error: slotError } = await supabase
        .from('booked_slots')
        .insert({ specialist_id: specialistId, booking_date: dateKey, booking_slot: slot })
      if (slotError) {
        if (slotError.code === '23505') {
          return { error: 'That slot was just booked by someone else. Please pick another.' }
        }
        return { error: slotError.message }
      }

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          specialist_id: specialistId,
          service: serviceName,
          amount,
          status: 'confirmed',
          booking_date: dateKey,
          booking_slot: slot,
        })
        .select()
        .single()
      if (orderError || !orderRow) {
        return { error: orderError?.message ?? 'Failed to create the order.' }
      }
      const order = mapOrderRow(orderRow)
      setOrders(prev => [order, ...prev])

      const dateLabel = new Date(dateKey).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
      const confirmText = `Booking confirmed! Looking forward to our session on ${dateLabel} at ${slot} for "${serviceName}".`

      let conversationId: string
      const existing = conversations.find(c => c.specialistId === specialistId)
      if (existing) {
        conversationId = existing.id
        await supabase
          .from('conversations')
          .update({ last_message: confirmText, last_time: new Date().toISOString(), unread: existing.unread + 1 })
          .eq('id', conversationId)
        setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, lastMessage: confirmText, unread: c.unread + 1 } : c)))
      } else {
        const { data: convRow, error: convError } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, specialist_id: specialistId, last_message: confirmText, unread: 1 })
          .select()
          .single()
        if (convError || !convRow) {
          return { error: convError?.message ?? 'Failed to create the conversation.' }
        }
        conversationId = convRow.id
        setConversations(prev => [mapConversationRow(convRow), ...prev])
      }

      const { data: msgRow } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender: 'them', text: confirmText })
        .select()
        .single()
      if (msgRow) {
        const mapped = mapMessageRow(msgRow)
        setMessagesByConversation(prev => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), mapped] }))
      }

      return { order, conversationId }
    },

    async createPendingOrder({ specialistId, dateKey, slot, serviceName, amount }) {
      if (!user) return { error: 'You must be signed in to book.' }

      const { error: slotError } = await supabase
        .from('booked_slots')
        .insert({ specialist_id: specialistId, booking_date: dateKey, booking_slot: slot })
      if (slotError) {
        if (slotError.code === '23505') {
          return { error: 'That slot was just booked by someone else. Please pick another.' }
        }
        return { error: slotError.message }
      }

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          specialist_id: specialistId,
          service: serviceName,
          amount,
          status: 'pending',
          booking_date: dateKey,
          booking_slot: slot,
        })
        .select()
        .single()
      if (orderError || !orderRow) {
        return { error: orderError?.message ?? 'Failed to create the order.' }
      }
      const order = mapOrderRow(orderRow)
      setOrders(prev => [order, ...prev])
      return { order }
    },
  }), [ready, orders, conversations, messagesByConversation, favorites, notificationsEnabled, user])

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
  return ctx
}
