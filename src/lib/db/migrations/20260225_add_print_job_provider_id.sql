ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS provider_job_id TEXT;
