# Whale — architecture review and development plan

Prepared from the client's technical specification (items 1–8 + addendum). Estimates are for one developer working full time,
including testing, and do not include waiting for third parties (lawyer, payment provider, SMS moderation).

## 1. What already exists (do not duplicate)

| Area requested | Current state |
|---|---|
| Registration | E-mail + password, phone + SMS code (DevSMS), password reset, consent to Terms/Privacy |
| Client / specialist roles | One account, two modes (Profile → Client / Specialist), plus Admin for the team |
| Specialist listing | Create, edit, portfolio photos (up to 12), qualification, experience, availability toggle |
| Moderation | Exists in a simple form: a new listing is hidden until an administrator approves it (boolean `approved`) |
| Booking | Calendar + time slots, requests, slot blocking on confirmation, double-booking protection in the database, cancel |
| Packages | Fixed plans 1 / 5 / 10 / 20 sessions with fixed discounts, package balance, "book next session" |
| Orders & statuses | pending → confirmed → completed / cancelled, confirmed by an administrator |
| Reviews | Only after a completed order, one per order, rating recalculated by the database |
| Complaints | Users can report a listing (table `reports`); no admin screen yet |
| Admin panel | Requests, specialists (add/edit/hide, photos, portfolio), clients (CRM with notes), team (roles) |
| Notifications | None for orders (SMS is used only for login codes) |
| Statistics | None |

## 2. Gaps against the specification

1. **Order error** — the cause was the anti-spam limit (5 open requests per client). Raised to 20 with a clear message. Done once `supabase/migration_request_limit.sql` is run.
2. **Listing publishing error** — publishing works; new listings wait for approval, which the owner did not understand. The specification's moderation workflow fixes this properly (status page with comments).
3. **One listing per account** — blocked by a database rule (`specialists_owner_id_key`) and by the owner screen, which assumes a single listing.
4. **Moderation statuses and comments** — only approved / not approved today.
5. **Flexible pricing** — price is a single number per listing; packages are fixed discounts of that number.
6. **Richer profile** — no video, social links or separate certificates.
7. **Notifications** — none.
8. **Admin** — missing: users list / blocking, complaints queue, reviews moderation, categories management, statistics.

## 3. Tasks, complexity and order

| # | Task | Complexity | Estimate | Depends on |
|---|---|---|---|---|
| A | Fix order error (limit) and clearer errors | S | 0.5 day | – |
| B | Moderation: statuses (pending / approved / rejected / needs changes), admin comments, resubmit, owner sees the reason | M | 2–3 days | – |
| C | Several listings per account (own list, create / edit / delete / publish, one cabinet) | M | 3–4 days | B |
| D | Flexible price list per listing: services, minimum order, one-off / package / monthly, USD & UZS, custom quote request, price passed into the order | L | 6–8 days | C |
| E | Profile improvements: video in portfolio, social links, certificates, completed-orders counter | M | 3–4 days | C |
| F | Booking: notifications (e-mail first), specialist confirm / decline, status updates | M | 3–4 days | D, e-mail sender |
| G | Admin: users + blocking, complaints queue, reviews moderation, statistics | L | 5–6 days | B |
| H | Categories managed by the admin (instead of fixed in code) | M | 2–3 days | – |
| I | Final end-to-end testing on desktop and phones, fixes | M | 3 days | all |

**Recommended order:** A → B → C (Stage 1, about one week) → D → E (Stage 2, about two weeks) → F → G → H → I (Stage 3).
Stage 1 removes the visible problems and gives the agency what it needs first (several listings, controlled publishing).

## 4. Risks and decisions needed from the client

- **Currency:** prices in USD and UZS need an agreed rule (the client chooses a currency per price; no automatic conversion).
- **Payments:** the platform does not take payments (agreed); prices are agreements between client and specialist.
- **Videos in portfolio:** hosting video needs storage budget (Supabase paid plan) or links to YouTube / Instagram.
- **Notifications by e-mail** need a verified sender (own domain recommended).
- **Free plans** of Vercel and Supabase are not suitable for a commercial launch (backups, limits).
