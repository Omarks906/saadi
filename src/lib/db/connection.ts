import { Pool, PoolClient } from "pg";

let pool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is not set. " +
        "Please set it in Railway (it should be automatically available from your PostgreSQL service)."
      );
    }

    pool = new Pool({
      connectionString,
      // Railway PostgreSQL connection settings
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("[DB] Unexpected error on idle client:", err);
    });
  }

  return pool;
}

/**
 * Initialize the database (create tables if they don't exist)
 */
export async function initDatabase(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Read and execute schema SQL
    const fs = await import("fs/promises");
    const path = await import("path");
    const schemaPath = path.join(process.cwd(), "src/lib/db/schema.sql");
    const schemaSQL = await fs.readFile(schemaPath, "utf-8");

    await client.query(schemaSQL);
    console.log("[DB] Database schema initialized successfully");
  } catch (error: any) {
    // If schema file doesn't exist, create tables directly
    if (error.code === "ENOENT") {
      console.log("[DB] Schema file not found, creating tables directly...");
      await createTablesDirectly(client);
    } else {
      console.error("[DB] Error initializing database:", error);
      throw error;
    }
  } finally {
    client.release();
  }
}

/**
 * Create tables directly (fallback if schema.sql is not available)
 */
async function createTablesDirectly(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS calls (
      id VARCHAR(255) PRIMARY KEY,
      call_id VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      ended_at TIMESTAMP WITH TIME ZONE,
      duration_seconds INTEGER,
      status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'ended', 'failed')),
      business_type VARCHAR(50) CHECK (business_type IN ('restaurant', 'car', 'router', 'other')),
      scores JSONB,
      detected_from VARCHAR(255),
      confidence DECIMAL(5, 4),
      phone_number VARCHAR(50),
      customer_id VARCHAR(255),
      metadata JSONB,
      raw_event JSONB
    );

    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL UNIQUE,
      call_id VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL,
      status VARCHAR(50) NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'completed')),
      business_type VARCHAR(50) CHECK (business_type IN ('restaurant', 'car', 'router', 'other')),
      customer_id VARCHAR(255),
      items JSONB,
      total_amount DECIMAL(10, 2),
      currency VARCHAR(10),
      metadata JSONB,
      raw_event JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_calls_call_id ON calls(call_id);
    CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_calls_business_type ON calls(business_type);
    CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_call_id ON orders(call_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_business_type ON orders(business_type);
  `);
  
  console.log("[DB] Tables created successfully");
}

/**
 * Close the database connection pool (useful for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

