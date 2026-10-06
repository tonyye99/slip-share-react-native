-- Add user_type field to receipts table to distinguish between payers and sharers

ALTER TABLE public.receipts 
ADD COLUMN user_type VARCHAR(10) NOT NULL DEFAULT 'payer'
CONSTRAINT receipts_user_type_check CHECK (user_type IN ('payer', 'sharer'));

-- Add comment to explain the field
COMMENT ON COLUMN public.receipts.user_type IS 'Role of the user who created this receipt: payer (paid the bill) or sharer (calculating their portion)';

-- Create index for efficient querying by user_type
CREATE INDEX IF NOT EXISTS idx_receipts_user_type 
ON public.receipts(user_type);

-- Update existing receipts to default to 'payer' (they were created under the old assumption)
-- This backfills existing data with the previous behavior
UPDATE public.receipts 
SET user_type = 'payer' 
WHERE user_type IS NULL;