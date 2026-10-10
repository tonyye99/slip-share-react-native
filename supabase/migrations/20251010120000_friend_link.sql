-- Friend link: on top of the payer picking for everyone, the receipt owner can
-- send a link to the website where friends type their name and tick their own
-- items, with no app and no sign-up.
--
-- The link is https://<site>/pick/<receipts.share_token>. It only works while
-- receipts.link_enabled is on, and turning it back on gives the receipt a new
-- token, so turning it off stops every link sent before. People who open it
-- aren't signed in, so they go through the SECURITY DEFINER functions below,
-- which check the token on every call. The tables keep their owner-only RLS.

alter table public.receipts
  add column if not exists link_enabled boolean not null default false;

-- Set when someone picks this line through the link. Their browser keeps it,
-- and only that browser can change this person's items. The owner can still
-- change everything in the app.
alter table public.receipt_people
  add column if not exists guest_key uuid;

-- ============ owner: turn the link on or off ============

-- Returns the receipt's token. SECURITY INVOKER, so receipts_owner_all decides
-- who can call it.
create or replace function public.set_receipt_link(p_receipt_id uuid, p_enabled boolean)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_token uuid;
begin
  update public.receipts r
  set share_token  = case when p_enabled and not r.link_enabled then gen_random_uuid() else r.share_token end,
      link_enabled = p_enabled
  where r.id = p_receipt_id
  returning r.share_token into v_token;

  if v_token is null then
    raise exception 'Receipt not found' using errcode = 'P0002';
  end if;
  return v_token;
end;
$$;

revoke execute on function public.set_receipt_link(uuid, boolean) from public, anon;
grant execute on function public.set_receipt_link(uuid, boolean) to authenticated;

-- ============ link guests ============

-- The receipt behind a link that is on, or an error.
create or replace function public.link_receipt_id(p_token uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_receipt_id uuid;
begin
  select r.id into v_receipt_id
  from public.receipts r
  where r.share_token = p_token and r.link_enabled;

  if v_receipt_id is null then
    raise exception 'This link is turned off or does not exist' using errcode = 'P0002';
  end if;
  return v_receipt_id;
end;
$$;

revoke execute on function public.link_receipt_id(uuid) from public, anon, authenticated;

-- What a link shows: the receipt, its items, who had each item, and the
-- people on it. The owner's own line shows their display name. Guest keys
-- never leave the database here; `claimed` only says whether someone has
-- picked that line.
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
          ), '[]'::jsonb)
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

-- Joins a link as a line the owner already added (p_person_id) or as a new
-- person (p_name). Returns the person's id and the key their browser keeps.
create or replace function public.join_link(p_token uuid, p_person_id uuid, p_name text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_receipt_id uuid := public.link_receipt_id(p_token);
  v_name       text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_key        uuid := gen_random_uuid();
  v_person_id  uuid;
begin
  if p_person_id is not null then
    update public.receipt_people p
    set guest_key = v_key
    where p.id = p_person_id and p.receipt_id = v_receipt_id and not p.is_me and p.guest_key is null
    returning p.id into v_person_id;

    if v_person_id is null then
      raise exception 'Someone else already picked that name' using errcode = 'P0002';
    end if;
  else
    if exists (
      select 1 from public.receipt_people p
      where p.receipt_id = v_receipt_id and lower(p.name) = lower(v_name)
    ) then
      raise exception 'That name is already on this bill' using errcode = '23505';
    end if;

    if (select count(*) from public.receipt_people p where p.receipt_id = v_receipt_id) >= 30 then
      raise exception 'This bill already has 30 people' using errcode = '54000';
    end if;

    -- The name check on receipt_people rejects blank and over-long names.
    insert into public.receipt_people (receipt_id, name, guest_key)
    values (v_receipt_id, v_name, v_key)
    returning id into v_person_id;
  end if;

  return jsonb_build_object('person_id', v_person_id, 'guest_key', v_key);
end;
$$;

-- Ticks (or unticks) one item for the person who joined with p_guest_key.
create or replace function public.set_link_pick(
  p_token uuid, p_person_id uuid, p_guest_key uuid, p_item_id uuid, p_had boolean
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_receipt_id uuid := public.link_receipt_id(p_token);
begin
  if p_guest_key is null or not exists (
    select 1 from public.receipt_people p
    where p.id = p_person_id and p.receipt_id = v_receipt_id and p.guest_key = p_guest_key
  ) then
    raise exception 'Pick your name again' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.receipts_items i where i.id = p_item_id and i.receipt_id = v_receipt_id
  ) then
    raise exception 'Item not on this bill' using errcode = 'P0002';
  end if;

  if p_had then
    insert into public.receipt_item_people (item_id, person_id)
    values (p_item_id, p_person_id)
    on conflict do nothing;
  else
    delete from public.receipt_item_people ip
    where ip.item_id = p_item_id and ip.person_id = p_person_id;
  end if;
end;
$$;

revoke execute on function public.get_link_receipt(uuid) from public;
revoke execute on function public.join_link(uuid, uuid, text) from public;
revoke execute on function public.set_link_pick(uuid, uuid, uuid, uuid, boolean) from public;
grant execute on function public.get_link_receipt(uuid) to anon, authenticated;
grant execute on function public.join_link(uuid, uuid, text) to anon, authenticated;
grant execute on function public.set_link_pick(uuid, uuid, uuid, uuid, boolean) to anon, authenticated;
