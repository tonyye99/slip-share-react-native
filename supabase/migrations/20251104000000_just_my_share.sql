alter table public.receipts
  add column if not exists split_mode text check (split_mode in ('mine', 'everyone')),
  add column if not exists share_discount boolean not null default true;

alter table public.receipt_item_people
  add column if not exists split_between smallint not null default 1 check (split_between between 1 and 99);
