import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local — see .env.example.'
  )
}

// Falls back to placeholder values so `createClient` never throws when the
// env vars are missing; `isSupabaseConfigured` gates all real usage instead.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder')
