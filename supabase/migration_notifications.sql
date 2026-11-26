-- Notifications (Stage 3, task F): in-app bell + Telegram (team chat and each user's own chat).
-- Run AFTER migration_calendar_tariffs.sql. Idempotent.
--
-- How it works
--  * Database triggers write a row into public.notifications when something happens:
--      new request -> the listing owner;  confirmed / declined / completed -> the client;
--      client cancelled -> the listing owner;  moderation decision -> the listing owner.
--  * The app shows them in the bell (realtime).
--  * Every new row is also posted to the Edge Function `telegram`, which forwards it to the
--    user's Telegram (if they linked it) and new requests to the Whale team chat.

create extension if not exists pg_net with schema extensions;

-- 1) Notifications ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('new_request', 'request_confirmed', 'request_cancelled', 'request_completed',
                                     'client_cancelled', 'listing_approved', 'listing_rejected', 'listing_needs_changes')),
  order_id uuid references public.orders (id) on delete cascade,
  specialist_id text references public.specialists (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "users read their notifications" on public.notifications;
create policy "users read their notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer set search_path = public
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- 2) Writing notifications from triggers --------------------------------------------------------
create or replace function public.order_notification_data(o public.orders)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'service', o.service, 'date', o.booking_date, 'slot', o.booking_slot,
    'amount', o.amount, 'currency', o.currency, 'billing', o.billing,
    'specialist_name', (select name from public.specialists where id = o.specialist_id),
    'client_name', coalesce(nullif((select full_name from public.profiles where id = o.user_id), ''), ''),
    'phone', o.phone, 'note', o.note)
$$;

create or replace function public.notify_on_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.specialists where id = new.specialist_id;

  if tg_op = 'INSERT' then
    if v_owner is not null then
      insert into public.notifications (user_id, kind, order_id, specialist_id, data)
      values (v_owner, 'new_request', new.id, new.specialist_id, public.order_notification_data(new));
    end if;
    -- The Whale team chat also hears about every new request (owner or not).
    perform public.send_to_telegram(jsonb_build_object('team', true, 'kind', 'new_request', 'data', public.order_notification_data(new)));
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' and auth.uid() = new.user_id then
      if v_owner is not null then
        insert into public.notifications (user_id, kind, order_id, specialist_id, data)
        values (v_owner, 'client_cancelled', new.id, new.specialist_id, public.order_notification_data(new));
      end if;
    elsif new.status in ('confirmed', 'cancelled', 'completed') then
      insert into public.notifications (user_id, kind, order_id, specialist_id, data)
      values (new.user_id,
              case new.status when 'confirmed' then 'request_confirmed' when 'cancelled' then 'request_cancelled' else 'request_completed' end,
              new.id, new.specialist_id, public.order_notification_data(new));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_on_order on public.orders;
create trigger notify_on_order after insert or update of status on public.orders
  for each row execute procedure public.notify_on_order();

create or replace function public.notify_on_moderation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.owner_id is not null and new.moderation_status is distinct from old.moderation_status
     and new.moderation_status in ('approved', 'rejected', 'needs_changes') then
    insert into public.notifications (user_id, kind, specialist_id, data)
    values (new.owner_id, 'listing_' || new.moderation_status, new.id,
            jsonb_build_object('specialist_name', new.name, 'comment', new.moderation_comment));
  end if;
  return new;
end;
$$;
drop trigger if exists notify_on_moderation on public.specialists;
create trigger notify_on_moderation after update of moderation_status on public.specialists
  for each row execute procedure public.notify_on_moderation();

-- 3) Telegram ----------------------------------------------------------------------------------
-- Private settings (not exposed through the API): the Edge Function address and its shared secret.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);

-- Linked Telegram chats of users, and one-time codes used to link them.
create table if not exists public.telegram_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id bigint not null,
  linked_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
drop policy if exists "users see their telegram link" on public.telegram_links;
create policy "users see their telegram link" on public.telegram_links for select to authenticated using (user_id = auth.uid());
drop policy if exists "users remove their telegram link" on public.telegram_links;
create policy "users remove their telegram link" on public.telegram_links for delete to authenticated using (user_id = auth.uid());
revoke all on public.telegram_links from anon;
grant select, delete on public.telegram_links to authenticated;

create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.telegram_link_codes enable row level security;
revoke all on public.telegram_link_codes from anon, authenticated;

-- A short-lived code for the "Connect Telegram" button (t.me/<bot>?start=<code>).
create or replace function public.create_telegram_link_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text := encode(extensions.gen_random_bytes(12), 'hex');
begin
  if auth.uid() is null then raise exception 'You must be signed in' using errcode = '28000'; end if;
  delete from public.telegram_link_codes where user_id = auth.uid() or expires_at < now();
  insert into public.telegram_link_codes (code, user_id, expires_at) values (v_code, auth.uid(), now() + interval '30 minutes');
  return v_code;
end;
$$;
revoke all on function public.create_telegram_link_code() from public, anon;
grant execute on function public.create_telegram_link_code() to authenticated;

-- Fire-and-forget POST to the Edge Function. Does nothing until the settings are filled in.
create or replace function public.send_to_telegram(p_payload jsonb)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_url text := (select value from private.settings where key = 'telegram_function_url');
  v_secret text := (select value from private.settings where key = 'telegram_hook_secret');
begin
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-whale-secret', v_secret)
  );
exception when others then
  -- Notifications must never break bookings.
  raise warning 'send_to_telegram failed: %', sqlerrm;
end;
$$;
revoke all on function public.send_to_telegram(jsonb) from public, anon, authenticated;

create or replace function public.forward_notification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.send_to_telegram(jsonb_build_object('user_id', new.user_id, 'kind', new.kind, 'data', new.data));
  return new;
end;
$$;
drop trigger if exists forward_notification on public.notifications;
create trigger forward_notification after insert on public.notifications
  for each row execute procedure public.forward_notification();

notify pgrst, 'reload schema';
