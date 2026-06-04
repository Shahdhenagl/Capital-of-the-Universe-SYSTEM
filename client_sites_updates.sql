ALTER TABLE public.client_sites 
ADD COLUMN IF NOT EXISTS commercial_record TEXT,
ADD COLUMN IF NOT EXISTS tax_number TEXT;
