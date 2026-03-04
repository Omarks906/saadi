/**
 * Delete all orders (and their associated print_jobs) from the database.
 *
 * Usage (dry-run, default):
 *   DATABASE_URL=... node scripts/delete-all-orders.js
 *
 * Usage (actually delete):
 *   DATABASE_URL=... node scripts/delete-all-orders.js --confirm
 *
 * Optionally scope to a single organization:
 *   DATABASE_URL=... ORG_ID=<uuid> node scripts/delete-all-orders.js --confirm
 */

const { Pool } = require("pg");

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }

  const dryRun = !process.argv.includes("--confirm");
  const orgId = process.env.ORG_ID || null;

  const pool = new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Count what we're about to delete
    const countWhere = orgId
      ? "WHERE organization_id = $1"
      : "";
    const countParams = orgId ? [orgId] : [];

    const { rows: orderRows } = await pool.query(
      `SELECT COUNT(*) AS n FROM orders ${countWhere}`,
      countParams
    );
    const { rows: printRows } = await pool.query(
      `SELECT COUNT(*) AS n FROM print_jobs ${
        orgId ? "WHERE organization_id = $1" : ""
      }`,
      countParams
    );

    const orderCount = Number(orderRows[0].n);
    const printCount = Number(printRows[0].n);

    console.log("=== Delete All Kitchen Orders ===");
    if (orgId) console.log(`Scoped to org: ${orgId}`);
    console.log(`Orders to delete: ${orderCount}`);
    console.log(`Print jobs to delete: ${printCount}`);

    if (dryRun) {
      console.log("\nDRY RUN — nothing deleted.");
      console.log("Re-run with --confirm to actually delete.");
      return;
    }

    if (orderCount === 0 && printCount === 0) {
      console.log("\nNothing to delete.");
      return;
    }

    // Delete print_jobs first (no FK but good practice)
    const deleteWhere = orgId ? "WHERE organization_id = $1" : "";
    const { rowCount: deletedPrint } = await pool.query(
      `DELETE FROM print_jobs ${deleteWhere}`,
      countParams
    );

    const { rowCount: deletedOrders } = await pool.query(
      `DELETE FROM orders ${deleteWhere}`,
      countParams
    );

    console.log(`\nDeleted ${deletedPrint} print job(s).`);
    console.log(`Deleted ${deletedOrders} order(s).`);
    console.log("Done.");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
