// Payme (Paycom) Merchant API webhook — implements the standard JSON-RPC
// methods (https://developer.help.paycom.uz — "Merchant API").
//
// DEPLOY: paste this file's contents into Supabase Dashboard → Edge Functions
// → New function → name it "payme-webhook" → Deploy. Then set this secret
// (Edge Functions → payme-webhook → Settings → Secrets, or `supabase secrets set`):
//   PAYME_KEY   — your merchant key from the Payme business cabinet
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already injected automatically.
//
// Give Payme this function's URL as your webhook endpoint in their merchant
// cabinet: https://<project-ref>.supabase.co/functions/v1/payme-webhook
//
// UNTESTED against live Payme traffic — no merchant account was available at
// build time. Verify against Payme's sandbox (test.paycom.uz) before
// accepting real payments; re-check the exact error-code table in their
// current docs, as Payme has revised details of this spec over time.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const PAYME_KEY = Deno.env.get('PAYME_KEY') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const PaymeError = {
  InvalidAuth: -32504,
  InvalidAmount: -31001,
  OrderNotFound: -31050,
  CantPerform: -31008,
  TransactionNotFound: -31003,
  AlreadyDone: -31060,
} as const

function rpcResult(id: unknown, result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { headers: { 'Content-Type': 'application/json' } })
}
function rpcError(id: unknown, code: number, message: string, field?: string) {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message: { ru: message, uz: message, en: message }, data: field } }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

function checkAuth(req: Request): boolean {
  const header = req.headers.get('authorization') ?? ''
  const expected = 'Basic ' + btoa(`Paycom:${PAYME_KEY}`)
  return header === expected
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await req.json()
  const { method, params, id } = body

  if (!checkAuth(req)) return rpcError(id, PaymeError.InvalidAuth, 'Invalid authorization')

  const orderId: string | undefined = params?.account?.order_id
  const amountTiyin: number | undefined = params?.amount

  async function loadOrder() {
    if (!orderId) return null
    const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
    return data
  }

  switch (method) {
    case 'CheckPerformTransaction': {
      const order = await loadOrder()
      if (!order) return rpcError(id, PaymeError.OrderNotFound, 'Order not found', 'account.order_id')
      if (Math.round(order.amount * 100) !== Math.round(amountTiyin ?? 0)) {
        return rpcError(id, PaymeError.InvalidAmount, 'Incorrect amount', 'amount')
      }
      if (order.status === 'confirmed' || order.status === 'completed') {
        return rpcError(id, PaymeError.CantPerform, 'Order already paid')
      }
      return rpcResult(id, { allow: true })
    }

    case 'CreateTransaction': {
      const paymeId: string = params.id
      const { data: existing } = await supabase.from('payment_transactions').select('*').eq('provider', 'payme').eq('provider_transaction_id', paymeId).maybeSingle()
      if (existing) {
        return rpcResult(id, {
          create_time: new Date(existing.created_at).getTime(),
          transaction: existing.id,
          state: existing.state === 'paid' ? 2 : existing.state === 'cancelled' ? -1 : 1,
        })
      }

      const order = await loadOrder()
      if (!order) return rpcError(id, PaymeError.OrderNotFound, 'Order not found', 'account.order_id')
      if (Math.round(order.amount * 100) !== Math.round(amountTiyin ?? 0)) {
        return rpcError(id, PaymeError.InvalidAmount, 'Incorrect amount', 'amount')
      }
      if (order.status === 'confirmed' || order.status === 'completed') {
        return rpcError(id, PaymeError.CantPerform, 'Order already paid')
      }

      const { data: txn, error: insertErr } = await supabase
        .from('payment_transactions')
        .insert({ order_id: order.id, provider: 'payme', provider_transaction_id: paymeId, amount: order.amount, state: 'pending', raw_payload: params })
        .select()
        .single()
      if (insertErr || !txn) return rpcError(id, PaymeError.CantPerform, 'Could not create transaction')

      return rpcResult(id, { create_time: new Date(txn.created_at).getTime(), transaction: txn.id, state: 1 })
    }

    case 'PerformTransaction': {
      const paymeId: string = params.id
      const { data: txn } = await supabase.from('payment_transactions').select('*').eq('provider', 'payme').eq('provider_transaction_id', paymeId).maybeSingle()
      if (!txn) return rpcError(id, PaymeError.TransactionNotFound, 'Transaction not found')

      if (txn.state === 'paid') {
        return rpcResult(id, { transaction: txn.id, perform_time: new Date(txn.updated_at).getTime(), state: 2 })
      }
      if (txn.state !== 'pending') {
        return rpcError(id, PaymeError.CantPerform, 'Transaction cannot be performed')
      }

      const now = new Date().toISOString()
      await supabase.from('payment_transactions').update({ state: 'paid', updated_at: now }).eq('id', txn.id)
      await supabase.from('orders').update({ status: 'confirmed', payment_provider: 'payme', payment_ref: paymeId }).eq('id', txn.order_id)

      return rpcResult(id, { transaction: txn.id, perform_time: new Date(now).getTime(), state: 2 })
    }

    case 'CancelTransaction': {
      const paymeId: string = params.id
      const { data: txn } = await supabase.from('payment_transactions').select('*').eq('provider', 'payme').eq('provider_transaction_id', paymeId).maybeSingle()
      if (!txn) return rpcError(id, PaymeError.TransactionNotFound, 'Transaction not found')

      const wasPaid = txn.state === 'paid'
      const now = new Date().toISOString()
      await supabase.from('payment_transactions').update({ state: 'cancelled', updated_at: now }).eq('id', txn.id)
      if (wasPaid) {
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', txn.order_id)
      }

      return rpcResult(id, { transaction: txn.id, cancel_time: new Date(now).getTime(), state: wasPaid ? -2 : -1 })
    }

    case 'CheckTransaction': {
      const paymeId: string = params.id
      const { data: txn } = await supabase.from('payment_transactions').select('*').eq('provider', 'payme').eq('provider_transaction_id', paymeId).maybeSingle()
      if (!txn) return rpcError(id, PaymeError.TransactionNotFound, 'Transaction not found')

      return rpcResult(id, {
        create_time: new Date(txn.created_at).getTime(),
        perform_time: txn.state === 'paid' ? new Date(txn.updated_at).getTime() : 0,
        cancel_time: txn.state === 'cancelled' ? new Date(txn.updated_at).getTime() : 0,
        transaction: txn.id,
        state: txn.state === 'paid' ? 2 : txn.state === 'cancelled' ? -1 : 1,
        reason: null,
      })
    }

    case 'GetStatement': {
      const { data: txns } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('provider', 'payme')
        .gte('created_at', new Date(params.from).toISOString())
        .lte('created_at', new Date(params.to).toISOString())

      return rpcResult(id, {
        transactions: (txns ?? []).map(t => ({
          id: t.provider_transaction_id,
          time: new Date(t.created_at).getTime(),
          amount: Math.round(t.amount * 100),
          account: { order_id: t.order_id },
          create_time: new Date(t.created_at).getTime(),
          perform_time: t.state === 'paid' ? new Date(t.updated_at).getTime() : 0,
          cancel_time: t.state === 'cancelled' ? new Date(t.updated_at).getTime() : 0,
          transaction: t.id,
          state: t.state === 'paid' ? 2 : t.state === 'cancelled' ? -1 : 1,
          reason: null,
        })),
      })
    }

    default:
      return rpcError(id, -32601, 'Method not found')
  }
})
