-- PromptPay can also be the QR saved from your banking app (My QR / Receive
-- money), kept as the text inside it. The app adds each friend's amount when
-- it shows the QR, so the saved text is the bank's QR without an amount.

alter table public.pay_methods drop constraint if exists pay_methods_value_check;
alter table public.pay_methods
  add constraint pay_methods_value_check check (char_length(btrim(value)) between 1 and 512);

alter table public.pay_methods drop constraint pay_methods_promptpay;
alter table public.pay_methods
  add constraint pay_methods_promptpay check (
    kind <> 'promptpay'
    -- A phone number, 13-digit ID or 15-digit e-wallet ID.
    or value ~ '^(0[0-9]{9}|[0-9]{13}|[0-9]{15})$'
    -- A bank's QR: EMVCo text, which starts 000201.
    or value ~ '^000201[^[:cntrl:]]+$'
  );

-- Notes and bank accounts keep their old limit.
alter table public.pay_methods
  add constraint pay_methods_short_value check (kind = 'promptpay' or char_length(value) <= 300);
