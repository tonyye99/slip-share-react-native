-- Add share counts to user_selections table
-- This will store how many people each selected item is shared with

alter table public.user_selections 
add column if not exists item_shares jsonb not null default '{}';

-- Update comment to explain the new field
comment on column public.user_selections.item_shares is 'JSON object mapping item_id to share_count (number of people sharing the item, defaults to 1)';

-- Example of item_shares data structure:
-- {
--   "item-uuid-1": 2,  -- this item is shared between 2 people
--   "item-uuid-2": 3,  -- this item is shared between 3 people
--   "item-uuid-3": 1   -- this item is not shared (only this user)
-- }