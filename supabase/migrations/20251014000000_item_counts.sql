alter table public.receipt_item_people
  add column if not exists units integer not null default 1 check (units >= 1);

update public.receipt_item_people ip
set units = ceil(i.qty / n.people)::integer
from public.receipts_items i
join (
  select item_id, count(*) as people from public.receipt_item_people group by item_id
) n on n.item_id = i.id
where i.id = ip.item_id and i.qty >= 2 and i.qty = trunc(i.qty);

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
          'claimed', p.guest_key is not null
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

drop function if exists public.set_link_pick(uuid, uuid, uuid, uuid, boolean);
create or replace function public.set_link_pick(
  p_token uuid, p_person_id uuid, p_guest_key uuid, p_item_id uuid, p_had boolean, p_units integer default 1
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_receipt_id uuid := public.link_receipt_id(p_token);
  v_qty        numeric;
  v_units      integer;
begin
  if p_guest_key is null or not exists (
    select 1 from public.receipt_people p
    where p.id = p_person_id and p.receipt_id = v_receipt_id and p.guest_key = p_guest_key
  ) then
    raise exception 'Pick your name again' using errcode = '42501';
  end if;

  select i.qty into v_qty
  from public.receipts_items i
  where i.id = p_item_id and i.receipt_id = v_receipt_id;
  if v_qty is null then
    raise exception 'Item not on this bill' using errcode = 'P0002';
  end if;

  v_units := case
    when v_qty >= 2 and v_qty = trunc(v_qty) then least(greatest(coalesce(p_units, 1), 1), v_qty::integer)
    else 1
  end;

  if p_had then
    insert into public.receipt_item_people (item_id, person_id, units)
    values (p_item_id, p_person_id, v_units)
    on conflict (item_id, person_id) do update set units = excluded.units;
  else
    delete from public.receipt_item_people ip
    where ip.item_id = p_item_id and ip.person_id = p_person_id;
  end if;
end;
$$;

revoke execute on function public.set_link_pick(uuid, uuid, uuid, uuid, boolean, integer) from public;
grant execute on function public.set_link_pick(uuid, uuid, uuid, uuid, boolean, integer) to anon, authenticated;
