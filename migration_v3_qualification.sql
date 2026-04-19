-- Migration V3: Add qualification_level to suppliers
-- This migration adds the qualification_level column to the suppliers table
-- and sets a default value for existing records.

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS qualification_level TEXT DEFAULT 'identified';

-- Update existing records to 'exploitable' if they have both phone and email, 
-- otherwise 'qualified' if they have a website, else 'identified'.
UPDATE public.suppliers
SET qualification_level = CASE
    WHEN (contact_phone IS NOT NULL AND contact_phone != 'Non identifié' AND contact_phone != 'Non Vérifié') 
         AND (contact_email IS NOT NULL AND contact_email != 'Non identifié' AND contact_email != 'Non Vérifié')
    THEN 'exploitable'
    WHEN website IS NOT NULL AND website != 'N/A' AND website != 'Non Vérifié'
    THEN 'qualified'
    ELSE 'identified'
END
WHERE qualification_level = 'identified';

-- Add a constraint to ensure only valid values are used
-- Note: In a production Supabase environment, you might prefer a check constraint or an ENUM.
-- Here we use a CHECK constraint for simplicity and flexibility.
ALTER TABLE public.suppliers
ADD CONSTRAINT check_qualification_level 
CHECK (qualification_level IN ('identified', 'qualified', 'exploitable', 'rejected'));
