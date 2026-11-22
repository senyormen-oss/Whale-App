-- New requests only for approved AND published listings (a hidden listing could be booked by direct link).
-- Also re-applies the 20 open-request limit. Run AFTER migration_moderation_multi.sql. Idempotent.
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

  select * into v_spec from public.specialists where id = p_specialist_id and approved and published;
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

  if (select count(*) from public.orders where user_id = auth.uid() and status = 'pending') >= 20 then
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


notify pgrst, 'reload schema';
