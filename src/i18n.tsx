import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type Key } from './locales/en'
import { ru } from './locales/ru'
import { uz } from './locales/uz'

export type Lang = 'en' | 'ru' | 'uz'
export const LANGS: { code: Lang; label: string; name: string; locale: string }[] = [
  { code: 'en', label: 'EN', name: 'English', locale: 'en-GB' },
  { code: 'ru', label: 'RU', name: 'Русский', locale: 'ru-RU' },
  { code: 'uz', label: 'UZ', name: "O'zbekcha", locale: 'uz-UZ' },
]

const DICTS: Record<Lang, Record<Key, string>> = { en, ru, uz }
const STORAGE_KEY = 'whale.lang'

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ru' || saved === 'uz') return saved
  } catch { /* storage unavailable */ }
  const nav = (navigator.language || 'en').toLowerCase()
  if (nav.startsWith('ru')) return 'ru'
  if (nav.startsWith('uz')) return 'uz'
  return 'en'
}

// Module-level current language so non-React code (store toasts, query helpers) can translate too.
let currentLang: Lang = detectLang()

export function getLang(): Lang {
  return currentLang
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let text = DICTS[currentLang][key] ?? en[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value))
  }
  return text
}

const MONTHS_LONG: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
}
const MONTHS_SHORT: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
}
const WEEKDAYS: Record<Lang, string[]> = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  uz: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
}

/** Full month name (0-based index) in the active language, e.g. "Ноябрь". */
export function monthName(index: number): string {
  return MONTHS_LONG[currentLang][index]
}

/** Monday-first weekday abbreviations in the active language. */
export function weekdayLabels(): string[] {
  return WEEKDAYS[currentLang]
}

function toDate(input: string | Date): Date {
  return typeof input === 'string' ? new Date(input.length <= 10 ? `${input}T12:00:00` : input) : input
}

/** "8 Nov 2026" / "8 ноя 2026" / "8 noy 2026" from an ISO string or Date. */
export function formatDate(input: string | Date): string {
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return String(input)
  return `${d.getDate()} ${MONTHS_SHORT[currentLang][d.getMonth()]} ${d.getFullYear()}`
}

/** 24-hour "HH:MM" in the user's local time zone. */
export function formatTime(input: string | Date): string {
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatNumber(n: number): string {
  const locale = LANGS.find(l => l.code === currentLang)!.locale
  return new Intl.NumberFormat(locale).format(n)
}

/**
 * Booking confirmations are written by a database trigger in English. Turn that exact
 * sentence into the active language; any other text is returned unchanged.
 */
export function localizeSystemMessage(text: string): string {
  if (text === 'Photo') return t('chat.photo')
  const m = text.match(/^Booking confirmed! Looking forward to our session on (.+) at (\d{2}:\d{2}) for "(.*)"\.$/)
  if (!m) return text
  const d = new Date(m[1])
  const date = Number.isNaN(d.getTime()) ? m[1] : formatDate(d)
  return t('chat.bookingConfirmed', { date, time: m[2], service: m[3] })
}
interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
  t: typeof t
}

const I18nContext = createContext<I18nState | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang)

  const setLang = useCallback((next: Lang) => {
    currentLang = next
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
    setLangState(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // `lang` is part of the value so every consumer re-renders when it changes.
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
