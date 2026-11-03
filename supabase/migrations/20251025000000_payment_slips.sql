alter table public.receipt_people
  add column if not exists slip_path text,
  add column if not exists slip_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 2097152, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_slip_owner(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_receipt_owner(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;

revoke execute on function public.is_slip_owner(text) from public, anon;
grant execute on function public.is_slip_owner(text) to authenticated;

drop policy if exists "slips_owner_read" on storage.objects;
create policy "slips_owner_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'slips' and public.is_slip_owner(name));

drop policy if exists "slips_owner_delete" on storage.objects;
create policy "slips_owner_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'slips' and public.is_slip_owner(name));

create or replace function public.slip_files_for_user(p_user_id uuid)
returns table (name text)
language sql stable security definer set search_path = ''
as $$
  select o.name
  from storage.objects o
  join public.receipts r on r.id::text = split_part(o.name, '/', 1)
  where o.bucket_id = 'slips' and r.user_id = p_user_id
$$;

revoke execute on function public.slip_files_for_user(uuid) from public, anon, authenticated;
grant execute on function public.slip_files_for_user(uuid) to service_role;

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
      ), '[]'::jsonb)
    )
    from public.receipts r
    where r.id = v_receipt_id
  );
end;
$$;
