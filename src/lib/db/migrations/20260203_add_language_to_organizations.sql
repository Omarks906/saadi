-- Add language column to organizations table
-- Supports ISO 639-1 language codes (e.g., 'sv' for Swedish, 'en' for English)

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'sv';

-- Update Chilli to Swedish (already default, but explicit)
UPDATE organizations SET language = 'sv' WHERE slug = 'chilli';

-- Add index for language filtering if needed
CREATE INDEX IF NOT EXISTS idx_organizations_language ON organizations(language);
