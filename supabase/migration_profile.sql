-- Richer specialist profile (Stage 2, task E). Run AFTER migration_price_list.sql. Idempotent.
--  * videos:       up to 8 links to YouTube / Instagram / TikTok.
--  * certificates: up to 10 photos uploaded to our storage.
--  * socials:      public links that show work (Instagram, YouTube, TikTok, Behance, website).
--                  Messenger links are refused here so clients cannot bypass Whale.
--  * specialist_contacts: Telegram / WhatsApp, visible only to the owner and the Whale team.

-- 1) Validation helpers ----------------------------------------------------------------
create or replace function public.links_ok(arr text[], pattern text, maxn int)
returns boolean
language sql
immutable
as $$
  select coalesce(array_length(arr, 1), 0) <= maxn
     and not exists (select 1 from unnest(arr) u where u is null or char_length(u) > 500 or u !~* pattern)
$$;

create or replace function public.socials_ok(j jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(j) = 'object'
     and not exists (
       select 1 from jsonb_each(j) e
       where jsonb_typeof(e.value) <> 'string'
          or char_length(e.value #>> '{}') > 200
          or (e.value #>> '{}') ~* '(t\.me/|telegram|wa\.me/|whatsapp|viber)'
          or not (e.value #>> '{}') ~* case e.key
               when 'instagram' then '^https://(www\.)?instagram\.com/'
               when 'youtube'   then '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'
               when 'tiktok'    then '^https://(www\.|vm\.)?tiktok\.com/'
               when 'behance'   then '^https://(www\.)?behance\.net/'
               when 'website'   then '^https://[a-z0-9.-]+\.[a-z]{2,}(/|$)'
               else '^$never'
             end
     )
$$;

-- 2) New listing columns -----------------------------------------------------------------
alter table public.specialists add column if not exists videos text[] not null default '{}';
alter table public.specialists add column if not exists certificates text[] not null default '{}';
alter table public.specialists add column if not exists socials jsonb not null default '{}'::jsonb;

alter table public.specialists drop constraint if exists specialists_videos_check;
alter table public.specialists add constraint specialists_videos_check check (
  public.links_ok(videos, '^https://(www\.|m\.|vm\.)?(youtube\.com|youtu\.be|instagram\.com|tiktok\.com)/', 8)
);
alter table public.specialists drop constraint if exists specialists_certificates_check;
alter table public.specialists add constraint specialists_certificates_check check (
  public.links_ok(certificates, '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/chat-images/', 10)
);
alter table public.specialists drop constraint if exists specialists_socials_check;
alter table public.specialists add constraint specialists_socials_check check (public.socials_ok(socials));

-- 3) Private messenger contacts ------------------------------------------------------------
create table if not exists public.specialist_contacts (
  specialist_id text primary key references public.specialists (id) on delete cascade,
  telegram text not null default '',
  whatsapp text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.specialist_contacts drop constraint if exists specialist_contacts_telegram_check;
alter table public.specialist_contacts add constraint specialist_contacts_telegram_check check (telegram ~ '^(@?[A-Za-z0-9_]{4,32})?$');
alter table public.specialist_contacts drop constraint if exists specialist_contacts_whatsapp_check;
alter table public.specialist_contacts add constraint specialist_contacts_whatsapp_check check (whatsapp ~ '^(\+?[0-9]{9,15})?$');

alter table public.specialist_contacts enable row level security;
drop policy if exists "owners and admins manage contacts" on public.specialist_contacts;
create policy "owners and admins manage contacts" on public.specialist_contacts
  for all to authenticated
  using (public.is_admin() or exists (select 1 from public.specialists s where s.id = specialist_contacts.specialist_id and s.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.specialists s where s.id = specialist_contacts.specialist_id and s.owner_id = auth.uid()));
revoke all on public.specialist_contacts from anon;
grant select, insert, update, delete on public.specialist_contacts to authenticated;

notify pgrst, 'reload schema';
