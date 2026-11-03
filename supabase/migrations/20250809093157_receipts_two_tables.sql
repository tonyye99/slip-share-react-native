    create extension if not exists pgcrypto;

    create table if not exists public.receipts (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users(id) on delete cascade,
    merchant_name    text,
    currency         char(3) not null default 'THB',
    tax_percent      numeric(7,4) not null
                    check (tax_percent >= 0 and tax_percent <= 100),
    service_percent  numeric(7,4) not null
                    check (service_percent >= 0 and service_percent <= 100),
    rounding         numeric(4,2) not null default 0,
    raw_json         jsonb,
    parser_version   text,
    issued_at        timestamptz,
    storage_key      text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
    );

    create index if not exists idx_receipts_user_created
    on public.receipts(user_id, created_at desc);

    create table if not exists public.receipts_items (
    id               uuid primary key default gen_random_uuid(),
    receipt_id       uuid not null references public.receipts(id) on delete cascade,
    position         int  not null check (position > 0),
    name             text not null,
    qty              numeric(10,3) not null check (qty >= 0),
    unit_price       numeric(10,2) not null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (receipt_id, position)
    );

    create index if not exists idx_receipts_items_receipt
    on public.receipts_items(receipt_id);

    alter table public.receipts enable row level security;
    alter table public.receipts_items enable row level security;

    drop policy if exists "receipts_owner_all" on public.receipts;
    create policy "receipts_owner_all"
    on public.receipts
    for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

    drop policy if exists "items_through_receipt" on public.receipts_items;
    create policy "items_through_receipt"
    on public.receipts_items
    for all
    to authenticated
    using (
    exists (
        select 1 from public.receipts r
        where r.id = receipts_items.receipt_id and r.user_id = auth.uid()
    )
    )
    with check (
    exists (
        select 1 from public.receipts r
        where r.id = receipts_items.receipt_id and r.user_id = auth.uid()
    )
    );
