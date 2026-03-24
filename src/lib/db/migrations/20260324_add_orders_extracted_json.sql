-- Add AI extraction result columns to orders table (2026-03-24)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS extracted_json JSONB NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS overall_confidence INT NULL;
