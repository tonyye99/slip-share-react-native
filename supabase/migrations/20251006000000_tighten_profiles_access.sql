create or replace function public.shares_receipt_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.receipts r
    join public.receipt_participants p on p.receipt_id = r.id
    where (r.user_id = auth.uid() and p.user_id = p_user_id)
       or (r.user_id = p_user_id and p.user_id = auth.uid())
  )
$$;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read"
on public.profiles
for select
to authenticated
using (user_id = auth.uid() or public.shares_receipt_with(user_id));

alter function public.handle_new_user() set search_path = '';
