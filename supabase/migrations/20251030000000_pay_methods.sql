-- How to pay me: the ways a user gets paid back, like their PromptPay number
-- or bank account. Friends see them on the friend link of a bill the user
-- paid, with a PromptPay QR for the exact amount they owe, and the app adds
-- them to Send totals.
--
-- Thailand first: PromptPay, a bank account, or a note in your own words.

create table if not exists public.pay_methods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('promptpay', 'bank', 'note')),
  -- PromptPay: the phone number, national ID or e-wallet ID, digits only.
  -- Bank: the account number. Note: the text itself.
  value       text not null check (char_length(btrim(value)) between 1 and 300),
  -- Bank: the bank's name.
  bank        text check (bank is null or char_length(bank) <= 60),
  -- PromptPay and bank: the name friends see, to check they're paying the right person.
  name        text check (name is null or char_length(name) <= 60),
  -- Friends see the first one first.
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint pay_methods_promptpay check (
    kind <> 'promptpay' or value ~ '^(0[0-9]{9}|[0-9]{13}|[0-9]{15})$'
  ),
  constraint pay_methods_bank check (
    kind <> 'bank' or (value ~ '^[0-9A-Za-z][0-9A-Za-z -]{3,40}$' and bank is not null and char_length(btrim(bank)) > 0)
  )
);

create index if not exists idx_pay_methods_user on public.pay_methods(user_id, position, created_at);

alter table public.pay_methods enable row level security;

drop policy if exists "pay_methods_own_read" on public.pay_methods;
create policy "pay_methods_own_read"
on public.pay_methods
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "pay_methods_own_insert" on public.pay_methods;
create policy "pay_methods_own_insert"
on public.pay_methods
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "pay_methods_own_update" on public.pay_methods;
create policy "pay_methods_own_update"
on public.pay_methods
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "pay_methods_own_delete" on public.pay_methods;
create policy "pay_methods_own_delete"
on public.pay_methods
for delete
to authenticated
using (user_id = auth.uid());

-- The app can't pick the owner or change what kind a method is.
revoke all on public.pay_methods from anon;
revoke insert, update on public.pay_methods from authenticated;
grant select, delete on public.pay_methods to authenticated;
grant insert (kind, value, bank, name, position) on public.pay_methods to authenticated;
grant update (value, bank, name, position) on public.pay_methods to authenticated;

-- Ten is plenty, and keeps friend links small.
create or replace function public.limit_pay_methods()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.pay_methods m where m.user_id = new.user_id) >= 10 then
    raise exception 'You can add up to 10 ways to get paid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_pay_methods() from public, anon, authenticated;

drop trigger if exists pay_methods_limit on public.pay_methods;
create trigger pay_methods_limit
before insert on public.pay_methods
for each row execute function public.limit_pay_methods();

-- ============ friend link: how to pay the owner ============

-- Same as before, plus `pay_methods`: the owner's ways to get paid, but only
-- on a bill the owner paid. Someone else's bill shows none.
create or replace function public.get_link_receipt(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_receipt_id uuid := public.link_receipt_id(p_token);
begin
  return (
    select jsonb_build_object(
      'merchant_name', r.merchant_name,
      'merchant_name_en', r.merchant_name_en,
      'currency', r.currency,
      'tax_percent', r.tax_percent,
      'service_percent', r.service_percent,
      'rounding', r.rounding,
      'subtotal', r.subtotal,
      'total', r.total,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id,
          'name', i.name,
          'name_en', i.name_en,
          'qty', i.qty,
          'unit_price', i.unit_price,
          'person_ids', coalesce((
            select jsonb_agg(ip.person_id) from public.receipt_item_people ip where ip.item_id = i.id
          ), '[]'::jsonb),
          'counts', coalesce((
            select jsonb_object_agg(ip.person_id, ip.units) from public.receipt_item_people ip where ip.item_id = i.id
          ), '{}'::jsonb)
        ) order by i.position)
        from public.receipts_items i
        where i.receipt_id = r.id
      ), '[]'::jsonb),
      'people', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'name', case when p.is_me then coalesce(nullif(btrim(pr.display_name), ''), 'Host') else p.name end,
          'is_owner', p.is_me,
          'is_payer', p.is_payer,
          'paid', p.paid_at is not null,
          'claimed', p.guest_key is not null,
          'slip_sent', p.slip_at is not null
        ) order by p.is_me desc, p.created_at)
        from public.receipt_people p
        left join public.profiles pr on p.is_me and pr.user_id = r.user_id
        where p.receipt_id = r.id
      ), '[]'::jsonb),
      'pay_methods', case
        when exists (
          select 1 from public.receipt_people p
          where p.receipt_id = r.id and p.is_me and p.is_payer
        ) then coalesce((
          select jsonb_agg(jsonb_build_object(
            'kind', m.kind,
            'value', m.value,
            'bank', m.bank,
            'name', m.name
          ) order by m.position, m.created_at)
          from public.pay_methods m
          where m.user_id = r.user_id
        ), '[]'::jsonb)
        else '[]'::jsonb
      end
    )
    from public.receipts r
    where r.id = v_receipt_id
  );
end;
$$;
