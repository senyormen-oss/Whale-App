-- Keeps the SMS gateway (Eskiz) token between Edge Function restarts, so the first code after a
-- pause is not delayed by a fresh gateway login. Only the service role (the send-sms function) can
-- read or write it. Idempotent.
create table if not exists public.sms_gateway_tokens (
  provider text primary key,
  token text not null,
  expires_at timestamptz not null
);
alter table public.sms_gateway_tokens enable row level security;
revoke all on public.sms_gateway_tokens from anon, authenticated;
grant select, insert, update on public.sms_gateway_tokens to service_role;
notify pgrst, 'reload schema';
