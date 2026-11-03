create table if not exists public.user_selections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  receipt_id       uuid not null references public.receipts(id) on delete cascade,
  selected_items   uuid[] not null default '{}',
  calculated_total numeric(10,2) not null default 0,
  tax_amount       numeric(10,2) not null default 0,
  service_amount   numeric(10,2) not null default 0,
  rounding_amount  numeric(10,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, receipt_id)
);

create index if not exists idx_user_selections_receipt
on public.user_selections(receipt_id);

create index if not exists idx_user_selections_user
on public.user_selections(user_id);

alter table public.user_selections enable row level security;

drop policy if exists "user_selections_owner_all" on public.user_selections;
create policy "user_selections_owner_all"
on public.user_selections
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_selections_receipt_owner_read" on public.user_selections;
create policy "user_selections_receipt_owner_read"
on public.user_selections
for select
to authenticated
using (
  exists (
    select 1 from public.receipts r
    where r.id = user_selections.receipt_id and r.user_id = auth.uid()
  )
);