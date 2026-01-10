import { NextRequest, NextResponse } from "next/server";
import { getPool, initDatabase } from "@/lib/db/connection";

export const runtime = "nodejs";

/**
 * GET /api/debug/db
 * Test database connection and return diagnostic information
 */
export async function GET(req: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    database_url_set: !!process.env.DATABASE_URL,
    database_url_preview: process.env.DATABASE_URL 
      ? `${process.env.DATABASE_URL.substring(0, 20)}...` 
      : "NOT SET",
    node_env: process.env.NODE_ENV,
    tests: {},
  };

  // Test 1: Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    diagnostics.tests.connection = {
      success: false,
      error: "DATABASE_URL environment variable is not set",
      hint: "Make sure your PostgreSQL service is connected to your Next.js service in Railway",
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // Test 2: Try to get pool
  try {
    const pool = getPool();
    diagnostics.tests.pool_creation = { success: true };
  } catch (error: any) {
    diagnostics.tests.pool_creation = {
      success: false,
      error: error?.message || String(error),
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // Test 3: Try to connect
  try {
    const pool = getPool();
    const client = await pool.connect();
    diagnostics.tests.connection = { success: true };
    client.release();
  } catch (error: any) {
    diagnostics.tests.connection = {
      success: false,
      error: error?.message || String(error),
      code: error?.code,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // Test 4: Try to initialize database (create tables)
  try {
    await initDatabase();
    diagnostics.tests.schema_init = { success: true };
  } catch (error: any) {
    diagnostics.tests.schema_init = {
      success: false,
      error: error?.message || String(error),
      code: error?.code,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // Test 5: Try to query tables
  try {
    const pool = getPool();
    const client = await pool.connect();
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('calls', 'orders')
      ORDER BY table_name;
    `);
    diagnostics.tests.tables_exist = {
      success: true,
      tables: tablesResult.rows.map((r: any) => r.table_name),
    };
    
    // Count rows in calls table
    const callsCount = await client.query("SELECT COUNT(*) as count FROM calls");
    const ordersCount = await client.query("SELECT COUNT(*) as count FROM orders");
    diagnostics.tables = {
      calls: { count: parseInt(callsCount.rows[0].count) },
      orders: { count: parseInt(ordersCount.rows[0].count) },
    };
    
    client.release();
  } catch (error: any) {
    diagnostics.tests.tables_exist = {
      success: false,
      error: error?.message || String(error),
      code: error?.code,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }

  diagnostics.status = "all_tests_passed";
  return NextResponse.json(diagnostics);
}