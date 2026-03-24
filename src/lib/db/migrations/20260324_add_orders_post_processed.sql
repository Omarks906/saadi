-- Add post_processed flag to orders table (2026-03-24)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS post_processed BOOLEAN NOT NULL DEFAULT false;
