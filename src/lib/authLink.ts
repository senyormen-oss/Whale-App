/**
 * What the e-mail link in the address bar told us. This module must be imported FIRST in main.tsx:
 * the Supabase client clears the URL hash as soon as it has processed it, so we read it before that.
 *
 *  - `#error=access_denied&error_code=otp_expired…`  -> the link was expired or already used
 *  - `#access_token=…&type=signup`                    -> the e-mail address was just confirmed
 */
export interface AuthLinkInfo {
  /** Supabase error code (for example "otp_expired"), or null. */
  error: string | null
  /** True right after the person clicked the confirmation link. */
  confirmed: boolean
}

function read(): AuthLinkInfo {
  try {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash || hash.startsWith('specialist/')) return { error: null, confirmed: false }
    const params = new URLSearchParams(hash)
    if (params.get('error') || params.get('error_code')) {
      return { error: params.get('error_code') ?? params.get('error') ?? 'error', confirmed: false }
    }
    return { error: null, confirmed: params.get('type') === 'signup' || params.get('type') === 'email_change' }
  } catch {
    return { error: null, confirmed: false }
  }
}

export const authLinkInfo: AuthLinkInfo = read()

/** Removes the (now useless) error hash so a refresh does not show the notice again. */
export function clearAuthLinkHash() {
  try {
    if (/error/.test(window.location.hash)) history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    /* ignore */
  }
}
