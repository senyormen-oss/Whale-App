-- Qualification + experience for specialist listings. Idempotent: safe to re-run.
alter table public.specialists add column if not exists qualification text not null default '';

alter table public.specialists drop constraint if exists specialists_qualification_len;
alter table public.specialists add constraint specialists_qualification_len check (char_length(qualification) <= 600);

alter table public.specialists drop constraint if exists specialists_experience_range;
alter table public.specialists add constraint specialists_experience_range check (experience between 0 and 60);
