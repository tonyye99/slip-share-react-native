ALTER TABLE public.receipts 
ADD COLUMN user_type VARCHAR(10) NOT NULL DEFAULT 'payer'
CONSTRAINT receipts_user_type_check CHECK (user_type IN ('payer', 'sharer'));

COMMENT ON COLUMN public.receipts.user_type IS 'Role of the user who created this receipt: payer (paid the bill) or sharer (calculating their portion)';

CREATE INDEX IF NOT EXISTS idx_receipts_user_type 
ON public.receipts(user_type);

UPDATE public.receipts 
SET user_type = 'payer' 
WHERE user_type IS NULL;