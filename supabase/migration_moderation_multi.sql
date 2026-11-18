-- Stage 1: moderation statuses with comments + several listings per account.
-- Run AFTER migration_agency.sql and migration_crm_packages.sql. Idempotent.

-- 1) Several listings per account ---------------------------------------------------
drop index if exists public.specialists_owner_id_key;
create index if not exists specialists_owner_id_idx on public.specialists (owner_id);

-- 2) Moderation status (source of truth) and owner-controlled visibility ------------
alter table public.specialists add column if not exists moderation_comment text not null default '';
alter table public.specialists add column if not exists published boolean not null default true;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'specialists' and column_name = 'moderation_status'
  ) then
    alter table public.specialists add column moderation_status text not null default 'pending';
    update public.specialists set moderation_status = case when approved then 'approved' else 'pending' end;
  end if;
end $$;

alter table public.specialists drop constraint if exists specialists_moderation_status_check;
alter table public.specialists add constraint specialists_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected', 'needs_changes'));
alter table public.specialists drop constraint if exists specialists_moderation_comment_len;
alter table public.specialists add constraint specialists_moderation_comment_len check (char_length(moderation_comment) <= 1000);

-- `approved` becomes derived from the status, so the two can never disagree.
do $$
declare r record;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'specialists' and column_name = 'approved' and is_generated = 'NEVER'
  ) then
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'specialists' and cmd = 'SELECT'
    loop
      execute format('drop policy %I on public.specialists', r.policyname);
    end loop;
    alter table public.specialists drop column approved;
    alter table public.specialists add column approved boolean generated always as (moderation_status = 'approved') stored;
  end if;
end $$;

drop policy if exists "approved listings are public" on public.specialists;
create policy "approved listings are public" on public.specialists
  for select
  using ((approved and published) or owner_id = auth.uid() or public.is_admin());

-- 3) Owners cannot touch moderation fields or trust fields ---------------------------
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
      new.moderation_status := 'pending';
      new.moderation_comment := '';
    else
      new.verified := old.verified;
      new.level := old.level;
      new.rating := old.rating;
      new.reviews := old.reviews;
      new.projects := old.projects;
      new.moderation_status := old.moderation_status;
      new.moderation_comment := old.moderation_comment;
      new.owner_id := old.owner_id;
    end if;
  end if;
  return new;
end;
$$;

-- 4) Moderation actions ---------------------------------------------------------------
create or replace function public.admin_moderate_listing(p_specialist_id text, p_status text, p_comment text default '')
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('pending', 'approved', 'rejected', 'needs_changes') then raise exception 'Invalid status'; end if;
  if p_status in ('rejected', 'needs_changes') and char_length(trim(coalesce(p_comment, ''))) < 3 then
    raise exception 'A comment is required';
  end if;
  if char_length(coalesce(p_comment, '')) > 1000 then raise exception 'Comment is too long'; end if;
  update public.specialists
    set moderation_status = p_status,
        moderation_comment = case when p_status = 'approved' then '' else trim(coalesce(p_comment, '')) end
    where id = p_specialist_id;
  if not found then raise exception 'Specialist not found'; end if;
end;
$$;
revoke all on function public.admin_moderate_listing(text, text, text) from public, anon;
grant execute on function public.admin_moderate_listing(text, text, text) to authenticated;

-- Kept for existing callers: approve / hide through the new status.
create or replace function public.admin_set_listing_approved(p_specialist_id text, p_approved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.specialists
    set moderation_status = case when p_approved then 'approved' else 'pending' end,
        moderation_comment = ''
    where id = p_specialist_id;
end;
$$;
revoke all on function public.admin_set_listing_approved(text, boolean) from public, anon;
grant execute on function public.admin_set_listing_approved(text, boolean) to authenticated;

-- The owner sends a corrected listing back to the moderators.
create or replace function public.submit_listing_for_review(p_specialist_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.specialists
    set moderation_status = 'pending'
    where id = p_specialist_id and owner_id = auth.uid() and moderation_status in ('needs_changes', 'rejected');
  if not found then raise exception 'Listing cannot be submitted'; end if;
end;
$$;
revoke all on function public.submit_listing_for_review(text) from public, anon;
grant execute on function public.submit_listing_for_review(text) to authenticated;

-- Deleting is refused when the listing has orders (hide it instead): orders are history.
create or replace function public.delete_my_listing(p_specialist_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.specialists where id = p_specialist_id and owner_id = auth.uid()) then
    raise exception 'Listing not found';
  end if;
  if exists (select 1 from public.orders where specialist_id = p_specialist_id) then
    raise exception 'Listing has orders';
  end if;
  delete from public.specialists where id = p_specialist_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.delete_my_listing(text) from public, anon;
grant execute on function public.delete_my_listing(text) to authenticated;

-- 5) The admin "add / edit specialist" function now writes the status ---------------
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
  v_status text := case when coalesce((p ->> 'approved')::boolean, true) then 'approved' else 'pending' end;
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
      verified, level, bio, qualification, avatar, cover, portfolio, tags, available, is_new, moderation_status
    ) values (
      v_id, null, trim(p ->> 'name'), p ->> 'category', p ->> 'category_key', trim(p ->> 'city'),
      (p ->> 'age')::int, coalesce((p ->> 'experience')::int, 0), 0, 0, 0, (p ->> 'price')::int,
      coalesce((p ->> 'verified')::boolean, false), v_level, coalesce(p ->> 'bio', ''), coalesce(p ->> 'qualification', ''),
      coalesce(p ->> 'avatar', ''), coalesce(p ->> 'cover', ''), v_portfolio, v_tags,
      coalesce((p ->> 'available')::boolean, true), true, v_status
    );
  else
    update public.specialists set
      name = trim(p ->> 'name'), category = p ->> 'category', category_key = p ->> 'category_key',
      city = trim(p ->> 'city'), age = (p ->> 'age')::int, experience = coalesce((p ->> 'experience')::int, 0),
      price = (p ->> 'price')::int, verified = coalesce((p ->> 'verified')::boolean, verified), level = v_level,
      bio = coalesce(p ->> 'bio', ''), qualification = coalesce(p ->> 'qualification', ''),
      avatar = coalesce(p ->> 'avatar', avatar), cover = coalesce(p ->> 'cover', cover),
      portfolio = v_portfolio, tags = v_tags,
      available = coalesce((p ->> 'available')::boolean, available),
      moderation_status = case when p ? 'approved' then v_status else moderation_status end,
      moderation_comment = case when p ? 'approved' and v_status = 'approved' then '' else moderation_comment end
    where id = v_id;
    if not found then raise exception 'Specialist not found'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_upsert_specialist(jsonb) from public, anon;
grant execute on function public.admin_upsert_specialist(jsonb) to authenticated;

-- 6) Contact data of an account, for moderators who verify a listing ------------------
create or replace function public.admin_user_contact(p_user_id uuid)
returns table (email text, phone text, full_name text)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select u.email::text, u.phone::text, coalesce(p.full_name, '')
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = p_user_id;
end;
$$;
revoke all on function public.admin_user_contact(uuid) from public, anon;
grant execute on function public.admin_user_contact(uuid) to authenticated;
