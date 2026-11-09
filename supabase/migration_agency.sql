-- "Agency" model: clients send REQUESTS, an administrator confirms them by phone, money is
-- handled offline by Whale. Also adds admin role and moderation of specialist listings.
-- Idempotent: safe to re-run.

-- 1) Administrators ----------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

drop policy if exists "admins read themselves" on public.admins;
create policy "admins read themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());

revoke all on public.admins from anon;
revoke insert, update, delete on public.admins from authenticated;
grant select on public.admins to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- The owner account becomes the first administrator.
insert into public.admins (user_id)
select id from auth.users where email = 'e5270816@gmail.com'
on conflict do nothing;

-- 2) Requests carry the client's phone and an optional note -------------------
alter table public.orders add column if not exists phone text not null default '';
alter table public.orders add column if not exists note text not null default '';
alter table public.orders drop constraint if exists orders_phone_len;
alter table public.orders add constraint orders_phone_len check (char_length(phone) <= 20);
alter table public.orders drop constraint if exists orders_note_len;
alter table public.orders add constraint orders_note_len check (char_length(note) <= 500);

-- 3) Listings must be approved before they appear publicly ---------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'specialists' and column_name = 'approved'
  ) then
    alter table public.specialists add column approved boolean not null default false;
    update public.specialists set approved = true; -- everything that exists today stays visible
  end if;
end $$;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'specialists' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.specialists', r.policyname);
  end loop;
end $$;

create policy "approved listings are public" on public.specialists
  for select
  using (approved or owner_id = auth.uid() or public.is_admin());

create or replace function public.protect_specialist_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.level := 'bronze';
      new.rating := 0;
      new.reviews := 0;
      new.projects := 0;
      new.approved := false;
    else
      new.verified := old.verified;
      new.level := old.level;
      new.rating := old.rating;
      new.reviews := old.reviews;
      new.projects := old.projects;
      new.approved := old.approved;
      new.owner_id := old.owner_id;
    end if;
  end if;
  return new;
end;
$$;

-- 4) Administrators can read all orders and profiles ---------------------------
drop policy if exists "admins read all orders" on public.orders;
create policy "admins read all orders" on public.orders
  for select to authenticated using (public.is_admin());

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

-- 5) Clients send requests (no slot is blocked until an administrator confirms) -
create or replace function public.create_request(
  p_specialist_id text,
  p_date date,
  p_slot text,
  p_service text,
  p_amount int,
  p_phone text,
  p_note text default ''
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_spec public.specialists;
  v_order public.orders;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_spec from public.specialists where id = p_specialist_id and approved;
  if not found then raise exception 'Specialist not found'; end if;
  if v_spec.owner_id = auth.uid() then raise exception 'You cannot book your own listing'; end if;
  if not v_spec.available then raise exception 'This specialist is not accepting bookings'; end if;
  if p_date < current_date or p_date > current_date + 365 then raise exception 'Choose a valid date'; end if;
  if p_slot not in ('09:00', '11:00', '13:00', '15:00', '17:00') then raise exception 'Invalid time slot'; end if;
  if p_service is null or char_length(p_service) not between 1 and 100 then raise exception 'Invalid service'; end if;
  if p_amount < v_spec.price - 500 or p_amount > 100000000 then raise exception 'Invalid amount'; end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if char_length(v_phone) < 9 or char_length(v_phone) > 16 then raise exception 'Invalid phone'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Note is too long'; end if;

  if (select count(*) from public.orders where user_id = auth.uid() and status = 'pending') >= 5 then
    raise exception 'Too many open requests';
  end if;

  if exists (
    select 1 from public.booked_slots
    where specialist_id = p_specialist_id and booking_date = p_date and booking_slot = p_slot
  ) then
    raise exception 'Slot is taken' using errcode = '23505';
  end if;

  insert into public.orders (user_id, specialist_id, service, amount, status, booking_date, booking_slot, phone, note)
  values (auth.uid(), p_specialist_id, p_service, p_amount, 'pending', p_date, p_slot, v_phone, coalesce(p_note, ''))
  returning * into v_order;

  return v_order;
end;
$$;

revoke execute on function public.create_request(text, date, text, text, int, text, text) from public, anon;
grant execute on function public.create_request(text, date, text, text, int, text, text) to authenticated;

-- Direct self-confirmed bookings are replaced by requests.
revoke execute on function public.create_booking(text, date, text, text, int, text) from authenticated;

-- 6) Administrator actions -------------------------------------------------------
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_status = 'confirmed' and v_order.status = 'pending' then
    -- Blocks the slot; raises 23505 if another request was confirmed for it first.
    insert into public.booked_slots (specialist_id, booking_date, booking_slot, order_id)
    values (v_order.specialist_id, v_order.booking_date, v_order.booking_slot, v_order.id);
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

create or replace function public.admin_set_listing_approved(p_specialist_id text, p_approved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.specialists set approved = p_approved where id = p_specialist_id;
end;
$$;

revoke execute on function public.admin_set_listing_approved(text, boolean) from public, anon;
grant execute on function public.admin_set_listing_approved(text, boolean) to authenticated;
