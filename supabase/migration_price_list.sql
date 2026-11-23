-- Flexible price list per listing (Stage 2, task D). Run AFTER migration_booking_published.sql. Idempotent.
--  * Each listing has its own services: one-off, package of N sessions, monthly, or "price on request".
--  * Each price is in UZS or USD (no conversion). "from" marks a starting price.
--  * The order stores the service, its price and currency, taken from the database (never from the browser).
--  * Every listing can also receive a custom quote request (price 0 until agreed).

-- 1) Services ------------------------------------------------------------------------
create table if not exists public.listing_services (
  id uuid primary key default gen_random_uuid(),
  specialist_id text not null references public.specialists (id) on delete cascade,
  title text not null,
  description text not null default '',
  billing text not null default 'one_time',
  sessions int not null default 1,
  price int,
  price_from boolean not null default false,
  currency text not null default 'UZS',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists listing_services_specialist_idx on public.listing_services (specialist_id, position);

alter table public.listing_services drop constraint if exists listing_services_title_len;
alter table public.listing_services add constraint listing_services_title_len check (char_length(trim(title)) between 2 and 80);
alter table public.listing_services drop constraint if exists listing_services_desc_len;
alter table public.listing_services add constraint listing_services_desc_len check (char_length(description) <= 300);
alter table public.listing_services drop constraint if exists listing_services_billing_check;
alter table public.listing_services add constraint listing_services_billing_check check (billing in ('one_time', 'package', 'monthly', 'quote'));
alter table public.listing_services drop constraint if exists listing_services_currency_check;
alter table public.listing_services add constraint listing_services_currency_check check (currency in ('UZS', 'USD'));
alter table public.listing_services drop constraint if exists listing_services_sessions_check;
alter table public.listing_services add constraint listing_services_sessions_check check (
  (billing = 'package' and sessions between 2 and 50) or (billing <> 'package' and sessions = 1)
);
alter table public.listing_services drop constraint if exists listing_services_price_check;
alter table public.listing_services add constraint listing_services_price_check check (
  (billing = 'quote' and price is null)
  or (billing <> 'quote' and currency = 'UZS' and price between 1000 and 100000000)
  or (billing <> 'quote' and currency = 'USD' and price between 1 and 100000)
);

alter table public.listing_services enable row level security;

-- Readable wherever the listing itself is readable (the specialists policy does the filtering).
drop policy if exists "services follow their listing" on public.listing_services;
create policy "services follow their listing" on public.listing_services
  for select using (exists (select 1 from public.specialists s where s.id = listing_services.specialist_id));

drop policy if exists "owners and admins manage services" on public.listing_services;
create policy "owners and admins manage services" on public.listing_services
  for all to authenticated
  using (public.is_admin() or exists (select 1 from public.specialists s where s.id = listing_services.specialist_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.specialists s where s.id = listing_services.specialist_id and s.owner_id = auth.uid()));

grant select on public.listing_services to anon, authenticated;
grant insert, update, delete on public.listing_services to authenticated;

-- At most 20 services per listing; a service never moves to another listing.
create or replace function public.guard_listing_service()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.specialist_id <> old.specialist_id then
    raise exception 'A service cannot move to another listing' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.listing_services where specialist_id = new.specialist_id) >= 20 then
    raise exception 'Too many services';
  end if;
  new.title := trim(new.title);
  new.description := trim(new.description);
  if new.billing = 'quote' then new.price := null; new.price_from := false; end if;
  return new;
end;
$$;
drop trigger if exists guard_listing_service on public.listing_services;
create trigger guard_listing_service
  before insert or update on public.listing_services
  for each row execute procedure public.guard_listing_service();

-- 2) Orders and packages remember currency and kind ------------------------------------
alter table public.orders add column if not exists currency text not null default 'UZS';
alter table public.orders add column if not exists billing text not null default 'one_time';
alter table public.orders add column if not exists service_id uuid references public.listing_services (id) on delete set null;
alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check check (currency in ('UZS', 'USD'));
alter table public.orders drop constraint if exists orders_billing_check;
alter table public.orders add constraint orders_billing_check check (billing in ('one_time', 'package', 'monthly', 'quote'));
-- A price request has no amount yet (0).
alter table public.orders drop constraint if exists orders_amount_range;
alter table public.orders add constraint orders_amount_range check (amount between 0 and 100000000);

