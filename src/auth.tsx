import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './lib/supabaseClient'
import { LEGAL } from './legal'
import { t } from './i18n'

interface AuthState {
  user: User | null
  loading: boolean
  configured: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resendConfirmation: (email: string) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  /** Saves (or clears, with null) the profile photo URL in the user's metadata. */
  updateAvatar: (url: string | null) => Promise<{ error: string | null }>
  /** Saves the display name in the user's metadata. */
  updateName: (fullName: string) => Promise<{ error: string | null }>
  /** True after the user opened a password-reset link; they must choose a new password before using the app. */
  recovering: boolean
  finishRecovery: () => void
}

/** Returns a human-readable problem with the password, or null if it is acceptable. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return t('auth.pw.short')
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return t('auth.pw.weak')
  if (password.length > 72) return t('auth.pw.long')
  return null
}

/** Turns raw Supabase auth errors into short, friendly messages. */
function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return t('auth.err.credentials')
  if (/already registered|already been registered/i.test(message)) return t('auth.err.exists')
  if (/rate limit|too many/i.test(message)) return t('auth.err.rate')
  if (/network|failed to fetch/i.test(message)) return t('auth.err.network')
  if (/same.*password/i.test(message)) return t('auth.err.samePassword')
  if (/invalid.*email|email.*invalid/i.test(message)) return t('auth.err.email')
  return message
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Record which legal documents the user accepted, and when.
        data: {
          full_name: fullName,
          terms_accepted_at: new Date().toISOString(),
          terms_version: LEGAL.termsVersion,
          privacy_version: LEGAL.privacyVersion,
        },
        emailRedirectTo: window.location.origin,
      },
    })
    return { error: error ? friendlyAuthError(error.message) : null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    // Keep the raw text for "email not confirmed" so the UI can offer to resend it.
    if (error && /email.*not.*confirmed/i.test(error.message)) return { error: error.message }
    return { error: error ? friendlyAuthError(error.message) : null }
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    return { error: error ? friendlyAuthError(error.message) : null }
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error ? friendlyAuthError(error.message) : null }
  }

  async function updateAvatar(url: string | null) {
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } })
    return { error: error ? friendlyAuthError(error.message) : null }
  }

  async function updateName(fullName: string) {
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } })
    return { error: error ? friendlyAuthError(error.message) : null }
  }

  function finishRecovery() {
    setRecovering(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } })
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null, loading, configured: isSupabaseConfigured,
        signUp, signIn, signOut, resendConfirmation, resetPassword, updatePassword, updateAvatar, updateName, recovering, finishRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
