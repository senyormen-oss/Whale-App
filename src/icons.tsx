import type { ComponentType, CSSProperties } from 'react'
import {
  Home, Search, ClipboardList, MessageCircle, User,
  Video, Smartphone, BarChart3, Target, PenSquare, Newspaper, Camera, Code2, Globe, Palette, Shirt,
  Bell, Heart, Share2, BadgeCheck, Star, Medal, Award, Gem,
  ChevronLeft, ChevronRight, CreditCard, Wallet, Landmark, Lock, PartyPopper, Sparkles,
  Phone, Paperclip, MapPin, Image as ImageIcon, FileText, Smile, ArrowUp, ArrowLeft,
  Settings, Briefcase, Users, TrendingUp, CheckCircle2, Calendar, Bot, Folder,
  MessageSquareText, Circle, X, LogOut, Trash2, Bookmark, SlidersHorizontal, SearchX,
  Mail, Loader2, AlertCircle, Eye, EyeOff, WifiOff, Sun, Moon, Monitor, Check, ChevronDown,
} from 'lucide-react'
import type { CategoryKey, Level } from './types'

export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string; style?: CSSProperties; fill?: string }>

export const CATEGORY_ICONS: Record<CategoryKey, IconType> = {
  video: Video,
  mobile: Smartphone,
  smm: BarChart3,
  target: Target,
  content: PenSquare,
  blogger: Newspaper,
  photo: Camera,
  prog: Code2,
  web: Globe,
  design: Palette,
  model: Shirt,
}

export const LEVEL_ICONS: Record<Level, { icon: IconType; color: string }> = {
  bronze: { icon: Medal, color: '#CD7F32' },
  silver: { icon: Medal, color: '#C0C0C0' },
  gold: { icon: Award, color: '#FFD700' },
  platinum: { icon: Gem, color: '#E5E4E2' },
}

export const SUBSCRIPTION_ICONS: Record<string, IconType> = {
  single: Target,
  bronze: Medal,
  silver: Medal,
  gold: Award,
}

export {
  Home, Search, ClipboardList, MessageCircle, User,
  Bell, Heart, Share2, BadgeCheck, Star, BarChart3,
  ChevronLeft, ChevronRight, CreditCard, Wallet, Landmark, Lock, PartyPopper, Sparkles,
  Phone, Paperclip, MapPin, ImageIcon, FileText, Smile, ArrowUp, ArrowLeft,
  Settings, Briefcase, Users, TrendingUp, CheckCircle2, Calendar, Bot, Folder,
  MessageSquareText, Circle, X, LogOut, Trash2, Bookmark, SlidersHorizontal, SearchX,
  Mail, Loader2, AlertCircle, Eye, EyeOff, WifiOff, Sun, Moon, Monitor, Check, ChevronDown, Camera,
}
