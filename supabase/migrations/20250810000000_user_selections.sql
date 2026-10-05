-- Create user_selections table for storing which items users selected from receipts

create table if not exists public.user_selections (
  -- Primary key as UUID
  id               uuid primary key default gen_random_uuid(),
  -- User who made the selection
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- Receipt being shared
  receipt_id       uuid not null references public.receipts(id) on delete cascade,
  -- Array of selected receipt item IDs
  selected_items   uuid[] not null default '{}',
  -- Calculated total for this user's selection
  calculated_total numeric(10,2) not null default 0,
  -- User's portion of tax (proportional)
  tax_amount       numeric(10,2) not null default 0,
  -- User's portion of service charge (proportional) 
  service_amount   numeric(10,2) not null default 0,
  -- User's portion of rounding adjustment (proportional)
  rounding_amount  numeric(10,2) not null default 0,
  -- Timestamps
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Prevent duplicate selections per user per receipt
  unique (user_id, receipt_id)
);

-- Index for quick lookups by receipt
create index if not exists idx_user_selections_receipt
on public.user_selections(receipt_id);

-- Index for quick lookups by user
create index if not exists idx_user_selections_user
on public.user_selections(user_id);

-- Enable Row Level Security
alter table public.user_selections enable row level security;

-- Policy: users can only access their own selections
drop policy if exists "user_selections_owner_all" on public.user_selections;
create policy "user_selections_owner_all"
on public.user_selections
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Policy: users can view selections for receipts they own (receipt owners can see who selected what)
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