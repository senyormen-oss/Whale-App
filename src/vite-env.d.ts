/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_CLICK_MERCHANT_ID?: string
  readonly VITE_CLICK_SERVICE_ID?: string
  readonly VITE_PAYME_MERCHANT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
