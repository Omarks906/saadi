const { Pool } = require("pg");

function extractCustomerFields(rawEvent) {
  const event = rawEvent || {};
  const order = event.order || {};
  const message = event.message || {};
  const call = event.call || {};

  const customerName =
    order.customerName ||
    order.customer?.name ||
    event.customerName ||
    event.customer?.name ||
    message.customer?.name ||
    call.customer?.name ||
    null;

  const customerPhone =
    order.customerPhone ||
    order.customer?.phone ||
    order.customer?.number ||
    event.customerPhone ||
    event.customer?.phone ||
    event.customer?.number ||
    message.customer?.number ||
    call.customer?.number ||
    null;

  const customerAddress =
    order.customerAddress ||
    order.customer?.address ||
    event.customerAddress ||
    event.customer?.address ||
    message.customer?.address ||
    call.customer?.address ||
    null;

  return { customerName, customerPhone, customerAddress };
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const orgId = process.env.ORG_ID || null;
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : 1000;
  const dryRun = process.env.DRY_RUN === "1";

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    const params = [];
    let where = `raw_event IS NOT NULL AND customer_name IS NULL AND customer_phone IS NULL`;

    if (orgId) {
      params.push(orgId);
      where += ` AND organization_id = $${params.length}`;
    }

    params.push(limit);
    const query = `
      SELECT id, order_id, organization_id,
             customer_name, customer_phone, customer_address,
             raw_event
      FROM orders
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(query, params);
    let updated = 0;

    for (const row of result.rows) {
      let rawEvent = row.raw_event;
      if (typeof rawEvent === "string") {
        try {
          rawEvent = JSON.parse(rawEvent);
        } catch {
          rawEvent = null;
        }
      }

      const extracted = extractCustomerFields(rawEvent);
      const nextName = row.customer_name || extracted.customerName;
      const nextPhone = row.customer_phone || extracted.customerPhone;
      const nextAddress = row.customer_address || extracted.customerAddress;

      if (
        nextName === row.customer_name &&
        nextPhone === row.customer_phone &&
        nextAddress === row.customer_address
      ) {
        continue;
      }

      if (!dryRun) {
        await pool.query(
          `UPDATE orders
           SET customer_name = $1,
               customer_phone = $2,
               customer_address = $3
           WHERE id = $4`,
          [nextName, nextPhone, nextAddress, row.id]
        );
      }

      updated += 1;
    }

    console.log(
      JSON.stringify({
        ok: true,
        scanned: result.rows.length,
        updated,
        dryRun,
        orgId: orgId || null,
      })
    );
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
