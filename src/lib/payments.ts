// Builds real Click / Payme checkout redirect URLs. Both are inert until
// their merchant env vars are set — see .env.example. Until then the app
// falls back to the simulated "held by Whale" confirmation flow, which is
// clearly labeled as a simulation in the UI (see BookingScreen).

const CLICK_MERCHANT_ID = import.meta.env.VITE_CLICK_MERCHANT_ID ?? ''
const CLICK_SERVICE_ID = import.meta.env.VITE_CLICK_SERVICE_ID ?? ''
const PAYME_MERCHANT_ID = import.meta.env.VITE_PAYME_MERCHANT_ID ?? ''

export const isClickConfigured = Boolean(CLICK_MERCHANT_ID && CLICK_SERVICE_ID)
export const isPaymeConfigured = Boolean(PAYME_MERCHANT_ID)

export function buildClickPaymentUrl(orderId: string, amount: number, returnUrl: string): string {
  const params = new URLSearchParams({
    service_id: CLICK_SERVICE_ID,
    merchant_id: CLICK_MERCHANT_ID,
    amount: String(amount),
    transaction_param: orderId,
    return_url: returnUrl,
  })
  return `https://my.click.uz/services/pay?${params.toString()}`
}

export function buildPaymePaymentUrl(orderId: string, amount: number, returnUrl: string): string {
  const amountTiyin = Math.round(amount * 100)
  const raw = `m=${PAYME_MERCHANT_ID};ac.order_id=${orderId};a=${amountTiyin};c=${returnUrl}`
  const encoded = btoa(raw)
  return `https://checkout.paycom.uz/${encoded}`
}
