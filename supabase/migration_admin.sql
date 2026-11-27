-- Admin, stage 3 (task G): users and blocking, the reports queue, review moderation, statistics.
-- Run AFTER migration_notifications.sql. Idempotent.

-- 1) Blocking -------------------------------------------------------------------------------
-- A blocked user can still sign in and sees why, but cannot book, write, review or publish,
-- and their listings disappear from the catalog.
create table if not exists public.user_blocks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  blocked_at timestamptz not null default now(),
  blocked_by uuid references auth.users (id) on delete set null
);
alter table public.user_blocks enable row level security;
drop policy if exists "users see their own block" on public.user_blocks;
create policy "users see their own block" on public.user_blocks for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.user_blocks from anon;
revoke insert, update, delete on public.user_blocks from authenticated;
grant select on public.user_blocks to authenticated;

create or replace function public.is_user_blocked(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_user is not null and exists (select 1 from public.user_blocks where user_id = p_user)
$$;
grant execute on function public.is_user_blocked(uuid) to anon, authenticated;

-- Listings of blocked owners are hidden from everyone except the owner and the team.
drop policy if exists "approved listings are public" on public.specialists;
create policy "approved listings are public" on public.specialists
  for select
  using ((approved and published and not public.is_user_blocked(owner_id)) or owner_id = auth.uid() or public.is_admin());

create or replace function public.guard_blocked_actions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if tg_table_name = 'orders' then
    if public.is_user_blocked(new.user_id) then raise exception 'Account blocked' using errcode = '42501'; end if;
    if public.is_user_blocked((select owner_id from public.specialists where id = new.specialist_id)) then
      raise exception 'Specialist not found';
    end if;
  elsif public.is_user_blocked(auth.uid()) then
    raise exception 'Account blocked' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_blocked_orders on public.orders;
create trigger guard_blocked_orders before insert on public.orders for each row execute procedure public.guard_blocked_actions();
drop trigger if exists guard_blocked_messages on public.messages;
create trigger guard_blocked_messages before insert on public.messages for each row execute procedure public.guard_blocked_actions();
drop trigger if exists guard_blocked_reviews on public.reviews;
create trigger guard_blocked_reviews before insert on public.reviews for each row execute procedure public.guard_blocked_actions();
drop trigger if exists guard_blocked_listings on public.specialists;
create trigger guard_blocked_listings before insert or update on public.specialists for each row
  when (current_user in ('authenticated', 'anon')) execute procedure public.guard_blocked_actions();
drop trigger if exists guard_blocked_services on public.listing_services;
create trigger guard_blocked_services before insert or update on public.listing_services for each row execute procedure public.guard_blocked_actions();
drop trigger if exists guard_blocked_reports on public.reports;
create trigger guard_blocked_reports before insert on public.reports for each row execute procedure public.guard_blocked_actions();

-- 2) Users ------------------------------------------------------------------------------------
create or replace function public.admin_list_users(p_search text default '', p_limit int default 50, p_offset int default 0)
returns table (
  user_id uuid, phone text, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
  listings int, orders int, is_admin boolean, blocked boolean, block_reason text
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_search, '')));
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select u.id, coalesce(u.phone, '')::text, coalesce(u.email, '')::text, coalesce(p.full_name, ''),
           u.created_at, u.last_sign_in_at,
           (select count(*)::int from public.specialists s where s.owner_id = u.id),
           (select count(*)::int from public.orders o where o.user_id = u.id),
           exists (select 1 from public.admins a where a.user_id = u.id),
           b.user_id is not null, coalesce(b.reason, '')
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.user_blocks b on b.user_id = u.id
    where v_q = ''
       or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
       or lower(coalesce(u.email, '')) like '%' || v_q || '%'
       or (char_length(v_digits) >= 3 and coalesce(u.phone, '') like '%' || v_digits || '%')
    order by u.created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
revoke all on function public.admin_list_users(text, int, int) from public, anon;
grant execute on function public.admin_list_users(text, int, int) to authenticated;

