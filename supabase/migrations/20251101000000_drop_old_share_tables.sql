-- Drops what's left of the old sharing, which the app stopped using when
-- friend links and receipt_people came in (20251010000000_payer_picks):
-- - user_selections: each user's ticked items, from the first web app.
-- - receipt_participants: people who joined a receipt by the old share link.
-- Their rows are deleted with them.

drop function if exists public.can_access_receipt(uuid);
drop function if exists public.is_receipt_participant(uuid);

drop table if exists public.user_selections;
drop table if exists public.receipt_participants;
