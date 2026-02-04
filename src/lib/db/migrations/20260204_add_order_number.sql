-- Migration: Add order_number column to orders table
-- This provides a sequential, human-friendly order number per organization

-- Add the column (allowing NULL initially for existing rows)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- Populate existing orders with sequential numbers per organization based on creation order
WITH numbered_orders AS (
  SELECT id, organization_id,
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at ASC) as rn
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders
SET order_number = numbered_orders.rn
FROM numbered_orders
WHERE orders.id = numbered_orders.id;

-- Set NOT NULL constraint (only if there are no NULL values)
DO $$
BEGIN
  -- Ensure any remaining NULL values get a default
  UPDATE orders SET order_number = 1 WHERE order_number IS NULL;

  -- Add NOT NULL constraint if not already present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders'
    AND column_name = 'order_number'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
  END IF;
END
$$;

-- Create index for efficient lookups by organization and order_number
CREATE INDEX IF NOT EXISTS idx_orders_org_order_number ON orders(organization_id, order_number);
