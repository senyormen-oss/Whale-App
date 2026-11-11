# Phone login by SMS code (Eskiz)

The code is already in the app but hidden until you switch it on. Nothing here changes email login.

## 1. Eskiz account
1. Register at https://eskiz.uz and open the SMS cabinet.
2. Ask Eskiz support: *Which documents are needed for an individual / IP? Is the SMS text template moderated, and which sender name can I use for one-time codes?*
3. Get this text approved (or use the one Eskiz allows):
   `Код подтверждения для входа в Whale: 123456. Никому не сообщайте его.` (submit with a real example code; the function replaces it with the actual code)
4. Top up the balance. Every login or sign-up code is one SMS.

## 2. Supabase Edge Function
1. Supabase → Edge Functions → **Deploy a new function** → name `send-sms` → paste `supabase/functions/send-sms/index.ts`.
2. Turn **OFF** "Verify JWT" for this function (Auth calls it with a signed webhook).
3. Edge Functions → **Secrets**, add:
   - `ESKIZ_EMAIL` – the e-mail of your Eskiz account
   - `ESKIZ_PASSWORD` – its password
   - `SEND_SMS_HOOK_SECRET` – filled in step 4
   - optional `ESKIZ_FROM` (sender, default `4546`) and `SMS_TEMPLATE` (must contain `{code}`)

## 3. Supabase Auth
1. Authentication → **Hooks** → **Send SMS** → type *Supabase Edge Function* → `send-sms` → create the hook and copy its **secret**.
2. Put that secret into `SEND_SMS_HOOK_SECRET` (step 2.3).
3. Authentication → Providers → **Phone** → enable. Set the SMS OTP length to 6.
4. Authentication → Rate Limits: keep "SMS messages sent" low (for example 30 per hour) to limit cost abuse.

## 4. Switch it on
In Vercel (project `whale-pwa`) add the environment variable `VITE_PHONE_AUTH=true` and redeploy. The sign-in screen then shows "Sign in with phone number".

## Notes
- Only Uzbekistan numbers (+998) are accepted by the function.
- A first phone login creates the account and asks for a name once.
- Phone and e-mail accounts are separate accounts.
