-- Add translation fields to receipts and receipts_items tables

-- Add translation fields to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS original_language char(2),
ADD COLUMN IF NOT EXISTS merchant_name_en text;

-- Add translation field to receipts_items table
ALTER TABLE public.receipts_items 
ADD COLUMN IF NOT EXISTS name_en text;

-- Add indexes for better query performance on language field
CREATE INDEX IF NOT EXISTS idx_receipts_original_language 
ON public.receipts(original_language);

-- Add comments for documentation
COMMENT ON COLUMN public.receipts.original_language IS 'ISO 639-1 language code of the original receipt text (e.g., th, en, ja, ko)';
COMMENT ON COLUMN public.receipts.merchant_name_en IS 'English translation of the merchant name';
COMMENT ON COLUMN public.receipts_items.name_en IS 'English translation of the item name';