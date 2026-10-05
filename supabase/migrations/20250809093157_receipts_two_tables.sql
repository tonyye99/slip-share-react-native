    -- Load pgcrypto so gen_random_uuid() works.
    create extension if not exists pgcrypto;

    -- ================= receipts =================

    -- Create the receipts table if it does not exist.
    create table if not exists public.receipts (
    -- Primary key as UUID with server-side default.
    id               uuid primary key default gen_random_uuid(),
    -- Owner of the receipt (from Supabase auth.users).
    user_id          uuid not null references auth.users(id) on delete cascade,
    -- Optional merchant name.
    merchant_name    text,
    -- Three-letter currency. Default THB. Restrict to THB or USD.
    currency         char(3) not null default 'THB',
    -- Tax percent with decimals (e.g., 7.35). Bounded 0–100.
    tax_percent      numeric(7,4) not null
                    check (tax_percent >= 0 and tax_percent <= 100),
    -- Service percent with decimals. Bounded 0–100.
    service_percent  numeric(7,4) not null
                    check (service_percent >= 0 and service_percent <= 100),
    -- Rounding step in major units. 0=no rounding, 0.05 or 0.10 allowed.
    rounding         numeric(4,2) not null default 0,
    -- Optional snapshot of the raw parser output for debugging/audit.
    raw_json         jsonb,
    -- Parser/model/version tag.
    parser_version   text,
    -- Optional receipt issue timestamp parsed from the image.
    issued_at        timestamptz,
    -- Path to the stored image (e.g., Supabase Storage key).
    storage_key      text,
    -- Timestamps.
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
    );

    -- Helpful index to fetch latest receipts per user quickly.
    create index if not exists idx_receipts_user_created
    on public.receipts(user_id, created_at desc);

    -- ============ receipts_items ===============

    -- Line-item table linked to a receipt.
    create table if not exists public.receipts_items (
    -- Primary key as UUID.
    id               uuid primary key default gen_random_uuid(),
    -- FK to receipts. Cascade deletes when a receipt is removed.
    receipt_id       uuid not null references public.receipts(id) on delete cascade,
    -- Original line order from the receipt. 1-based. Must be > 0.
    position         int  not null check (position > 0),
    -- Item name.
    name             text not null,
    -- Quantity. Allows decimals (e.g., 0.5).
    qty              numeric(10,3) not null check (qty >= 0),
    -- Unit price stored as exact decimal (e.g., 289.00). Can be negative for discounts.
    unit_price       numeric(10,2) not null,
    -- Timestamps.
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    -- Prevent duplicate positions within the same receipt.
    unique (receipt_id, position)
    );

    -- Index to fetch items by receipt quickly.
    create index if not exists idx_receipts_items_receipt
    on public.receipts_items(receipt_id);

    -- ================== RLS ====================

    -- Turn on Row Level Security.
    alter table public.receipts enable row level security;
    alter table public.receipts_items enable row level security;

    -- Policy: users can select/insert/update/delete only their own receipts.
    drop policy if exists "receipts_owner_all" on public.receipts;
    create policy "receipts_owner_all"
    on public.receipts
    for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

    -- Policy: users can access items only if the parent receipt is theirs.
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
