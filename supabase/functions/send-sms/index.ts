// Supabase Auth "Send SMS" hook: delivers one-time login codes through an Uzbek SMS gateway.
// Pick the gateway with the SMS_PROVIDER secret: "eskiz" (default) or "devsms".
//
// Setup (Supabase dashboard):
//   1. Edge Functions -> create a function named `send-sms`, paste this file, and turn OFF
//      "Verify JWT" (Auth calls it with a signed webhook, not a user token).
//   2. Edge Functions -> Secrets: SEND_SMS_HOOK_SECRET plus the gateway credentials:
//        Eskiz  : ESKIZ_EMAIL, ESKIZ_PASSWORD, optional ESKIZ_FROM (default 4546)
//        DevSMS : SMS_PROVIDER=devsms, DEVSMS_TOKEN, optional DEVSMS_MODE (universal|sms),
//                 DEVSMS_SERVICE_NAME (default Whale), DEVSMS_FROM, DEVSMS_URL
//      Optional for both: SMS_TEMPLATE (must contain {code}).
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

// DevSMS (devsms.uz). Two modes, chosen with the DEVSMS_MODE secret:
//   universal (default): "universal_otp" - DevSMS sends the code with one of its operator-approved
//                        templates (4 = sign-in), we only pass the service name and the code.
//   sms                : plain text; the text must match a template approved in the DevSMS cabinet.
async function sendThroughDevSms(phone: string, code: string, message: string): Promise<void> {
  const token = Deno.env.get('DEVSMS_TOKEN')
  if (!token) throw new Error('DevSMS token is not configured')
  const url = Deno.env.get('DEVSMS_URL') ?? 'https://devsms.uz/api/sms/send'
  const mode = (Deno.env.get('DEVSMS_MODE') ?? 'universal').toLowerCase()

  const body = mode === 'sms'
    ? { phone, message, from: Deno.env.get('DEVSMS_FROM') ?? '4546' }
    : {
        phone,
        type: 'universal_otp',
        template_type: 4, // 1 operation, 2 password reset, 3 sign-up, 4 sign-in
        service_name: Deno.env.get('DEVSMS_SERVICE_NAME') ?? 'Whale',
        otp_code: code,
      }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  let json: { success?: boolean; error?: string; charged?: boolean } = {}
  try { json = JSON.parse(text) } catch { /* not JSON */ }

  // A "charged: true" failure means the result is unknown; we never retry it automatically
  // (a retry could deliver the code twice).
  if (!res.ok || json.success === false) {
    throw new Error(`DevSMS send failed (${res.status}) ${(json.error ?? text).slice(0, 200)}`)
  }
}

async function sendSms(phone: string, code: string, message: string): Promise<void> {
  const provider = (Deno.env.get('SMS_PROVIDER') ?? 'eskiz').toLowerCase()
  if (provider === 'devsms') return sendThroughDevSms(phone, code, message)
  return sendThroughEskiz(phone, message)
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

  const template = Deno.env.get('SMS_TEMPLATE') ?? 'Код подтверждения для входа в Whale: {code}. Никому не сообщайте его.'
  try {
    await sendSms(phone, code, template.replace('{code}', code))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    return fail(502, 'Could not send the SMS')
  }

  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
})
