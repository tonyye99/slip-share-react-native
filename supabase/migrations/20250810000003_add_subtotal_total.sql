ALTER TABLE public.receipts 
ADD COLUMN subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
ADD COLUMN total NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.receipts.subtotal IS 'Sum of all item prices before tax and service charges';
COMMENT ON COLUMN public.receipts.total IS 'Final total including tax, service, and rounding';

ALTER TABLE public.receipts 
ADD CONSTRAINT receipts_subtotal_positive CHECK (subtotal >= 0),
ADD CONSTRAINT receipts_total_positive CHECK (total >= 0);

CREATE INDEX IF NOT EXISTS idx_receipts_total 
ON public.receipts(total);