import { supabase } from './supabaseClient'
import { mapPackageRow, type PackageInfo } from './admin'

/** The signed-in client's packages (RLS returns only their own). */
export async function fetchMyPackages(userId: string): Promise<PackageInfo[]> {
  const { data, error } = await supabase.from('packages').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPackageRow)
}

export function isPackageUsable(p: PackageInfo): boolean {
  return p.status === 'active' && !!p.expiresAt && new Date(p.expiresAt).getTime() > Date.now() && p.used < p.planTotal
}
