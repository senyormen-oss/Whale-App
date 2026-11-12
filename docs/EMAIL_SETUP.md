# E-mail confirmation that always arrives

Supabase's built-in mailer is meant for testing: it allows only a few e-mails per hour for the whole project,
so friends signing up get no letter. Fix it once with your own SMTP sender.

## 1. Brevo (free, 300 letters/day)
1. Register at https://www.brevo.com.
2. Brevo -> Senders, Domains & dedicated IPs -> **Senders** -> add a sender (your e-mail, name `Whale`) and confirm it from the letter Brevo sends.
3. Brevo -> top right menu -> **SMTP & API** -> **SMTP** tab -> **Generate a new SMTP key** (copy it once).
   On the same tab note the **Login** (looks like `xxxx@smtp-brevo.com`).

## 2. Supabase -> Authentication -> Emails -> SMTP Settings
Turn on **Enable custom SMTP** and fill in:

| Field | Value |
|---|---|
| Sender email | the e-mail you confirmed in Brevo |
| Sender name | `Whale` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | the Brevo **Login** from step 1.3 |
| Password | the **SMTP key** from step 1.3 |

Save. Then Authentication -> **Rate Limits**: raise "Emails sent per hour" (for example 30) and keep
"Minimum interval between emails" at 60 seconds.

## 3. Links must lead to the real site
Authentication -> **URL Configuration**
- Site URL: `https://whale-pwa.vercel.app`
- Redirect URLs: `https://whale-pwa.vercel.app/**`

## 4. Nicer letters (RU / EN / UZ in one)
Authentication -> Emails -> Templates:
- **Confirm sign up**: subject `Подтвердите почту · Confirm your email · Pochtani tasdiqlang — Whale`, body = `supabase/email-templates/confirm-signup.html`
- **Reset password**: subject `Сброс пароля · Reset your password · Parolni tiklash — Whale`, body = `supabase/email-templates/reset-password.html`

## 5. Check
Sign up with a new e-mail on https://whale-pwa.vercel.app. The letter should arrive within a minute
(check Spam the first time). Clicking the button opens the app and shows "Email confirmed".

## Later (recommended before the public launch)
Buy a domain, add it to Brevo (Domains -> add, then the DNS records it shows: SPF, DKIM, DMARC) and use
`noreply@yourdomain` as the sender. Letters from your own domain land in the inbox far more reliably
than letters from a free e-mail address.
