-- Permission to send receipt photos to OpenAI. The app asks before the first
-- scan, and the parse-receipt Edge Function won't call OpenAI without a row
-- here. Turning scanning off in the app deletes the row.
-- This is its own table, not a profiles column, because friends on a shared
-- receipt can read your profile.

create table if not exists public.ai_consents (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  consented_at timestamptz not null default now()
);

alter table public.ai_consents enable row level security;

-- No update policy: consented_at records when you agreed and can't be changed.
drop policy if exists "ai_consents_read" on public.ai_consents;
create policy "ai_consents_read"
on public.ai_consents
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_consents_insert" on public.ai_consents;
create policy "ai_consents_insert"
on public.ai_consents
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ai_consents_delete" on public.ai_consents;
create policy "ai_consents_delete"
on public.ai_consents
for delete
to authenticated
using (user_id = auth.uid());

-- The app only sends user_id, so consented_at always comes from the server clock.
revoke insert on public.ai_consents from anon, authenticated;
grant insert (user_id) on public.ai_consents to authenticated;
