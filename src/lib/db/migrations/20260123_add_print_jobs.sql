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

CREATE INDEX IF NOT EXISTS idx_print_jobs_org_created_at
  ON print_jobs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created_at
  ON print_jobs (status, created_at DESC);
