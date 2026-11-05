import { supabase } from './supabaseClient'

/**
 * Subscribes to row changes on the given public tables. What each user receives
 * is still filtered by Row Level Security, so this never leaks other people's rows.
 * Returns an unsubscribe function.
 */
export function subscribeToTables(tables: string[], onChange: () => void): () => void {
  let timer: number | undefined
  // Collapse bursts of events (e.g. trigger-written rows) into one refresh.
  const debounced = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(onChange, 250)
  }

  let channel = supabase.channel(`whale-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`)
  for (const table of tables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, debounced)
  }
  channel.subscribe()

  return () => {
    window.clearTimeout(timer)
    supabase.removeChannel(channel)
  }
}
