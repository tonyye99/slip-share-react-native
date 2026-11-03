alter table public.pay_methods drop constraint if exists pay_methods_value_check;
alter table public.pay_methods
  add constraint pay_methods_value_check check (char_length(btrim(value)) between 1 and 512);

alter table public.pay_methods drop constraint pay_methods_promptpay;
alter table public.pay_methods
  add constraint pay_methods_promptpay check (
    kind <> 'promptpay'
    or value ~ '^(0[0-9]{9}|[0-9]{13}|[0-9]{15})$'
    or value ~ '^000201[^[:cntrl:]]+$'
  );

alter table public.pay_methods
  add constraint pay_methods_short_value check (kind = 'promptpay' or char_length(value) <= 300);
