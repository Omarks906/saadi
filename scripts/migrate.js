const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");

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
    await pool.query(schemaSQL);
    console.log("Schema applied successfully");
  } catch (error) {
    console.error("Schema apply failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
