-- Whale — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE / drop-then-create policy).

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- profiles — one row per authenticated user, created automatically on signup
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  city text not null default '',
  avatar_url text not null default '',
  role text not null default 'client' check (role in ('client', 'specialist')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by their owner" on public.profiles;
create policy "profiles are viewable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles are editable by their owner" on public.profiles;
create policy "profiles are editable by their owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- specialists — public catalog, read-only from the client
-- ============================================================
create table if not exists public.specialists (
  id text primary key,
  name text not null,
  category text not null,
  category_key text not null,
  city text not null,
  age int not null,
  experience int not null,
  projects int not null,
  reviews int not null,
  rating numeric(2, 1) not null,
  price int not null,
  verified boolean not null default false,
  level text not null check (level in ('bronze', 'silver', 'gold', 'platinum')),
  bio text not null default '',
  avatar text not null default '',
  cover text not null default '',
  portfolio text[] not null default '{}',
  tags text[] not null default '{}',
  available boolean not null default true,
  is_new boolean not null default false
);

alter table public.specialists enable row level security;

drop policy if exists "specialists are publicly readable" on public.specialists;
create policy "specialists are publicly readable"
  on public.specialists for select
  using (true);

-- ============================================================
-- reviews — public read, insert restricted to authenticated users
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  specialist_id text not null references public.specialists (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  author_avatar text not null default '',
  rating int not null check (rating between 1 and 5),
  quality int not null check (quality between 1 and 5),
  timing int not null check (timing between 1 and 5),
  communication int not null check (communication between 1 and 5),
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable"
  on public.reviews for select
  using (true);

drop policy if exists "authenticated users can write their own reviews" on public.reviews;
create policy "authenticated users can write their own reviews"
  on public.reviews for insert
  with check (auth.uid() = author_id);

-- ============================================================
-- orders — private to the owning user
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  specialist_id text not null references public.specialists (id) on delete cascade,
  service text not null,
  amount int not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  booking_date date not null,
  booking_slot text not null,
  payment_provider text,
  payment_ref text,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "users manage their own orders" on public.orders;
create policy "users manage their own orders"
  on public.orders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- booked_slots — global source of truth so two clients can't double-book
-- ============================================================
create table if not exists public.booked_slots (
  id uuid primary key default gen_random_uuid(),
  specialist_id text not null references public.specialists (id) on delete cascade,
  booking_date date not null,
  booking_slot text not null,
  order_id uuid references public.orders (id) on delete cascade,
  unique (specialist_id, booking_date, booking_slot)
);

alter table public.booked_slots enable row level security;

-- Anyone signed in can see which slots are taken (needed to render the calendar),
-- but only the booking flow (via the orders insert) should create rows.
drop policy if exists "booked slots are readable by authenticated users" on public.booked_slots;
create policy "booked slots are readable by authenticated users"
  on public.booked_slots for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can book a slot" on public.booked_slots;
create policy "authenticated users can book a slot"
  on public.booked_slots for insert
  to authenticated
  with check (true);

-- ============================================================
-- conversations — private to the owning user
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  specialist_id text not null references public.specialists (id) on delete cascade,
  last_message text not null default '',
  last_time timestamptz not null default now(),
  unread int not null default 0,
  unique (user_id, specialist_id)
);

alter table public.conversations enable row level security;

drop policy if exists "users manage their own conversations" on public.conversations;
create policy "users manage their own conversations"
  on public.conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- messages — private, scoped through the parent conversation
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender text not null check (sender in ('me', 'them')),
  text text not null default '',
  message_type text not null default 'text' check (message_type in ('text', 'image')),
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "users manage messages in their own conversations" on public.messages;
create policy "users manage messages in their own conversations"
  on public.messages for all
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- favorites — private to the owning user
-- ============================================================
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  specialist_id text not null references public.specialists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, specialist_id)
);

alter table public.favorites enable row level security;

drop policy if exists "users manage their own favorites" on public.favorites;
create policy "users manage their own favorites"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for chat image attachments
-- ============================================================
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "chat images are publicly readable" on storage.objects;
create policy "chat images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "authenticated users can upload chat images" on storage.objects;
create policy "authenticated users can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');

