-- VAPI Calls Table
CREATE TABLE IF NOT EXISTS calls (
  id VARCHAR(255) PRIMARY KEY,
  call_id VARCHAR(255) NOT NULL UNIQUE,
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
  order_id VARCHAR(255) NOT NULL UNIQUE,
  call_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  business_type VARCHAR(50) CHECK (business_type IN ('restaurant', 'car', 'router', 'other')),
  customer_id VARCHAR(255),
  items JSONB,
  total_amount DECIMAL(10, 2),
  currency VARCHAR(10),
  metadata JSONB,
  raw_event JSONB,
  CONSTRAINT valid_business_type CHECK (business_type IN ('restaurant', 'car', 'router', 'other') OR business_type IS NULL)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_call_id ON calls(call_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_business_type ON calls(business_type);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_call_id ON orders(call_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_business_type ON orders(business_type);

