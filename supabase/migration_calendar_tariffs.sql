-- Tariffs (Basic / Standard / Premium), monthly contracts and the specialist's own availability calendar.
-- Run AFTER migration_profile.sql. Idempotent.

-- ============================================================================================
-- 1) Tariffs and service details
-- ============================================================================================
alter table public.listing_services add column if not exists tier text;
alter table public.listing_services add column if not exists quantity int;
alter table public.listing_services add column if not exists shoot_days int;
alter table public.listing_services add column if not exists duration text not null default '';
alter table public.listing_services add column if not exists terms text not null default '';

alter table public.listing_services drop constraint if exists listing_services_tier_check;
alter table public.listing_services add constraint listing_services_tier_check check (tier is null or (tier in ('basic', 'standard', 'premium') and billing = 'one_time'));
alter table public.listing_services drop constraint if exists listing_services_quantity_check;
alter table public.listing_services add constraint listing_services_quantity_check check (quantity is null or quantity between 1 and 1000);
alter table public.listing_services drop constraint if exists listing_services_shoot_days_check;
alter table public.listing_services add constraint listing_services_shoot_days_check check (shoot_days is null or (shoot_days between 1 and 31 and billing = 'monthly'));
alter table public.listing_services drop constraint if exists listing_services_duration_len;
alter table public.listing_services add constraint listing_services_duration_len check (char_length(duration) <= 60);
alter table public.listing_services drop constraint if exists listing_services_terms_len;
alter table public.listing_services add constraint listing_services_terms_len check (char_length(terms) <= 500);
create unique index if not exists listing_services_one_tier on public.listing_services (specialist_id, tier) where tier is not null;

-- What the client agreed to: a copy of the service at booking time, so later edits never change an order.
alter table public.orders add column if not exists service_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.guard_order_extra_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.currency is distinct from old.currency
          or new.billing is distinct from old.billing
          or new.service_snapshot is distinct from old.service_snapshot
          -- (set to null is allowed: that is the database detaching a deleted service)
          or (new.service_id is distinct from old.service_id and new.service_id is not null)) then
    raise exception 'Order details cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ============================================================================================
-- 2) Availability: a weekly schedule, per-day overrides (own intervals or a blocked day)
-- ============================================================================================
create table if not exists public.specialist_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  specialist_id text not null references public.specialists (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),   -- ISO: 1 = Monday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index if not exists specialist_weekly_hours_idx on public.specialist_weekly_hours (specialist_id, weekday);

-- A row here means "this date does not follow the weekly schedule": either blocked, or its own intervals below.
create table if not exists public.specialist_days (
  specialist_id text not null references public.specialists (id) on delete cascade,
  day date not null,
  blocked boolean not null default false,
  primary key (specialist_id, day)
);

create table if not exists public.specialist_day_slots (
  id uuid primary key default gen_random_uuid(),
  specialist_id text not null,
  day date not null,
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  foreign key (specialist_id, day) references public.specialist_days (specialist_id, day) on delete cascade
);
create index if not exists specialist_day_slots_idx on public.specialist_day_slots (specialist_id, day);

-- Intervals of one day (or one weekday) must not overlap.
create or replace function public.guard_schedule_overlap()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'specialist_weekly_hours' then
    if exists (select 1 from public.specialist_weekly_hours w
               where w.specialist_id = new.specialist_id and w.weekday = new.weekday and w.id <> new.id
                 and w.start_time < new.end_time and new.start_time < w.end_time) then
      raise exception 'Intervals overlap' using errcode = '23P01';
    end if;
    if (select count(*) from public.specialist_weekly_hours where specialist_id = new.specialist_id and weekday = new.weekday) >= 12 then
      raise exception 'Too many intervals';
    end if;
  else
    if exists (select 1 from public.specialist_day_slots d
               where d.specialist_id = new.specialist_id and d.day = new.day and d.id <> new.id
                 and d.start_time < new.end_time and new.start_time < d.end_time) then
      raise exception 'Intervals overlap' using errcode = '23P01';
    end if;
    if (select count(*) from public.specialist_day_slots where specialist_id = new.specialist_id and day = new.day) >= 12 then
      raise exception 'Too many intervals';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_weekly_overlap on public.specialist_weekly_hours;
create trigger guard_weekly_overlap before insert or update on public.specialist_weekly_hours
  for each row execute procedure public.guard_schedule_overlap();
drop trigger if exists guard_day_overlap on public.specialist_day_slots;
create trigger guard_day_overlap before insert or update on public.specialist_day_slots
  for each row execute procedure public.guard_schedule_overlap();

