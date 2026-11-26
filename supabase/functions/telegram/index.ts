// Whale Telegram bot.
//
// Two kinds of calls arrive here:
//   1. From the database (trigger -> pg_net), header `x-whale-secret`: a notification to forward
//      to the user's linked Telegram chat, or a new request for the Whale team chat.
//   2. From Telegram (bot webhook), header `x-telegram-bot-api-secret-token`: users linking their
//      account with "/start <code>", "/stop" to unlink, "/chatid" to learn a chat's id.
//
// Setup (Supabase dashboard):
//   1. Edge Functions -> Deploy a new function -> name `telegram` -> paste this file -> deploy,
//      then turn OFF "Verify JWT" for it (Telegram and the database do not send user tokens).
//   2. Edge Functions -> Secrets:
//        TELEGRAM_BOT_TOKEN       token from @BotFather
//        TELEGRAM_WEBHOOK_SECRET  any long random string (also used in the setWebhook call)
//        WHALE_HOOK_SECRET        the same value stored in private.settings 'telegram_hook_secret'
//        TELEGRAM_TEAM_CHAT_ID    id of the team group (optional; get it with /chatid in the group)
//      SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const BOT = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const HOOK_SECRET = Deno.env.get('WHALE_HOOK_SECRET') ?? ''
const TEAM_CHAT = Deno.env.get('TELEGRAM_TEAM_CHAT_ID') ?? ''
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SITE = 'https://whale-pwa.vercel.app'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function tg(method: string, body: Record<string, unknown>) {
  if (!BOT) return
  const res = await fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error('telegram', method, res.status, await res.text().catch(() => ''))
}

const send = (chatId: string | number, text: string) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`db ${path} ${res.status} ${await res.text().catch(() => '')}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

type Data = Record<string, string | number | null | undefined>

function money(d: Data) {
  if (d.billing === 'quote' && Number(d.amount) === 0) return 'цена по запросу'
  const n = new Intl.NumberFormat('ru-RU').format(Number(d.amount ?? 0))
  const base = d.currency === 'USD' ? `$${n}` : `${n} сум`
  return d.billing === 'monthly' ? `${base} / мес` : base
}

function when(d: Data) {
  const date = d.date ? new Date(`${d.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : ''
  return `${date}, ${String(d.slot ?? '').replace('-', '–')}`
}

const service = (d: Data) => (d.service === 'Custom quote' ? 'Индивидуальный запрос' : String(d.service ?? ''))

/** Russian text of a notification (the bot speaks Russian; the app itself is translated). */
function textFor(kind: string, d: Data, team = false): string {
  const who = esc(d.specialist_name)
  switch (kind) {
    case 'new_request':
      return [
        team ? `🆕 <b>Новая заявка</b> · ${who}` : `🆕 <b>Новая заявка</b> на «${who}»`,
        `${esc(service(d))} · ${esc(money(d))}`,
        `📅 ${esc(when(d))}`,
        d.client_name ? `👤 ${esc(d.client_name)}${d.phone ? ` · ${esc(d.phone)}` : ''}` : d.phone ? `📞 ${esc(d.phone)}` : '',
        d.note ? `💬 ${esc(d.note)}` : '',
        team ? '' : `\nПодтвердите или отклоните в кабинете: ${SITE}`,
      ].filter(Boolean).join('\n')
    case 'request_confirmed':
      return `✅ <b>Заявка подтверждена</b>\n${who} · ${esc(service(d))}\n📅 ${esc(when(d))}`
    case 'request_cancelled':
      return `❌ <b>Заявка отклонена</b>\n${who} · ${esc(service(d))}\n📅 ${esc(when(d))}`
    case 'request_completed':
      return `🎉 <b>Заказ выполнен</b>\n${who} · ${esc(service(d))}\nОставьте отзыв в приложении: ${SITE}`
    case 'client_cancelled':
      return `↩️ <b>Клиент отменил заявку</b> на «${who}»\n${esc(service(d))} · 📅 ${esc(when(d))}`
    case 'listing_approved':
      return `✅ Анкета «${who}» одобрена и видна в каталоге.`
    case 'listing_rejected':
      return `⛔ Анкета «${who}» отклонена.${d.comment ? `\nПричина: ${esc(d.comment)}` : ''}`
    case 'listing_needs_changes':
      return `✏️ Анкету «${who}» нужно исправить.${d.comment ? `\nКомментарий: ${esc(d.comment)}` : ''}`
    default:
      return ''
  }
}

async function fromDatabase(payload: { team?: boolean; user_id?: string; kind: string; data: Data }) {
  if (payload.team) {
    if (TEAM_CHAT) await send(TEAM_CHAT, textFor(payload.kind, payload.data, true))
    return
  }
  if (!payload.user_id) return
  const rows = await db(`telegram_links?select=chat_id&user_id=eq.${encodeURIComponent(payload.user_id)}`)
  const chat = rows?.[0]?.chat_id
  const text = textFor(payload.kind, payload.data)
  if (chat && text) await send(chat, text)
}

async function fromTelegram(update: any) {
  const msg = update?.message
  const chatId = msg?.chat?.id
  const text: string = (msg?.text ?? '').trim()
  if (!chatId || !text) return

  if (text === '/chatid' || text.startsWith('/chatid@')) {
    await send(chatId, `ID этого чата: <code>${chatId}</code>`)
    return
  }
  if (text === '/stop') {
    await db(`telegram_links?chat_id=eq.${chatId}`, { method: 'DELETE' })
    await send(chatId, 'Уведомления Whale отключены. Подключить снова можно в профиле приложения.')
    return
  }
  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1] ?? ''
    if (!/^[a-f0-9]{24}$/.test(code)) {
      await send(chatId, `Это бот уведомлений Whale.\nЧтобы получать уведомления, нажмите «Подключить Telegram» в профиле: ${SITE}`)
      return
    }
    const rows = await db(`telegram_link_codes?select=user_id,expires_at&code=eq.${code}`)
    const row = rows?.[0]
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      await send(chatId, 'Ссылка устарела. Нажмите «Подключить Telegram» в приложении ещё раз.')
      return
    }
    await db('telegram_links?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: row.user_id, chat_id: chatId, linked_at: new Date().toISOString() }),
    })
    await db(`telegram_link_codes?code=eq.${code}`, { method: 'DELETE' })
    await send(chatId, '✅ Готово! Уведомления Whale о заявках будут приходить сюда.\nОтключить: /stop')
  }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok')
  try {
    if (HOOK_SECRET && req.headers.get('x-whale-secret') === HOOK_SECRET) {
      await fromDatabase(await req.json())
      return new Response('ok')
    }
    if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') === WEBHOOK_SECRET) {
      await fromTelegram(await req.json())
      return new Response('ok')
    }
    return new Response('forbidden', { status: 403 })
  } catch (err) {
    console.error(err)
    // Always 200 to Telegram so it does not retry forever.
    return new Response('ok')
  }
})
