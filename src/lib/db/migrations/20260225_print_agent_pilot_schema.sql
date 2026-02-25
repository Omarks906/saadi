CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  content TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

ALTER TABLE print_jobs
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN order_id TYPE TEXT,
  ALTER COLUMN status SET DEFAULT 'queued';

ALTER TABLE print_jobs
  DROP CONSTRAINT IF EXISTS print_jobs_org_order_unique;

ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS content TEXT;

UPDATE print_jobs
SET content = COALESCE(content, '')
WHERE content IS NULL;

ALTER TABLE print_jobs
  ALTER COLUMN content SET NOT NULL;

ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_print_jobs_org_status_created_at
  ON print_jobs (organization_id, status, created_at);