alter table public.specialist_weekly_hours enable row level security;
alter table public.specialist_days enable row level security;
alter table public.specialist_day_slots enable row level security;

do $$
declare t text;
begin
  foreach t in array array['specialist_weekly_hours', 'specialist_days', 'specialist_day_slots'] loop
    execute format('drop policy if exists "owners and admins manage schedule" on public.%I', t);
    execute format($p$create policy "owners and admins manage schedule" on public.%I
      for all to authenticated
      using (public.is_admin() or exists (select 1 from public.specialists s where s.id = %I.specialist_id and s.owner_id = auth.uid()))
      with check (public.is_admin() or exists (select 1 from public.specialists s where s.id = %I.specialist_id and s.owner_id = auth.uid()))$p$, t, t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ============================================================================================
-- 3) Free slots: the single source of truth for clients and for the booking functions
-- ============================================================================================
-- "09:00-11:00" -> 09:00 / 11:00. Legacy single times ("09:00") are two-hour sessions.
create or replace function public.slot_start(p_slot text) returns time language sql immutable as $$
  select split_part(p_slot, '-', 1)::time
$$;
create or replace function public.slot_end(p_slot text) returns time language sql immutable as $$
  select case when position('-' in p_slot) > 0 then split_part(p_slot, '-', 2)::time
              else split_part(p_slot, '-', 1)::time + interval '2 hours' end
$$;

-- Every interval a listing offers in a date range, before removing booked time.
create or replace function public.listing_offered_slots(p_specialist_id text, p_from date, p_to date)
returns table (day date, slot text)
language sql
stable
security definer set search_path = public
as $$
  with days as (
    select d::date as day from generate_series(greatest(p_from, current_date), least(p_to, current_date + 365, p_from + 62), interval '1 day') d
  ),
  has_schedule as (
    select exists (select 1 from specialist_weekly_hours where specialist_id = p_specialist_id)
        or exists (select 1 from specialist_days where specialist_id = p_specialist_id) as yes
  )
  -- days with their own intervals
  select ds.day, to_char(ds.start_time, 'HH24:MI') || '-' || to_char(ds.end_time, 'HH24:MI')
  from days join specialist_days sd on sd.specialist_id = p_specialist_id and sd.day = days.day and not sd.blocked
  join specialist_day_slots ds on ds.specialist_id = p_specialist_id and ds.day = days.day
  union all
  -- days following the weekly schedule
  select days.day, to_char(w.start_time, 'HH24:MI') || '-' || to_char(w.end_time, 'HH24:MI')
  from days join specialist_weekly_hours w on w.specialist_id = p_specialist_id and w.weekday = extract(isodow from days.day)
  where not exists (select 1 from specialist_days sd where sd.specialist_id = p_specialist_id and sd.day = days.day)
  union all
  -- listings that never set a schedule keep the old fixed slots
  select days.day, s.slot
  from days cross join (values ('09:00'), ('11:00'), ('13:00'), ('15:00'), ('17:00')) s(slot)
  where not (select yes from has_schedule)
$$;

-- Free slots a client may book: offered, not overlapping confirmed bookings, not already started today.
create or replace function public.listing_slots(p_specialist_id text, p_from date, p_to date)
returns table (day date, slot text)
language sql
stable
security definer set search_path = public
as $$
  select o.day, o.slot
  from public.listing_offered_slots(p_specialist_id, p_from, p_to) o
  where not exists (
          select 1 from public.booked_slots b
          where b.specialist_id = p_specialist_id and b.booking_date = o.day
            and public.slot_start(b.booking_slot) < public.slot_end(o.slot)
            and public.slot_start(o.slot) < public.slot_end(b.booking_slot))
    and (o.day > current_date or public.slot_start(o.slot) > (now() at time zone 'Asia/Tashkent')::time)
  order by o.day, public.slot_start(o.slot)
$$;
revoke all on function public.listing_slots(text, date, date) from public;
grant execute on function public.listing_slots(text, date, date) to anon, authenticated;
revoke all on function public.listing_offered_slots(text, date, date) from public, anon, authenticated;

create or replace function public.slot_is_free(p_specialist_id text, p_day date, p_slot text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.listing_slots(p_specialist_id, p_day, p_day) where slot = p_slot)
$$;
revoke all on function public.slot_is_free(text, date, text) from public, anon, authenticated;