create or replace function public.admin_set_blocked(p_user_id uuid, p_blocked boolean, p_reason text default '')
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot block yourself'; end if;
  if exists (select 1 from public.admins where user_id = p_user_id) then raise exception 'Remove the admin role first'; end if;
  if p_blocked then
    insert into public.user_blocks (user_id, reason, blocked_by) values (p_user_id, left(trim(coalesce(p_reason, '')), 500), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, blocked_at = now(), blocked_by = excluded.blocked_by;
  else
    delete from public.user_blocks where user_id = p_user_id;
  end if;
end;
$$;
revoke all on function public.admin_set_blocked(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_blocked(uuid, boolean, text) to authenticated;

-- 3) Reports queue ----------------------------------------------------------------------------
drop policy if exists "admins manage reports" on public.reports;
create policy "admins manage reports" on public.reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant update on public.reports to authenticated;

create or replace function public.admin_list_reports(p_status text default null)
returns table (
  id uuid, specialist_id text, specialist_name text, owner_id uuid, reason text, details text, status text,
  created_at timestamptz, reporter_id uuid, reporter_name text, reporter_phone text
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select r.id, r.specialist_id, s.name, s.owner_id, r.reason, r.details, r.status, r.created_at,
           r.reporter_id, coalesce(p.full_name, ''), coalesce(u.phone, u.email, '')::text
    from public.reports r
    join public.specialists s on s.id = r.specialist_id
    left join public.profiles p on p.id = r.reporter_id
    left join auth.users u on u.id = r.reporter_id
    where p_status is null or r.status = p_status
    order by (r.status = 'new') desc, r.created_at desc
    limit 200;
end;
$$;
revoke all on function public.admin_list_reports(text) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;

-- 4) Reviews moderation -----------------------------------------------------------------------
create or replace function public.admin_list_reviews(p_limit int default 100)
returns table (
  id uuid, specialist_id text, specialist_name text, author_id uuid, author_name text, rating int, text text,
  created_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select r.id, r.specialist_id, s.name, r.author_id, r.author_name, r.rating::int, r.text, r.created_at
    from public.reviews r join public.specialists s on s.id = r.specialist_id
    order by r.created_at desc
    limit least(greatest(p_limit, 1), 300);
end;
$$;
revoke all on function public.admin_list_reviews(int) from public, anon;
grant execute on function public.admin_list_reviews(int) to authenticated;

-- Removing a review recalculates the listing rating through the existing review trigger.
create or replace function public.admin_delete_review(p_review_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from public.reviews where id = p_review_id;
  if not found then raise exception 'Review not found'; end if;
end;
$$;
revoke all on function public.admin_delete_review(uuid) from public, anon;
grant execute on function public.admin_delete_review(uuid) to authenticated;

-- 5) Statistics -------------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'blocked', (select count(*) from public.user_blocks),
    'listings', (select jsonb_object_agg(moderation_status, n) from (select moderation_status, count(*) n from public.specialists group by 1) x),
    'listings_published', (select count(*) from public.specialists where approved and published),
    'orders', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.orders group by 1) x),
    'orders_7d', (select count(*) from public.orders where created_at > now() - interval '7 days'),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days'),
    'revenue_uzs', (select coalesce(sum(amount), 0) from public.orders where status = 'completed' and currency = 'UZS'),
    'revenue_usd', (select coalesce(sum(amount), 0) from public.orders where status = 'completed' and currency = 'USD'),
    'reports_new', (select count(*) from public.reports where status = 'new'),
    'reviews', (select count(*) from public.reviews),
    'orders_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'n', (select count(*) from public.orders o where o.created_at::date = d::date)) order by d), '[]'::jsonb)
      from generate_series((current_date - 13)::timestamp, current_date::timestamp, interval '1 day') d),
    'top_specialists', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select s.id, s.name, count(o.id) as orders, count(o.id) filter (where o.status = 'completed') as completed
        from public.specialists s join public.orders o on o.specialist_id = s.id
        where o.created_at > now() - interval '30 days'
        group by s.id, s.name order by count(o.id) desc limit 5) t)
  ) into v;
  return v;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

notify pgrst, 'reload schema';
