CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO organizations (slug, name)
VALUES ('chilli', 'Restaurang & Pizzeria Chilli')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS allergies TEXT;

UPDATE orders
SET organization_id = COALESCE(
  organization_id,
  (SELECT id FROM organizations WHERE slug = 'chilli' LIMIT 1)
)
WHERE organization_id IS NULL;

ALTER TABLE orders ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_id_key;
ALTER TABLE orders
  ADD CONSTRAINT orders_org_order_unique UNIQUE (organization_id, order_id);

CREATE INDEX IF NOT EXISTS idx_orders_org_status_created_at
  ON orders (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_org_order_id
  ON orders (organization_id, order_id);

ALTER TABLE print_jobs
  ADD CONSTRAINT print_jobs_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE calls ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE calls
SET organization_id = COALESCE(
  organization_id,
  (SELECT id FROM organizations WHERE slug = 'chilli' LIMIT 1)
)
WHERE organization_id IS NULL;
ALTER TABLE calls ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE calls
  ADD CONSTRAINT calls_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_calls_org_created_at
  ON calls (organization_id, created_at DESC);
