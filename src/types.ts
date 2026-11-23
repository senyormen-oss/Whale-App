export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'needs_changes'
export type Level = 'bronze' | 'silver' | 'gold' | 'platinum'
export type CategoryKey =
  | 'video' | 'mobile' | 'smm' | 'target' | 'content'
  | 'blogger' | 'photo' | 'prog' | 'web' | 'design' | 'model'
  | 'marketer' | 'brand'

export interface Specialist {
  id: string
  ownerId?: string
  name: string
  category: string
  categoryKey: CategoryKey
  city: string
  age: number
  experience: number
  projects: number
  reviews: number
  rating: number
  price: number
  verified: boolean
  level: Level
  bio: string
  /** Education, courses, certificates (free text, optional). */
  qualification: string
  avatar: string
  cover: string
  portfolio: string[]
  tags: string[]
  available: boolean
  /** Listings are visible to clients only after a Whale administrator approves them. */
  approved: boolean
  moderationStatus: ModerationStatus
  /** Why the moderators rejected the listing or asked for changes. */
  moderationComment: string
  /** Owner switch: an approved listing can be hidden from the catalog without deleting it. */
  published: boolean
  isNew?: boolean
}

export interface Review {
  id: string
  author: string
  avatar: string
  rating: number
  date: string
  text: string
  quality: number
  timing: number
  communication: number
}

export interface Message {
  id: string
  from: 'me' | 'them'
  text: string
  time: string
  type?: 'text' | 'image'
  image?: string
}

export interface Conversation {
  id: string
  specialistId: string
  lastMessage: string
  lastTime: string
  unread: number
  /** Unread count from the specialist's side of the thread. */
  specialistUnread?: number
}

export type Currency = 'UZS' | 'USD'
export type Billing = 'one_time' | 'package' | 'monthly' | 'quote'

/** One line of a listing's price list. `price` is null for "price on request". */
export interface ListingService {
  id: string
  specialistId: string
  title: string
  description: string
  billing: Billing
  sessions: number
  price: number | null
  priceFrom: boolean
  currency: Currency
  position: number
}

export interface Order {
  id: string
  specialistId: string
  date: string
  rawDate?: string
  service: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  amount: number
  currency: Currency
  billing: Billing
}

export type Screen =
  | { name: 'home' }
  | { name: 'search'; category?: CategoryKey; query?: string }
  | { name: 'specialist'; id: string }
  | { name: 'booking'; specialistId: string; packageId?: string; serviceId?: string; custom?: boolean }
  | { name: 'chats' }
  | { name: 'chat'; conversationId: string }
  | { name: 'dashboard' }
  | { name: 'bookings' }

export type TabName = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'
