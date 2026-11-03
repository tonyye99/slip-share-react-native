alter table public.receipts
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists idx_receipts_share_token
  on public.receipts(share_token);

create table if not exists public.receipt_participants (
  receipt_id  uuid not null references public.receipts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (receipt_id, user_id)
);

create index if not exists idx_receipt_participants_user
  on public.receipt_participants(user_id);

alter table public.receipt_participants enable row level security;

create or replace function public.is_receipt_owner(p_receipt_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.receipts r
    where r.id = p_receipt_id and r.user_id = auth.uid()
  )
$$;

create or replace function public.is_receipt_participant(p_receipt_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.receipt_participants p
    where p.receipt_id = p_receipt_id and p.user_id = auth.uid()
  )
$$;

create or replace function public.can_access_receipt(p_receipt_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_receipt_owner(p_receipt_id)
      or public.is_receipt_participant(p_receipt_id)
$$;

drop policy if exists "receipts_participant_read" on public.receipts;
create policy "receipts_participant_read"
on public.receipts
for select
to authenticated
using (public.is_receipt_participant(id));

drop policy if exists "items_participant_read" on public.receipts_items;
create policy "items_participant_read"
on public.receipts_items
for select
to authenticated
using (public.is_receipt_participant(receipt_id));

drop policy if exists "participants_read" on public.receipt_participants;
create policy "participants_read"
on public.receipt_participants
for select
to authenticated
using (user_id = auth.uid() or public.is_receipt_owner(receipt_id));

drop policy if exists "participants_delete" on public.receipt_participants;
create policy "participants_delete"
on public.receipt_participants
for delete
to authenticated
using (user_id = auth.uid() or public.is_receipt_owner(receipt_id));

drop policy if exists "user_selections_owner_all" on public.user_selections;
create policy "user_selections_owner_all"
on public.user_selections
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.can_access_receipt(receipt_id));

create or replace function public.join_receipt(p_share_token uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_receipt_id uuid;
  v_owner_id   uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select r.id, r.user_id into v_receipt_id, v_owner_id
  from public.receipts r
  where r.share_token = p_share_token;

  if v_receipt_id is null then
    raise exception 'Receipt not found' using errcode = 'P0002';
  end if;

  if v_owner_id <> auth.uid() then
    insert into public.receipt_participants (receipt_id, user_id)
    values (v_receipt_id, auth.uid())
    on conflict do nothing;
  end if;

  return v_receipt_id;
end;
$$;

revoke execute on function public.join_receipt(uuid) from public, anon;
grant execute on function public.join_receipt(uuid) to authenticated;
