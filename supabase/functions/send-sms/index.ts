// Supabase Auth "Send SMS" hook: delivers one-time login codes through Eskiz (eskiz.uz).
//
// Setup (Supabase dashboard):
//   1. Edge Functions -> create a function named `send-sms`, paste this file, and turn OFF
//      "Verify JWT" (Auth calls it with a signed webhook, not a user token).
//   2. Edge Functions -> Secrets: ESKIZ_EMAIL, ESKIZ_PASSWORD, SEND_SMS_HOOK_SECRET.
//      Optional: ESKIZ_FROM (sender, default 4546), SMS_TEMPLATE (must contain {code}).
//   3. Authentication -> Hooks -> Send SMS -> choose this function, generate the secret and put
//      it into SEND_SMS_HOOK_SECRET.
//   4. Authentication -> Providers -> Phone -> enable.
//
// Security: the request signature is verified (Standard Webhooks), and only Uzbekistan numbers
// (+998) are accepted, so the endpoint cannot be abused to send expensive international SMS.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const ESKIZ = 'https://notify.eskiz.uz/api'

let cachedToken: { value: string; expires: number } | null = null

async function eskizLogin(): Promise<string> {
  const email = Deno.env.get('ESKIZ_EMAIL')
  const password = Deno.env.get('ESKIZ_PASSWORD')
  if (!email || !password) throw new Error('Eskiz credentials are not configured')

  const form = new FormData()
  form.append('email', email)
  form.append('password', password)
  const res = await fetch(`${ESKIZ}/auth/login`, { method: 'POST', body: form })
  const json = await res.json().catch(() => ({}))
  const token = json?.data?.token
  if (!res.ok || !token) throw new Error(`Eskiz login failed (${res.status})`)
  // Tokens live about 30 days; refresh after 25.
  cachedToken = { value: token, expires: Date.now() + 25 * 24 * 3600 * 1000 }
  return token
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value
  return eskizLogin()
}

async function sendThroughEskiz(phone: string, message: string, retry = true): Promise<void> {
  const token = await getToken()
  const form = new FormData()
  form.append('mobile_phone', phone)
  form.append('message', message)
  form.append('from', Deno.env.get('ESKIZ_FROM') ?? '4546')

  const res = await fetch(`${ESKIZ}/message/sms/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (res.status === 401 && retry) {
    cachedToken = null
    return sendThroughEskiz(phone, message, false)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Eskiz send failed (${res.status}) ${text.slice(0, 200)}`)
  }
}

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async req => {
  if (req.method !== 'POST') return fail(405, 'Method not allowed')

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET')?.replace('v1,whsec_', '')
  if (!secret) return fail(500, 'Hook secret is not configured')

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  let data: { user: { phone: string }; sms: { otp: string } }
  try {
    data = new Webhook(secret).verify(payload, headers) as typeof data
  } catch {
    return fail(401, 'Invalid signature')
  }

  const phone = String(data.user?.phone ?? '').replace(/\D/g, '')
  const code = String(data.sms?.otp ?? '')
  if (!/^998\d{9}$/.test(phone)) return fail(400, 'Only Uzbekistan phone numbers are supported')
  if (!/^\d{4,8}$/.test(code)) return fail(400, 'Invalid code')

  const template = Deno.env.get('SMS_TEMPLATE') ?? 'Whale: ваш код подтверждения {code}. Никому не сообщайте его.'
  try {
    await sendThroughEskiz(phone, template.replace('{code}', code))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    return fail(502, 'Could not send the SMS')
  }

  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
})
