-- Daily cap on receipt scans per user. Each scan calls OpenAI, and sign-up is
-- open, so without a cap one account could run up the bill. The
-- parse-receipt Edge Function calls use_receipt_scan() before calling OpenAI.

create table if not exists public.receipt_scan_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default (now() at time zone 'utc')::date,
  scans    int  not null default 0,
  primary key (user_id, day)
);

-- RLS on with no policies: only use_receipt_scan() touches this table.
alter table public.receipt_scan_usage enable row level security;

-- Counts one scan for the current user and returns whether it is within
-- today's limit (UTC days). The limit lives here, not in an argument, so a
-- caller can't raise it.
create or replace function public.use_receipt_scan()
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  daily_limit constant int := 30;
  v_scans int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.receipt_scan_usage as u (user_id, day, scans)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set scans = u.scans + 1
  where u.scans < daily_limit
  returning u.scans into v_scans;

  return v_scans is not null;
end;
$$;

revoke execute on function public.use_receipt_scan() from public, anon;
grant execute on function public.use_receipt_scan() to authenticated;
