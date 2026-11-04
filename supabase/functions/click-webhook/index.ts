// Click.uz Merchant API webhook — implements the standard Prepare/Complete
// two-step flow (https://docs.click.uz — "Merchant API").
//
// DEPLOY: paste this file's contents into Supabase Dashboard → Edge Functions
// → New function → name it "click-webhook" → Deploy. Then set these secrets
// (Edge Functions → click-webhook → Settings → Secrets, or `supabase secrets set`):
//   CLICK_SECRET_KEY   — from your Click merchant cabinet
//   CLICK_SERVICE_ID   — from your Click merchant cabinet
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already injected automatically.
//
// Give Click this function's URL as your "Prepare/Complete URL" in their
// merchant cabinet: https://<project-ref>.supabase.co/functions/v1/click-webhook
//
// UNTESTED against live Click traffic — no merchant account was available at
// build time. Verify against Click's sandbox before accepting real payments,
// and double-check the exact error-code table in their current docs; the
// codes below reflect their commonly published spec but Click has been known
// to adjust details between integration-guide revisions.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SECRET_KEY = Deno.env.get('CLICK_SECRET_KEY') ?? ''
const SERVICE_ID = Deno.env.get('CLICK_SERVICE_ID') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ClickError = {
  Success: 0,
  SignFailed: -1,
  InvalidAmount: -2,
  ActionNotFound: -3,
  AlreadyPaid: -4,
  OrderNotFound: -5,
  TransactionNotFound: -6,
  RequestFailed: -8,
  TransactionCancelled: -9,
} as const

async function md5(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('MD5', bytes)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function respond(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const contentType = req.headers.get('content-type') ?? ''
  const params: Record<string, string> = contentType.includes('application/json')
    ? await req.json()
    : Object.fromEntries(new URLSearchParams(await req.text()))

  const {
    click_trans_id, service_id, click_paydoc_id, merchant_trans_id,
    amount, action, sign_time, sign_string, merchant_prepare_id, error,
  } = params

  if (service_id !== SERVICE_ID) {
    return respond({ error: ClickError.RequestFailed, error_note: 'Unknown service_id' })
  }

  const expectedSign = await md5(
    action === '1'
      ? `${click_trans_id}${service_id}${SECRET_KEY}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`
      : `${click_trans_id}${service_id}${SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`
  )
  if (expectedSign !== sign_string) {
    return respond({ error: ClickError.SignFailed, error_note: 'Invalid signature' })
  }

  // merchant_trans_id is the Whale order id we generated at checkout time.
  const { data: order } = await supabase.from('orders').select('*').eq('id', merchant_trans_id).maybeSingle()
  if (!order) {
    return respond({ error: ClickError.OrderNotFound, error_note: 'Order not found' })
  }
  if (Math.round(order.amount) !== Math.round(Number(amount))) {
    return respond({ error: ClickError.InvalidAmount, error_note: 'Amount mismatch' })
  }

  if (action === '0') {
    // Prepare: reserve the transaction, don't mark the order paid yet.
    if (order.status === 'confirmed' || order.status === 'completed') {
      return respond({ error: ClickError.AlreadyPaid, error_note: 'Already paid' })
    }
    const { data: txn, error: insertErr } = await supabase
      .from('payment_transactions')
      .insert({ order_id: order.id, provider: 'click', provider_transaction_id: click_trans_id, amount: Number(amount), state: 'pending', raw_payload: params })
      .select()
      .single()
    if (insertErr || !txn) return respond({ error: ClickError.RequestFailed, error_note: 'Could not create transaction' })

    return respond({
      click_trans_id, merchant_trans_id, merchant_prepare_id: txn.id,
      error: ClickError.Success, error_note: 'Success',
    })
  }

  if (action === '1') {
    const { data: txn } = await supabase.from('payment_transactions').select('*').eq('id', merchant_prepare_id).maybeSingle()
    if (!txn) return respond({ error: ClickError.TransactionNotFound, error_note: 'Transaction not found' })

    if (error && Number(error) < 0) {
      await supabase.from('payment_transactions').update({ state: 'cancelled', updated_at: new Date().toISOString() }).eq('id', txn.id)
      return respond({ click_trans_id, merchant_trans_id, merchant_confirm_id: txn.id, error: ClickError.TransactionCancelled, error_note: 'Cancelled by Click' })
    }

    await supabase.from('payment_transactions').update({ state: 'paid', provider_transaction_id: click_paydoc_id ?? click_trans_id, updated_at: new Date().toISOString() }).eq('id', txn.id)
    await supabase.from('orders').update({ status: 'confirmed', payment_provider: 'click', payment_ref: String(click_trans_id) }).eq('id', order.id)

    return respond({ click_trans_id, merchant_trans_id, merchant_confirm_id: txn.id, error: ClickError.Success, error_note: 'Success' })
  }

  return respond({ error: ClickError.ActionNotFound, error_note: 'Unknown action' })
})
