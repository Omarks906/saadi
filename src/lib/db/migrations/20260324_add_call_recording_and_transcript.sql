-- Add recording URLs and transcript to calls table (2026-03-24)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS stereo_recording_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS customer_recording_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assistant_recording_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript TEXT;
