-- Add AI extraction metadata columns to orders table (2026-03-24)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS extraction_model TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS extraction_version INT NULL;
