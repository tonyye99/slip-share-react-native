create table if not exists public.receipt_people (
  id          uuid primary key default gen_random_uuid(),
  receipt_id  uuid not null references public.receipts(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  is_me       boolean not null default false,
  is_payer    boolean not null default false,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_receipt_people_receipt
  on public.receipt_people(receipt_id, created_at);

create unique index if not exists idx_receipt_people_one_me
  on public.receipt_people(receipt_id) where is_me;

create unique index if not exists idx_receipt_people_one_payer
  on public.receipt_people(receipt_id) where is_payer;

alter table public.receipt_people enable row level security;

drop policy if exists "receipt_people_owner_read" on public.receipt_people;
create policy "receipt_people_owner_read"
on public.receipt_people
for select
to authenticated
using (public.is_receipt_owner(receipt_id));

drop policy if exists "receipt_people_owner_insert" on public.receipt_people;
create policy "receipt_people_owner_insert"
on public.receipt_people
for insert
to authenticated
with check (public.is_receipt_owner(receipt_id));

drop policy if exists "receipt_people_owner_update" on public.receipt_people;
create policy "receipt_people_owner_update"
on public.receipt_people
for update
to authenticated
using (public.is_receipt_owner(receipt_id))
with check (public.is_receipt_owner(receipt_id));

drop policy if exists "receipt_people_owner_delete" on public.receipt_people;
create policy "receipt_people_owner_delete"
on public.receipt_people
for delete
to authenticated
using (public.is_receipt_owner(receipt_id) and not is_me);

revoke insert, update on public.receipt_people from anon, authenticated;
grant insert (receipt_id, name) on public.receipt_people to authenticated;
grant update (name, is_payer, paid_at) on public.receipt_people to authenticated;

create table if not exists public.receipt_item_people (
  item_id    uuid not null references public.receipts_items(id) on delete cascade,
  person_id  uuid not null references public.receipt_people(id) on delete cascade,
  primary key (item_id, person_id)
);

create index if not exists idx_receipt_item_people_person
  on public.receipt_item_people(person_id);

alter table public.receipt_item_people enable row level security;

drop policy if exists "receipt_item_people_owner_all" on public.receipt_item_people;
create policy "receipt_item_people_owner_all"
on public.receipt_item_people
for all
to authenticated
using (
  exists (
    select 1 from public.receipt_people p
    where p.id = person_id and public.is_receipt_owner(p.receipt_id)
  )
)
with check (
  exists (
    select 1
    from public.receipt_people p
    join public.receipts_items i on i.receipt_id = p.receipt_id
    where p.id = person_id and i.id = item_id and public.is_receipt_owner(p.receipt_id)
  )
);

create or replace function public.add_receipt_owner_person()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.receipt_people (receipt_id, name, is_me, is_payer)
  values (new.id, 'Me', true, new.user_type = 'payer');
  return new;
end;
$$;

revoke execute on function public.add_receipt_owner_person() from public, anon, authenticated;

drop trigger if exists receipts_add_owner_person on public.receipts;
create trigger receipts_add_owner_person
after insert on public.receipts
for each row execute function public.add_receipt_owner_person();

insert into public.receipt_people (receipt_id, name, is_me, is_payer)
select r.id, 'Me', true, r.user_type = 'payer'
from public.receipts r
where not exists (
  select 1 from public.receipt_people p where p.receipt_id = r.id and p.is_me
);

create or replace function public.set_receipt_payer(p_receipt_id uuid, p_person_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.receipt_people p
    where p.id = p_person_id and p.receipt_id = p_receipt_id
  ) then
    raise exception 'Not a person on this receipt' using errcode = 'P0002';
  end if;

  update public.receipt_people p
  set is_payer = false
  where p.receipt_id = p_receipt_id and p.is_payer and p.id <> p_person_id;

  update public.receipt_people p
  set is_payer = true, paid_at = null
  where p.id = p_person_id;

  update public.receipts r
  set user_type = case
    when exists (select 1 from public.receipt_people p where p.id = p_person_id and p.is_me) then 'payer'
    else 'sharer'
  end
  where r.id = p_receipt_id;
end;
$$;

revoke execute on function public.set_receipt_payer(uuid, uuid) from public, anon;
grant execute on function public.set_receipt_payer(uuid, uuid) to authenticated;

drop function if exists public.join_receipt(uuid);
drop function if exists public.set_participant_paid(uuid, uuid, boolean);
drop policy if exists "receipts_participant_read" on public.receipts;
drop policy if exists "items_participant_read" on public.receipts_items;

drop policy if exists "user_selections_owner_all" on public.user_selections;
create policy "user_selections_owner_all"
on public.user_selections
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.is_receipt_owner(receipt_id));

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop function if exists public.shares_receipt_with(uuid);
