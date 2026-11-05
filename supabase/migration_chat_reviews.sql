-- Chat v2 (two-sided, realtime) + verified reviews. Idempotent: safe to re-run.

-- 1) Unread counter for the specialist side
alter table public.conversations
  add column if not exists specialist_unread int not null default 0;

-- 2) Server-side bookkeeping: conversation summary + unread counters are
--    maintained by a trigger, so neither side can desync or forge them.
create or replace function public.on_message_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations
  set last_message = case when new.message_type = 'image' then 'Photo' else new.text end,
      last_time = new.created_at,
      unread = unread + (case when new.sender = 'them' then 1 else 0 end),
      specialist_unread = specialist_unread + (case when new.sender = 'me' then 1 else 0 end)
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.on_message_created();

-- 3) A confirmed booking opens the conversation and posts the system message
--    server-side (clients can no longer write "specialist" messages).
create or replace function public.on_order_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'confirmed' then
      return new;
    end if;
  end if;

  insert into public.conversations (user_id, specialist_id)
  values (new.user_id, new.specialist_id)
  on conflict (user_id, specialist_id) do nothing;

  select id into conv_id from public.conversations
  where user_id = new.user_id and specialist_id = new.specialist_id;

  insert into public.messages (conversation_id, sender, text)
  values (
    conv_id, 'them',
    format('Booking confirmed! Looking forward to our session on %s at %s for "%s".',
           to_char(new.booking_date, 'Mon FMDD, YYYY'), new.booking_slot, new.service)
  );
  return new;
end;
$$;

drop trigger if exists on_order_confirmed on public.orders;
create trigger on_order_confirmed
  after insert or update of status on public.orders
  for each row when (new.status = 'confirmed')
  execute procedure public.on_order_created();

-- 4) Messages: clients may only send as themselves; specialists read and
--    reply (as the specialist) inside conversations on their own listing.
drop policy if exists "users manage messages in their own conversations" on public.messages;
drop policy if exists "clients read their messages" on public.messages;
drop policy if exists "clients send messages" on public.messages;
drop policy if exists "clients delete their messages" on public.messages;
drop policy if exists "specialists read messages on their listing" on public.messages;
drop policy if exists "specialists reply on their listing" on public.messages;

create policy "clients read their messages"
  on public.messages for select
  using (exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid()));

create policy "clients send messages"
  on public.messages for insert
  with check (
    sender = 'me'
    and exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  );

create policy "clients delete their messages"
  on public.messages for delete
  using (exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid()));

create policy "specialists read messages on their listing"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    join public.specialists s on s.id = c.specialist_id
    where c.id = messages.conversation_id and s.owner_id = auth.uid()
  ));

create policy "specialists reply on their listing"
  on public.messages for insert
  with check (
    sender = 'them'
    and exists (
      select 1 from public.conversations c
      join public.specialists s on s.id = c.specialist_id
      where c.id = messages.conversation_id and s.owner_id = auth.uid()
    )
  );

-- 5) Conversations: specialists see and mark-read the ones on their listing
drop policy if exists "specialists see conversations on their listing" on public.conversations;
create policy "specialists see conversations on their listing"
  on public.conversations for select
  using (exists (select 1 from public.specialists s where s.id = conversations.specialist_id and s.owner_id = auth.uid()));

drop policy if exists "specialists update conversations on their listing" on public.conversations;
create policy "specialists update conversations on their listing"
  on public.conversations for update
  using (exists (select 1 from public.specialists s where s.id = conversations.specialist_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.specialists s where s.id = conversations.specialist_id and s.owner_id = auth.uid()));

-- A specialist can read the display name of anyone who started a conversation with them
drop policy if exists "specialists can view profiles of people who wrote to them" on public.profiles;
create policy "specialists can view profiles of people who wrote to them"
  on public.profiles for select
  using (exists (
    select 1 from public.conversations c
    join public.specialists s on s.id = c.specialist_id
    where c.user_id = profiles.id and s.owner_id = auth.uid()
  ));

-- 6) Reviews: only the client of a COMPLETED order may review it, once
alter table public.reviews
  add column if not exists order_id uuid references public.orders (id) on delete set null;

create unique index if not exists reviews_one_per_order
  on public.reviews (order_id) where order_id is not null;

drop policy if exists "authenticated users can write their own reviews" on public.reviews;
drop policy if exists "clients review their completed orders" on public.reviews;
create policy "clients review their completed orders"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.user_id = auth.uid()
        and o.specialist_id = reviews.specialist_id
        and o.status = 'completed'
    )
  );

-- 7) Realtime: live chat on both sides (RLS still applies to what each user receives)
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ============================================================
-- 8) HARDENING (security review)
-- ============================================================

-- 8a) Sanity limits on user-supplied data
alter table public.messages    drop constraint if exists messages_text_len;
alter table public.messages    add  constraint messages_text_len check (char_length(text) <= 4000);
alter table public.reviews     drop constraint if exists reviews_text_len;
alter table public.reviews     add  constraint reviews_text_len check (char_length(text) between 1 and 1500);
alter table public.specialists drop constraint if exists specialists_name_len;
alter table public.specialists add  constraint specialists_name_len check (char_length(name) between 1 and 100);
alter table public.specialists drop constraint if exists specialists_city_len;
alter table public.specialists add  constraint specialists_city_len check (char_length(city) between 1 and 80);
alter table public.specialists drop constraint if exists specialists_bio_len;
alter table public.specialists add  constraint specialists_bio_len check (char_length(bio) <= 2000);
alter table public.specialists drop constraint if exists specialists_price_range;
alter table public.specialists add  constraint specialists_price_range check (price between 1000 and 100000000);
alter table public.specialists drop constraint if exists specialists_age_range;
alter table public.specialists add  constraint specialists_age_range check (age between 16 and 99);
alter table public.profiles    drop constraint if exists profiles_name_len;
alter table public.profiles    add  constraint profiles_name_len check (char_length(full_name) <= 100);
alter table public.orders      drop constraint if exists orders_amount_range;
alter table public.orders      add  constraint orders_amount_range check (amount between 1 and 100000000);

