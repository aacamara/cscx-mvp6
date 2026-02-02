-- Add is_demo flag to customers table for design partner filtering
-- Design partners only see demo customers, admins see all

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_customers_is_demo ON public.customers(is_demo);

-- Rollback:
-- DROP INDEX IF EXISTS idx_customers_is_demo;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS is_demo;
