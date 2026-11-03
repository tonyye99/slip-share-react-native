alter table public.user_selections 
add column if not exists item_shares jsonb not null default '{}';

comment on column public.user_selections.item_shares is 'JSON object mapping item_id to share_count (number of people sharing the item, defaults to 1)';

