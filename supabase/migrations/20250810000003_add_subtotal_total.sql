-- Add subtotal and total fields to receipts table for bill calculations

ALTER TABLE public.receipts 
ADD COLUMN subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
ADD COLUMN total NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Add comments to explain the fields
COMMENT ON COLUMN public.receipts.subtotal IS 'Sum of all item prices before tax and service charges';
COMMENT ON COLUMN public.receipts.total IS 'Final total including tax, service, and rounding';

-- Add constraints to ensure non-negative values
ALTER TABLE public.receipts 
ADD CONSTRAINT receipts_subtotal_positive CHECK (subtotal >= 0),
ADD CONSTRAINT receipts_total_positive CHECK (total >= 0);

-- Create index for efficient querying by total amounts (useful for reporting)
CREATE INDEX IF NOT EXISTS idx_receipts_total 
ON public.receipts(total);