-- 8b) A specialist can edit their listing but never their own trust signals.
--     (Server-side jobs and the SQL editor run as postgres/service_role and bypass this.)
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
    else
      new.verified := old.verified;
      new.level := old.level;
      new.rating := old.rating;
      new.reviews := old.reviews;
      new.projects := old.projects;
      new.owner_id := old.owner_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_specialist_columns on public.specialists;
create trigger protect_specialist_columns
  before insert or update on public.specialists
  for each row execute procedure public.protect_specialist_columns();

-- 8c) Review author identity comes from the profile, never from the request
create or replace function public.stamp_review_author()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.author_id := auth.uid();
  new.author_name := coalesce(nullif((select full_name from public.profiles where id = auth.uid()), ''), 'Client');
  new.author_avatar := '';
  return new;
end;
$$;

drop trigger if exists stamp_review_author on public.reviews;
create trigger stamp_review_author
  before insert on public.reviews
  for each row
  when (current_user in ('authenticated', 'anon'))
  execute procedure public.stamp_review_author();

-- 8d) Orders can no longer be inserted or deleted directly. Bookings go through
--     create_booking() below, which validates everything and is atomic.
drop policy if exists "users manage their own orders" on public.orders;
drop policy if exists "clients read their orders" on public.orders;
drop policy if exists "clients cancel their orders" on public.orders;

create policy "clients read their orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "clients cancel their orders"
  on public.orders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke insert, delete on public.orders from authenticated;

drop policy if exists "authenticated users can book a slot" on public.booked_slots;
revoke insert, update, delete on public.booked_slots from authenticated;

-- 8e) Update guard: money/identity fields are immutable; status moves only along allowed paths
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

drop trigger if exists guard_order_update on public.orders;
create trigger guard_order_update
  before update on public.orders
  for each row execute procedure public.guard_order_update();

-- 8f) Atomic, validated booking. NOTE: while payments are in demo mode a client may
--     create a 'confirmed' order directly. When Click/Payme go live, change the
--     p_status rule below to accept only 'pending' (the webhook confirms the order).
create or replace function public.create_booking(
  p_specialist_id text,
  p_date date,
  p_slot text,
  p_service text,
  p_amount int,
  p_status text default 'confirmed'
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_spec public.specialists;
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_spec from public.specialists where id = p_specialist_id;
  if not found then raise exception 'Specialist not found'; end if;
  if v_spec.owner_id = auth.uid() then raise exception 'You cannot book your own listing'; end if;
  if not v_spec.available then raise exception 'This specialist is not accepting bookings'; end if;
  if p_date < current_date or p_date > current_date + 365 then raise exception 'Choose a valid date'; end if;
  if p_slot not in ('09:00', '11:00', '13:00', '15:00', '17:00') then raise exception 'Invalid time slot'; end if;
  if p_service is null or char_length(p_service) not between 1 and 100 then raise exception 'Invalid service'; end if;
  if p_amount < v_spec.price - 500 or p_amount > 100000000 then raise exception 'Invalid amount'; end if;
  if p_status not in ('pending', 'confirmed') then raise exception 'Invalid status'; end if;

  insert into public.orders (user_id, specialist_id, service, amount, status, booking_date, booking_slot)
  values (auth.uid(), p_specialist_id, p_service, p_amount, p_status, p_date, p_slot)
  returning * into v_order;

  -- Unique (specialist, date, slot): a concurrent booking raises 23505 and the whole
  -- transaction (including the order and its chat message) rolls back.
  insert into public.booked_slots (specialist_id, booking_date, booking_slot, order_id)
  values (p_specialist_id, p_date, p_slot, v_order.id);

  return v_order;
end;
$$;

revoke execute on function public.create_booking(text, date, text, text, int, text) from public, anon;
grant execute on function public.create_booking(text, date, text, text, int, text) to authenticated;

-- 8g) Right to erasure: the signed-in user can delete their own account and data
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;
  delete from public.specialists where owner_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 8h) Storage: images only, size-capped, written/deleted only inside your own folder
update storage.buckets
set file_size_limit = 4194304,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'chat-images';

drop policy if exists "authenticated users can upload chat images" on storage.objects;
drop policy if exists "users upload to their own folder" on storage.objects;
create policy "users upload to their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their own chat images" on storage.objects;
create policy "users delete their own chat images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 8i) Least privilege: anonymous visitors only ever need the public catalog
revoke all on all tables in schema public from anon;
grant select on public.specialists, public.reviews to anon;
revoke insert, update, delete on public.payment_transactions from authenticated;
revoke insert, delete on public.profiles from authenticated;

-- 8j) Cancelling a booking frees its slot (clients cannot delete booked_slots themselves)
create or replace function public.release_slot_on_cancel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.booked_slots where order_id = new.id;
  return new;
end;
$$;

drop trigger if exists release_slot_on_cancel on public.orders;
create trigger release_slot_on_cancel
  after update of status on public.orders
  for each row when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute procedure public.release_slot_on_cancel();
