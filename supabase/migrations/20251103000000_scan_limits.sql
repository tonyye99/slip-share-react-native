-- Tighter scan limits before launch. Each scan is a paid OpenAI call, so on
-- top of a cap of 10 a day per user (was 30):
--   * 50 scans per user per calendar month (UTC),
--   * 1,000 scans a day across the whole app, so many throwaway accounts
--     can't run up the bill either,
--   * a scan that fails before OpenAI answers is handed back (refund).
-- parse-receipt calls claim_receipt_scan(); use_receipt_scan() stays for the
-- old parse-receipt until the new one is deployed, and applies the same caps.

-- The app-wide total sums today's rows, so look them up by day.
create index if not exists receipt_scan_usage_day_idx on public.receipt_scan_usage (day);

-- Counts one scan for the current user. Returns 'ok', or why it was refused:
-- 'daily', 'monthly' or 'busy' (the app-wide cap). Limits live here, not in
-- arguments, so a caller can't raise them.
create or replace function public.claim_receipt_scan()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  daily_limit   constant int := 10;
  monthly_limit constant int := 50;
  app_limit     constant int := 1000;
  v_user  uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_used  int;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- One scan at a time per user, so two at once can't both slip under a cap.
  perform pg_advisory_xact_lock(hashtextextended('receipt_scan:' || v_user::text, 0));

  select coalesce(sum(scans), 0) into v_used
  from public.receipt_scan_usage where day = v_today;
  if v_used >= app_limit then
    return 'busy';
  end if;

  select coalesce(sum(scans), 0) into v_used
  from public.receipt_scan_usage
  where user_id = v_user and day >= date_trunc('month', v_today)::date;
  if v_used >= monthly_limit then
    return 'monthly';
  end if;

  insert into public.receipt_scan_usage as u (user_id, day, scans)
  values (v_user, v_today, 1)
  on conflict (user_id, day) do update set scans = u.scans + 1
  where u.scans < daily_limit
  returning u.scans into v_used;

  return case when v_used is null then 'daily' else 'ok' end;
end;
$$;

revoke execute on function public.claim_receipt_scan() from public, anon;
grant execute on function public.claim_receipt_scan() to authenticated;

-- Kept for the parse-receipt that is live now; same caps, yes/no answer.
create or replace function public.use_receipt_scan()
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  return public.claim_receipt_scan() = 'ok';
end;
$$;

-- Hands back a scan that failed before OpenAI answered. Only parse-receipt
-- (service role) may call it: a user who could call it would reset their
-- own count.
create or replace function public.refund_receipt_scan(p_user uuid, p_day date)
returns void
language sql security definer set search_path = ''
as $$
  update public.receipt_scan_usage
  set scans = scans - 1
  where user_id = p_user and day = p_day and scans > 0;
$$;

revoke execute on function public.refund_receipt_scan(uuid, date) from public, anon, authenticated;
grant execute on function public.refund_receipt_scan(uuid, date) to service_role;