-- Blocks the time of a confirmed order; refuses if it overlaps another confirmed booking.
create or replace function public.block_order_slot(p_order public.orders)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from public.booked_slots b
             where b.specialist_id = p_order.specialist_id and b.booking_date = p_order.booking_date
               and b.order_id is distinct from p_order.id
               and public.slot_start(b.booking_slot) < public.slot_end(p_order.booking_slot)
               and public.slot_start(p_order.booking_slot) < public.slot_end(b.booking_slot)) then
    raise exception 'Slot is taken' using errcode = '23505';
  end if;
  insert into public.booked_slots (specialist_id, booking_date, booking_slot, order_id)
  values (p_order.specialist_id, p_order.booking_date, p_order.booking_slot, p_order.id);
end;
$$;
revoke all on function public.block_order_slot(public.orders) from public, anon, authenticated;

-- ============================================================================================
-- 4) Confirming: the Whale team, and now also the specialist who owns the listing
-- ============================================================================================
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_status = 'confirmed' and v_order.status = 'pending' then
    perform public.block_order_slot(v_order);
  elsif p_status = 'completed' and v_order.status = 'confirmed' then
    null;
  elsif p_status = 'cancelled' and v_order.status in ('pending', 'confirmed') then
    null;
  else
    raise exception 'This status change is not allowed' using errcode = '42501';
  end if;

  update public.orders set status = p_status where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;
revoke execute on function public.admin_set_order_status(uuid, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

create or replace function public.specialist_set_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select o.* into v_order from public.orders o
  join public.specialists s on s.id = o.specialist_id
  where o.id = p_order_id and s.owner_id = auth.uid()
  for update of o;
  if not found then raise exception 'Order not found'; end if;

  if p_status = 'confirmed' and v_order.status = 'pending' then
    perform public.block_order_slot(v_order);
  elsif p_status = 'cancelled' and v_order.status in ('pending', 'confirmed') then
    null;
  elsif p_status = 'completed' and v_order.status = 'confirmed' then
    null;
  else
    raise exception 'This status change is not allowed' using errcode = '42501';
  end if;

  update public.orders set status = p_status where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;
revoke execute on function public.specialist_set_order_status(uuid, text) from public, anon;
grant execute on function public.specialist_set_order_status(uuid, text) to authenticated;

-- ============================================================================================
-- 5) Requests use the real free slots and keep a copy of the service
-- ============================================================================================
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
  v_snapshot jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_spec from public.specialists where id = p_specialist_id and approved and published;
  if not found then raise exception 'Specialist not found'; end if;
  if v_spec.owner_id = auth.uid() then raise exception 'You cannot book your own listing'; end if;
  if not v_spec.available then raise exception 'This specialist is not accepting bookings'; end if;
  if p_date < current_date or p_date > current_date + 365 then raise exception 'Choose a valid date'; end if;
  if not public.slot_is_free(p_specialist_id, p_date, coalesce(p_slot, '')) then
    raise exception 'Slot is taken' using errcode = '23505';
  end if;

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
    v_snapshot := jsonb_strip_nulls(jsonb_build_object(
      'title', v_svc.title, 'description', nullif(v_svc.description, ''), 'tier', v_svc.tier,
      'billing', v_svc.billing, 'sessions', v_svc.sessions, 'quantity', v_svc.quantity, 'shoot_days', v_svc.shoot_days,
      'price', v_svc.price, 'price_from', v_svc.price_from, 'currency', v_svc.currency,
      'duration', nullif(v_svc.duration, ''), 'terms', nullif(v_svc.terms, '')));
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

  if v_billing = 'package' and v_sessions > 1 then
    insert into public.packages (user_id, specialist_id, plan, sessions_total, price, currency)
    values (auth.uid(), p_specialist_id, v_service, v_sessions, v_amount, v_currency)
    returning id into v_package;
  end if;

  insert into public.orders (user_id, specialist_id, service, amount, status, booking_date, booking_slot, phone, note,
                             package_id, currency, billing, service_id, service_snapshot)
  values (auth.uid(), p_specialist_id, v_service, v_amount, 'pending', p_date, p_slot, v_phone, coalesce(p_note, ''),
          v_package, v_currency, v_billing, p_service_id, v_snapshot)
  returning * into v_order;

  return v_order;
end;
$$;
revoke execute on function public.create_request(text, date, text, text, int, text, text, int, uuid, boolean) from public, anon;
grant execute on function public.create_request(text, date, text, text, int, text, text, int, uuid, boolean) to authenticated;

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
  if not public.slot_is_free(v_pkg.specialist_id, p_date, coalesce(p_slot, '')) then
    raise exception 'Slot is taken' using errcode = '23505';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if char_length(v_phone) < 9 or char_length(v_phone) > 16 then raise exception 'Invalid phone'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Note is too long'; end if;

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
