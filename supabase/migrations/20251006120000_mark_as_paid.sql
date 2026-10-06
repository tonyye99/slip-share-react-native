-- Mark as paid: the receipt owner records which friends have paid them back.
-- The amount is copied from the friend's saved selection when it is marked,
-- so the owner can tell if the friend changes their picks afterwards.
-- Friends already read their own receipt_participants row (participants_read),
-- so they see when their share was marked paid.

alter table public.receipt_participants
  add column if not exists paid_at     timestamptz,
  add column if not exists paid_amount numeric(10,2);

-- There is no update policy on receipt_participants, so this is the only way
-- to change paid_at: owners only, and only for people who have picked items.
create or replace function public.set_participant_paid(p_receipt_id uuid, p_user_id uuid, p_paid boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_amount numeric(10,2);
begin
  if not public.is_receipt_owner(p_receipt_id) then
    raise exception 'Only the receipt owner can mark payments' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.receipt_participants p
    where p.receipt_id = p_receipt_id and p.user_id = p_user_id
  ) then
    raise exception 'Not a participant on this receipt' using errcode = 'P0002';
  end if;

  if p_paid then
    select s.calculated_total into v_amount
    from public.user_selections s
    where s.receipt_id = p_receipt_id and s.user_id = p_user_id;

    if v_amount is null then
      raise exception 'They have not picked their items yet' using errcode = 'P0002';
    end if;
  end if;

  update public.receipt_participants p
  set paid_at     = case when p_paid then now() end,
      paid_amount = case when p_paid then v_amount end
  where p.receipt_id = p_receipt_id and p.user_id = p_user_id;
end;
$$;

revoke execute on function public.set_participant_paid(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_participant_paid(uuid, uuid, boolean) to authenticated;
