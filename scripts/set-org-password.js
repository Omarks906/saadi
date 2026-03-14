#!/usr/bin/env node
/**
 * One-time script to set (or reset) a dashboard password for an org.
 *
 * Usage:
 *   ORG_SLUG=canada-usa ORG_PASSWORD=<password> DATABASE_URL=<url> node scripts/set-org-password.js
 *
 * Never hardcode the password here — pass it via env vars only.
 */

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

async function main() {
  const orgSlug = process.env.ORG_SLUG;
  const password = process.env.ORG_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  if (!orgSlug || !password || !databaseUrl) {
    console.error("Missing required env vars: ORG_SLUG, ORG_PASSWORD, DATABASE_URL");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "UPDATE organizations SET password_hash = $1, updated_at = NOW() WHERE slug = $2 RETURNING id, slug",
      [hash, orgSlug]
    );

    if (result.rowCount === 0) {
      console.error(`No organization found with slug "${orgSlug}". Has the schema migration run?`);
      process.exit(1);
    }

    console.log(`Password set for org slug="${orgSlug}" id=${result.rows[0].id}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
