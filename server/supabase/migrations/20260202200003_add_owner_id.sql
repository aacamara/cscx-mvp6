-- Add owner_id column to customers table for design partner data isolation
-- Design partners can only see: is_demo = true OR owner_id = their_user_id

-- Add owner_id column (nullable UUID referencing auth.users)
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Add index for efficient filtering by owner
CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON public.customers(owner_id);

-- Existing customers keep owner_id = NULL (visible to admins, demos visible to all)
-- No data migration needed - NULL is the correct default

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name = 'owner_id';
