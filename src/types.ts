export type Level = 'bronze' | 'silver' | 'gold' | 'platinum'
export type CategoryKey =
  | 'video' | 'mobile' | 'smm' | 'target' | 'content'
  | 'blogger' | 'photo' | 'prog' | 'web' | 'design' | 'model'

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
  avatar: string
  cover: string
  portfolio: string[]
  tags: string[]
  available: boolean
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
}

export interface Order {
  id: string
  specialistId: string
  date: string
  service: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  amount: number
}

export type Screen =
  | { name: 'home' }
  | { name: 'search'; category?: CategoryKey; query?: string }
  | { name: 'specialist'; id: string }
  | { name: 'booking'; specialistId: string }
  | { name: 'chats' }
  | { name: 'chat'; conversationId: string }
  | { name: 'dashboard' }
  | { name: 'bookings' }

export type TabName = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'
