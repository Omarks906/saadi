const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getLatestChecksum(pool) {
  const result = await pool.query(
    "SELECT checksum FROM schema_migrations ORDER BY id DESC LIMIT 1"
  );
  return result.rows[0]?.checksum ?? null;
}

async function recordChecksum(pool, checksum) {
  await pool.query("INSERT INTO schema_migrations (checksum) VALUES ($1)", [
    checksum,
  ]);
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    const schemaPath = path.join(process.cwd(), "src/lib/db/schema.sql");
    const schemaSQL = await fs.readFile(schemaPath, "utf-8");
    const checksum = crypto.createHash("sha256").update(schemaSQL).digest("hex");

    await ensureMigrationsTable(pool);
    const latestChecksum = await getLatestChecksum(pool);

    if (latestChecksum === checksum) {
      console.log("Schema unchanged, skipping apply");
      return;
    }

    await pool.query(schemaSQL);
    await recordChecksum(pool, checksum);
    console.log("Schema applied successfully");
  } catch (error) {
    console.error("Schema apply failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
