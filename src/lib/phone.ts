/** Phone login is shown only when it has been switched on (after the SMS provider is configured). */
export const PHONE_AUTH_ENABLED = import.meta.env.VITE_PHONE_AUTH === 'true'

/**
 * Turns what a person types ("90 123 45 67", "+998 90 123-45-67", "998901234567") into
 * E.164 "+998901234567", or null when it is not a valid Uzbekistan mobile number.
 */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  let national: string
  if (digits.length === 9) national = digits
  else if (digits.length === 12 && digits.startsWith('998')) national = digits.slice(3)
  else return null
  return `+998${national}`
}

/** "+998901234567" -> "+998 90 123 45 67" for display. */
export function formatUzPhone(e164: string): string {
  const d = e164.replace(/\D/g, '')
  if (d.length !== 12) return e164
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`
}
