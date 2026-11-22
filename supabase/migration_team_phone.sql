-- Team members can be added / listed by phone as well as e-mail (most accounts sign in by SMS). Idempotent.

drop function if exists public.admin_list_admins();
create function public.admin_list_admins()
returns table (user_id uuid, email text, phone text, full_name text)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select a.user_id, coalesce(u.email, '')::text, coalesce(u.phone, '')::text, coalesce(p.full_name, '')
    from public.admins a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by coalesce(p.full_name, ''), u.email, u.phone;
end;
$$;
revoke all on function public.admin_list_admins() from public, anon;
grant execute on function public.admin_list_admins() to authenticated;

-- p_email keeps its name for older app versions; it accepts an e-mail or a phone number.
create or replace function public.admin_set_role(p_email text, p_admin boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_input text := trim(coalesce(p_email, ''));
  v_digits text := regexp_replace(coalesce(p_email, ''), '\D', '', 'g');
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if char_length(v_digits) = 9 then v_digits := '998' || v_digits; end if;

  if position('@' in v_input) > 0 then
    select id into v_id from auth.users where lower(email) = lower(v_input) limit 1;
  elsif char_length(v_digits) >= 9 then
    select id into v_id from auth.users where phone = v_digits or phone = '+' || v_digits limit 1;
  end if;
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

notify pgrst, 'reload schema';
