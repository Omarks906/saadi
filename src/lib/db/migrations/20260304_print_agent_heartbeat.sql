-- Add print agent heartbeat tracking to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS print_agent_last_seen_at TIMESTAMP WITH TIME ZONE;
