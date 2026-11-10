-- CRM for the Whale team + multi-session packages. Run AFTER migration_agency.sql. Idempotent.

-- 1) CRM notes (visible to administrators only) --------------------------------
create table if not exists public.crm_notes (
  kind text not null check (kind in ('client', 'order', 'specialist')),
  key text not null,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.crm_notes enable row level security;
drop policy if exists "admins manage notes" on public.crm_notes;
create policy "admins manage notes" on public.crm_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.crm_notes from anon;
grant select, insert, update, delete on public.crm_notes to authenticated;

-- 2) Team management: administrators can add / remove colleagues ----------------
create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, full_name text)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select a.user_id, u.email::text, coalesce(p.full_name, '')
    from public.admins a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by u.email;
end;
$$;
revoke all on function public.admin_list_admins() from public, anon;
grant execute on function public.admin_list_admins() to authenticated;

create or replace function public.admin_set_role(p_email text, p_admin boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'User not found'; end if;
  if p_admin then
    insert into public.admins (user_id) values (v_id) on conflict do nothing;
  else
    if v_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
    delete from public.admins where user_id = v_id;
  end if;
end;
$$;
revoke all on function public.admin_set_role(text, boolean) from public, anon;
grant execute on function public.admin_set_role(text, boolean) to authenticated;

-- 3) Administrators create and edit specialists (no user account needed) --------
create or replace function public.admin_upsert_specialist(p jsonb)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_id text := nullif(p ->> 'id', '');
  v_tags text[];
  v_portfolio text[];
  v_level text := coalesce(nullif(p ->> 'level', ''), 'bronze');
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;

  if char_length(coalesce(p ->> 'name', '')) not between 2 and 100 then raise exception 'Invalid name'; end if;
  if char_length(coalesce(p ->> 'city', '')) not between 1 and 60 then raise exception 'Invalid city'; end if;
  if coalesce((p ->> 'age')::int, 0) not between 16 and 99 then raise exception 'Invalid age'; end if;
  if coalesce((p ->> 'price')::int, 0) not between 1000 and 100000000 then raise exception 'Invalid price'; end if;
  if coalesce((p ->> 'experience')::int, 0) not between 0 and 60 then raise exception 'Invalid experience'; end if;
  if char_length(coalesce(p ->> 'bio', '')) > 1000 then raise exception 'Bio is too long'; end if;
  if char_length(coalesce(p ->> 'qualification', '')) > 600 then raise exception 'Qualification is too long'; end if;
  if v_level not in ('bronze', 'silver', 'gold', 'platinum') then raise exception 'Invalid level'; end if;

  v_tags := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'tags', '[]'::jsonb))), '{}');
  v_portfolio := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'portfolio', '[]'::jsonb))), '{}');
  if coalesce(array_length(v_tags, 1), 0) > 12 then raise exception 'Too many tags'; end if;
  if coalesce(array_length(v_portfolio, 1), 0) > 24 then raise exception 'Too many photos'; end if;

  if v_id is null then
    v_id := gen_random_uuid()::text;
    insert into public.specialists (
      id, owner_id, name, category, category_key, city, age, experience, projects, reviews, rating, price,
      verified, level, bio, qualification, avatar, cover, portfolio, tags, available, is_new, approved
    ) values (
      v_id, null, trim(p ->> 'name'), p ->> 'category', p ->> 'category_key', trim(p ->> 'city'),
      (p ->> 'age')::int, coalesce((p ->> 'experience')::int, 0), 0, 0, 0, (p ->> 'price')::int,
      coalesce((p ->> 'verified')::boolean, false), v_level, coalesce(p ->> 'bio', ''), coalesce(p ->> 'qualification', ''),
      coalesce(p ->> 'avatar', ''), coalesce(p ->> 'cover', ''), v_portfolio, v_tags,
      coalesce((p ->> 'available')::boolean, true), true, coalesce((p ->> 'approved')::boolean, true)
    );
  else
    update public.specialists set
      name = trim(p ->> 'name'), category = p ->> 'category', category_key = p ->> 'category_key',
      city = trim(p ->> 'city'), age = (p ->> 'age')::int, experience = coalesce((p ->> 'experience')::int, 0),
      price = (p ->> 'price')::int, verified = coalesce((p ->> 'verified')::boolean, verified), level = v_level,
      bio = coalesce(p ->> 'bio', ''), qualification = coalesce(p ->> 'qualification', ''),
      avatar = coalesce(p ->> 'avatar', avatar), cover = coalesce(p ->> 'cover', cover),
      portfolio = v_portfolio, tags = v_tags,
      available = coalesce((p ->> 'available')::boolean, available), approved = coalesce((p ->> 'approved')::boolean, approved)
    where id = v_id;
    if not found then raise exception 'Specialist not found'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_upsert_specialist(jsonb) from public, anon;
grant execute on function public.admin_upsert_specialist(jsonb) to authenticated;

-- 4) Packages (5 / 10 / 20 sessions) ----------------------------------------------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  specialist_id text not null references public.specialists(id) on delete cascade,
  plan text not null,
  sessions_total int not null check (sessions_total in (5, 10, 20)),
  sessions_used int not null default 0 check (sessions_used >= 0),
  price int not null check (price between 1 and 100000000),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.packages enable row level security;

