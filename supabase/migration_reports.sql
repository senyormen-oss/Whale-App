-- Reports about specialist listings (reviewed by the owner in Table Editor). Idempotent.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  specialist_id text not null references public.specialists(id) on delete cascade,
  reason text not null check (reason in ('spam', 'fraud', 'inappropriate', 'fake', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "users send their own reports" on public.reports;
create policy "users send their own reports" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "users read their own reports" on public.reports;
create policy "users read their own reports" on public.reports
  for select to authenticated
  using (reporter_id = auth.uid());

revoke all on public.reports from anon;
revoke update, delete on public.reports from authenticated;
grant select, insert on public.reports to authenticated;

-- One open report per person per listing per day, so the table cannot be flooded.
create unique index if not exists reports_one_per_day
  on public.reports (reporter_id, specialist_id, ((created_at at time zone 'UTC')::date));