-- ============================================================
-- Grants — RLS policies only govern which ROWS a role can see; Postgres also
-- requires baseline table-level privileges before RLS is even evaluated.
-- (Needed because this project was created with "Automatically expose new
-- tables" turned off, which is the more secure default but skips these.)
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on public.specialists to anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert on public.booked_slots to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
grant select, update on public.profiles to authenticated;

-- ============================================================
-- Specialist mode — lets an authenticated user own and manage a row in
-- public.specialists (their own public listing), instead of specialists
-- only existing as read-only seed data.
-- ============================================================
alter table public.specialists
  add column if not exists owner_id uuid references auth.users (id) on delete set null;

alter table public.specialists
  alter column id set default gen_random_uuid()::text;

create unique index if not exists specialists_owner_id_key
  on public.specialists (owner_id)
  where owner_id is not null;

drop policy if exists "specialists can manage their own listing" on public.specialists;
create policy "specialists can manage their own listing"
  on public.specialists for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant insert, update, delete on public.specialists to authenticated;

-- A specialist may read the profile (display name) of any client who has
-- actually booked them — narrowly scoped, not a blanket "specialists see
-- everyone" grant.
drop policy if exists "specialists can view profiles of their clients" on public.profiles;
create policy "specialists can view profiles of their clients"
  on public.profiles for select
  using (
    exists (
      select 1 from public.orders o
      join public.specialists s on s.id = o.specialist_id
      where o.user_id = profiles.id and s.owner_id = auth.uid()
    )
  );

-- Keep specialists.rating / specialists.reviews in sync with the real
-- reviews table instead of being static numbers set once at seed time.
create or replace function public.refresh_specialist_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_id text := coalesce(new.specialist_id, old.specialist_id);
begin
  update public.specialists s
  set reviews = (select count(*) from public.reviews r where r.specialist_id = target_id),
      rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.specialist_id = target_id), 0)
  where s.id = target_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute procedure public.refresh_specialist_rating();

-- Keep specialists.projects in sync with their completed order count.
create or replace function public.refresh_specialist_projects()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_id text := coalesce(new.specialist_id, old.specialist_id);
begin
  update public.specialists s
  set projects = (select count(*) from public.orders o where o.specialist_id = target_id and o.status = 'completed')
  where s.id = target_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_order_change on public.orders;
create trigger on_order_change
  after insert or update or delete on public.orders
  for each row execute procedure public.refresh_specialist_projects();

-- A specialist can see and update (e.g. mark completed) orders booked
-- against their own listing — scoped strictly to that listing's orders.
drop policy if exists "specialists can view orders for their listing" on public.orders;
create policy "specialists can view orders for their listing"
  on public.orders for select
  using (exists (select 1 from public.specialists s where s.id = orders.specialist_id and s.owner_id = auth.uid()));

drop policy if exists "specialists can update orders for their listing" on public.orders;
create policy "specialists can update orders for their listing"
  on public.orders for update
  using (exists (select 1 from public.specialists s where s.id = orders.specialist_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.specialists s where s.id = orders.specialist_id and s.owner_id = auth.uid()));

-- ============================================================
-- payment_transactions — one row per real gateway attempt for an order.
-- Only the Click/Payme webhook Edge Functions write to this table, using
-- the service_role key (which bypasses RLS entirely). The client can only
-- ever read the status of its own transactions.
-- ============================================================
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null check (provider in ('click', 'payme')),
  provider_transaction_id text,
  amount int not null,
  state text not null default 'pending' check (state in ('pending', 'paid', 'cancelled', 'failed')),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_transactions enable row level security;

drop policy if exists "users can view their own payment transactions" on public.payment_transactions;
create policy "users can view their own payment transactions"
  on public.payment_transactions for select
  using (exists (select 1 from public.orders o where o.id = payment_transactions.order_id and o.user_id = auth.uid()));

grant select on public.payment_transactions to authenticated;

create index if not exists payment_transactions_order_id_idx on public.payment_transactions (order_id);
create unique index if not exists payment_transactions_provider_txn_idx
  on public.payment_transactions (provider, provider_transaction_id)
  where provider_transaction_id is not null;
