-- Widen orders.status CHECK to include all kitchen statuses + pending_review (2026-03-24)
-- The original schema only had confirmed/cancelled/completed; this adds the full set.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'));