alter table public.packages add column if not exists currency text not null default 'UZS';
alter table public.packages drop constraint if exists packages_currency_check;
alter table public.packages add constraint packages_currency_check check (currency in ('UZS', 'USD'));
-- Price-list packages can have any number of sessions from 2 to 50 (legacy plans used 5 / 10 / 20).
alter table public.packages drop constraint if exists packages_sessions_total_check;
alter table public.packages add constraint packages_sessions_total_check check (sessions_total between 2 and 50);

-- Clients and specialists must not be able to rewrite these on an existing order.
create or replace function public.guard_order_extra_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.currency is distinct from old.currency
          or new.billing is distinct from old.billing
          -- (set to null is allowed: that is the database detaching a deleted service)
          or (new.service_id is distinct from old.service_id and new.service_id is not null)) then
    raise exception 'Order details cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_order_extra_columns on public.orders;
create trigger guard_order_extra_columns
  before update on public.orders
  for each row execute procedure public.guard_order_extra_columns();

-- 3) Requests ---------------------------------------------------------------------------
-- p_service_id: book a service from the price list (price and currency come from the database).
-- p_custom:     ask for a custom quote (amount 0, the note describes the task).
-- Neither:      the legacy automatic plans (1/5/10/20 sessions), for listings without a price list.
drop function if exists public.create_request(text, date, text, text, int, text, text);
drop function if exists public.create_request(text, date, text, text, int, text, text, int);
create or replace function public.create_request(
  p_specialist_id text,
  p_date date,
  p_slot text,
  p_service text,
  p_amount int,
  p_phone text,
  p_note text default '',
  p_sessions int default 1,
  p_service_id uuid default null,
  p_custom boolean default false
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_spec public.specialists;
  v_svc public.listing_services;
  v_order public.orders;
  v_phone text;
  v_factor numeric;
  v_min int;
  v_package uuid;
  v_service text;
  v_amount int;
  v_currency text := 'UZS';
  v_billing text := 'one_time';
  v_sessions int := 1;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_spec from public.specialists where id = p_specialist_id and approved and published;
  if not found then raise exception 'Specialist not found'; end if;
  if v_spec.owner_id = auth.uid() then raise exception 'You cannot book your own listing'; end if;
  if not v_spec.available then raise exception 'This specialist is not accepting bookings'; end if;
  if p_date < current_date or p_date > current_date + 365 then raise exception 'Choose a valid date'; end if;
  if p_slot not in ('09:00', '11:00', '13:00', '15:00', '17:00') then raise exception 'Invalid time slot'; end if;

  if p_custom then
    if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Describe the task'; end if;
    v_service := 'Custom quote';
    v_amount := 0;
    v_billing := 'quote';
  elsif p_service_id is not null then
    select * into v_svc from public.listing_services where id = p_service_id and specialist_id = p_specialist_id;
    if not found then raise exception 'Invalid service'; end if;
    v_service := v_svc.title;
    v_amount := coalesce(v_svc.price, 0);
    v_currency := v_svc.currency;
    v_billing := v_svc.billing;
    v_sessions := v_svc.sessions;
  else
    if exists (select 1 from public.listing_services where specialist_id = p_specialist_id) then
      raise exception 'Invalid service';
    end if;
    if p_service is null or char_length(p_service) not between 1 and 100 then raise exception 'Invalid service'; end if;
    v_factor := case p_sessions when 1 then 1.0 when 5 then 0.9 when 10 then 0.85 when 20 then 0.8 else null end;
    if v_factor is null then raise exception 'Invalid package'; end if;
    v_min := (round(p_sessions * v_spec.price * v_factor / 1000.0) * 1000)::int - 1000;
    if p_amount < v_min or p_amount > 100000000 then raise exception 'Invalid amount'; end if;
    v_service := p_service;
    v_amount := p_amount;
    v_sessions := p_sessions;
    if p_sessions > 1 then v_billing := 'package'; end if;
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if char_length(v_phone) < 9 or char_length(v_phone) > 16 then raise exception 'Invalid phone'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Note is too long'; end if;

  if (select count(*) from public.orders where user_id = auth.uid() and status = 'pending') >= 20 then
    raise exception 'Too many open requests';
  end if;

  if exists (
    select 1 from public.booked_slots
    where specialist_id = p_specialist_id and booking_date = p_date and booking_slot = p_slot
  ) then
    raise exception 'Slot is taken' using errcode = '23505';
  end if;

  if v_billing = 'package' and v_sessions > 1 then
    insert into public.packages (user_id, specialist_id, plan, sessions_total, price, currency)
    values (auth.uid(), p_specialist_id, v_service, v_sessions, v_amount, v_currency)
    returning id into v_package;
  end if;

  insert into public.orders (user_id, specialist_id, service, amount, status, booking_date, booking_slot, phone, note,
                             package_id, currency, billing, service_id)
  values (auth.uid(), p_specialist_id, v_service, v_amount, 'pending', p_date, p_slot, v_phone, coalesce(p_note, ''),
          v_package, v_currency, v_billing, p_service_id)
  returning * into v_order;

  return v_order;
end;
$$;
revoke execute on function public.create_request(text, date, text, text, int, text, text, int, uuid, boolean) from public, anon;
grant execute on function public.create_request(text, date, text, text, int, text, text, int, uuid, boolean) to authenticated;

-- 4) Further sessions of a package keep the package currency -----------------------------
create or replace function public.create_package_session(
  p_package_id uuid,
  p_date date,
  p_slot text,
  p_phone text,
  p_note text default ''
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_pkg public.packages;
  v_spec public.specialists;
  v_order public.orders;
  v_phone text;
  v_open int;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_pkg from public.packages where id = p_package_id and user_id = auth.uid();
  if not found then raise exception 'Package not found'; end if;
  if v_pkg.status <> 'active' or v_pkg.expires_at is null or v_pkg.expires_at < now() then
    raise exception 'Package is not active';
  end if;

  select count(*) into v_open from public.orders where package_id = v_pkg.id and status in ('pending', 'confirmed');
  if v_pkg.sessions_used + v_open >= v_pkg.sessions_total then raise exception 'No sessions left'; end if;

  select * into v_spec from public.specialists where id = v_pkg.specialist_id and approved;
  if not found then raise exception 'Specialist not found'; end if;
  if not v_spec.available then raise exception 'This specialist is not accepting bookings'; end if;
  if p_date < current_date or p_date > v_pkg.expires_at::date then raise exception 'Choose a valid date'; end if;
  if p_slot not in ('09:00', '11:00', '13:00', '15:00', '17:00') then raise exception 'Invalid time slot'; end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if char_length(v_phone) < 9 or char_length(v_phone) > 16 then raise exception 'Invalid phone'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Note is too long'; end if;

  if exists (
    select 1 from public.booked_slots
    where specialist_id = v_pkg.specialist_id and booking_date = p_date and booking_slot = p_slot
  ) then
    raise exception 'Slot is taken' using errcode = '23505';
  end if;

  insert into public.orders (user_id, specialist_id, service, amount, status, booking_date, booking_slot, phone, note,
                             package_id, currency, billing)
  values (auth.uid(), v_pkg.specialist_id, v_pkg.plan, greatest(1, round(v_pkg.price::numeric / v_pkg.sessions_total)::int),
          'pending', p_date, p_slot, v_phone, coalesce(p_note, ''), v_pkg.id, v_pkg.currency, 'package')
  returning * into v_order;

  return v_order;
end;
$$;
revoke execute on function public.create_package_session(uuid, date, text, text, text) from public, anon;
grant execute on function public.create_package_session(uuid, date, text, text, text) to authenticated;

notify pgrst, 'reload schema';
