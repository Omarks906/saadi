CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- VAPI Calls Table
CREATE TABLE IF NOT EXISTS calls (
  id VARCHAR(255) PRIMARY KEY,
  call_id VARCHAR(255) NOT NULL UNIQUE,
  tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'ended', 'failed')),
  business_type VARCHAR(50) CHECK (business_type IN ('restaurant', 'car', 'router', 'other')),
  scores JSONB,
  detected_from VARCHAR(255),
  confidence DECIMAL(5, 4),
  phone_number VARCHAR(50),
  customer_id VARCHAR(255),
  metadata JSONB,
  raw_event JSONB,
  CONSTRAINT valid_business_type CHECK (business_type IN ('restaurant', 'car', 'router', 'other') OR business_type IS NULL)
);

-- VAPI Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  call_id VARCHAR(255),
  tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  business_type VARCHAR(50) CHECK (business_type IN ('restaurant', 'car', 'router', 'other')),
  customer_id VARCHAR(255),
  fulfillment_type TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  special_instructions TEXT,
  allergies TEXT,
  items JSONB,
  total_amount DECIMAL(10, 2),
  currency VARCHAR(10),
  metadata JSONB,
  raw_event JSONB,
  CONSTRAINT valid_business_type CHECK (business_type IN ('restaurant', 'car', 'router', 'other') OR business_type IS NULL)
);

-- Organizations Table
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

ALTER TABLE organizations
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

INSERT INTO organizations (slug, name)
VALUES ('chilli', 'Restaurang & Pizzeria Chilli')
ON CONFLICT (slug) DO NOTHING;

-- Print Jobs Table
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  call_id VARCHAR(255),
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','retrying')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  printer_target TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT print_jobs_org_order_unique UNIQUE (organization_id, order_id)
);

-- Ensure tenant_id exists on existing tables
ALTER TABLE calls ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);
UPDATE calls SET tenant_id = COALESCE(tenant_id, 'default');
UPDATE orders SET tenant_id = COALESCE(tenant_id, 'default');
ALTER TABLE calls ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE calls SET organization_id = COALESCE(
  organization_id,
  (SELECT id FROM organizations WHERE slug = 'chilli' LIMIT 1)
);
UPDATE orders SET organization_id = COALESCE(
  organization_id,
  (SELECT id FROM organizations WHERE slug = 'chilli' LIMIT 1)
);
ALTER TABLE calls ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_id_key;
ALTER TABLE orders
  ADD CONSTRAINT orders_org_order_unique UNIQUE (organization_id, order_id);
ALTER TABLE print_jobs
  ADD CONSTRAINT print_jobs_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE calls
  ADD CONSTRAINT calls_organization_fk
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_call_id ON calls(call_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_business_type ON calls(business_type);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_created_at ON calls(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_created_at ON calls(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_call_id ON orders(call_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_business_type ON orders(business_type);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created_at ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_org_status_created_at ON orders(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_org_order_id ON orders(organization_id, order_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_org_created_at ON print_jobs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created_at ON print_jobs(status, created_at DESC);

