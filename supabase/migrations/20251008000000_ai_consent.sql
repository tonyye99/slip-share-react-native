create table if not exists public.ai_consents (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  consented_at timestamptz not null default now()
);

alter table public.ai_consents enable row level security;

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

revoke insert on public.ai_consents from anon, authenticated;
grant insert (user_id) on public.ai_consents to authenticated;