drop policy if exists "clients read their packages" on public.packages;
create policy "clients read their packages" on public.packages
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins read all packages" on public.packages;
create policy "admins read all packages" on public.packages
  for select to authenticated using (public.is_admin());

revoke all on public.packages from anon;
revoke insert, update, delete on public.packages from authenticated;
grant select on public.packages to authenticated;

alter table public.orders add column if not exists package_id uuid references public.packages(id) on delete set null;

-- A request may be for a package: the first session is requested now, the others later.
drop function if exists public.create_request(text, date, text, text, int, text, text);
create or replace function public.create_request(
  p_specialist_id text,
  p_date date,
  p_slot text,
  p_service text,
  p_amount int,
  p_phone text,
  p_note text default '',
  p_sessions int default 1
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_spec public.specialists;
  v_order public.orders;
  v_phone text;
  v_factor numeric;
  v_min int;
  v_package uuid;
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

  v_factor := case p_sessions when 1 then 1.0 when 5 then 0.9 when 10 then 0.85 when 20 then 0.8 else null end;
  if v_factor is null then raise exception 'Invalid package'; end if;
  v_min := (round(p_sessions * v_spec.price * v_factor / 1000.0) * 1000)::int - 1000;
  if p_amount < v_min or p_amount > 100000000 then raise exception 'Invalid amount'; end if;

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

  if p_sessions > 1 then
    insert into public.packages (user_id, specialist_id, plan, sessions_total, price)
    values (auth.uid(), p_specialist_id, p_service, p_sessions, p_amount)
    returning id into v_package;
  end if;

  insert into public.orders (user_id, specialist_id, service, amount, status, booking_date, booking_slot, phone, note, package_id)
  values (auth.uid(), p_specialist_id, p_service, p_amount, 'pending', p_date, p_slot, v_phone, coalesce(p_note, ''), v_package)
  returning * into v_order;

  return v_order;
end;
$$;
revoke execute on function public.create_request(text, date, text, text, int, text, text, int) from public, anon;
grant execute on function public.create_request(text, date, text, text, int, text, text, int) to authenticated;

-- A client books a further session of an active package.
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

  insert into public.orders (user_id, specialist_id, service, amount, status, booking_date, booking_slot, phone, note, package_id)
  values (auth.uid(), v_pkg.specialist_id, v_pkg.plan, greatest(1, round(v_pkg.price::numeric / v_pkg.sessions_total)::int),
          'pending', p_date, p_slot, v_phone, coalesce(p_note, ''), v_pkg.id)
  returning * into v_order;

  return v_order;
end;
$$;
revoke execute on function public.create_package_session(uuid, date, text, text, text) from public, anon;
grant execute on function public.create_package_session(uuid, date, text, text, text) to authenticated;

-- Keeps the package in step with its orders.
create or replace function public.package_sync()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.package_id is null then return new; end if;

  if new.status = 'confirmed' then
    update public.packages
      set status = 'active', expires_at = coalesce(expires_at, now() + interval '90 days')
      where id = new.package_id and status = 'pending';
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    update public.packages
      set sessions_used = sessions_used + 1,
          status = case when sessions_used + 1 >= sessions_total then 'completed' else status end
      where id = new.package_id;
  elsif new.status = 'cancelled' then
    update public.packages set status = 'cancelled' where id = new.package_id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists package_sync on public.orders;
create trigger package_sync
  after update of status on public.orders
  for each row
  when (new.status is distinct from old.status)
  execute procedure public.package_sync();

create or replace function public.admin_set_package(p_package_id uuid, p_status text, p_extend_days int default 0)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('active', 'cancelled', 'completed') then raise exception 'Invalid status'; end if;
  if p_extend_days not between 0 and 365 then raise exception 'Invalid days'; end if;
  update public.packages
    set status = p_status,
        expires_at = case when p_extend_days > 0 then greatest(coalesce(expires_at, now()), now()) + make_interval(days => p_extend_days) else expires_at end
    where id = p_package_id;
  if not found then raise exception 'Package not found'; end if;
end;
$$;
revoke all on function public.admin_set_package(uuid, text, int) from public, anon;
grant execute on function public.admin_set_package(uuid, text, int) to authenticated;

-- 5) Clients cannot move their order to another package ---------------------------
create or replace function public.guard_order_update()
returns trigger
language plpgsql
as $$
declare
  is_specialist boolean;
begin
  if current_user in ('authenticated', 'anon') then
    if new.user_id <> old.user_id
       or new.specialist_id <> old.specialist_id
       or new.amount <> old.amount
       or new.service <> old.service
       or new.booking_date <> old.booking_date
       or new.booking_slot <> old.booking_slot
       or new.phone is distinct from old.phone
       or new.note is distinct from old.note
       or new.package_id is distinct from old.package_id
       or new.payment_provider is distinct from old.payment_provider
       or new.payment_ref is distinct from old.payment_ref then
      raise exception 'Order details cannot be changed' using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      select exists (
        select 1 from public.specialists s
        where s.id = old.specialist_id and s.owner_id = auth.uid()
      ) into is_specialist;

      if is_specialist and old.status = 'confirmed' and new.status in ('completed', 'cancelled') then
        null;
      elsif auth.uid() = old.user_id and old.status in ('pending', 'confirmed') and new.status = 'cancelled' then
        null;
      else
        raise exception 'This status change is not allowed' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
