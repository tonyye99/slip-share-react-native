-- Two guards found in the pre-launch check.
--
-- 1. A friend joining through the link can't call themselves "Me" or "You".
--    The owner's own line shows as "You" in the app, so a guest with that
--    name would look like the owner.
-- 2. How many of a line someone had (receipt_item_people.units) is now kept
--    between 1 and the line's quantity for every write, not only for friend
--    link picks. Lines that can't be counted always have 1. The app already
--    stays inside these limits, so nothing anyone sees changes.

-- ============ 1. reserved names on the friend link ============

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
    if lower(v_name) in ('me', 'you') then
      raise exception 'Pick a different name' using errcode = 'P0002';
    end if;

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


-- ============ 2. keep counts inside the line ============

create or replace function public.clamp_item_units()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_qty numeric;
begin
  select i.qty into v_qty from public.receipts_items i where i.id = new.item_id;
  new.units := case
    when v_qty >= 2 and v_qty = trunc(v_qty) then least(greatest(coalesce(new.units, 1), 1), v_qty::integer)
    else 1
  end;
  return new;
end;
$$;

revoke execute on function public.clamp_item_units() from public, anon, authenticated;

drop trigger if exists receipt_item_people_clamp_units on public.receipt_item_people;
create trigger receipt_item_people_clamp_units
before insert or update of units on public.receipt_item_people
for each row execute function public.clamp_item_units();
