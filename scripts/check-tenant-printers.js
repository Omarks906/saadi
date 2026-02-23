#!/usr/bin/env node

const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Cannot check tenant printer setup.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    const result = await client.query(`
      WITH org_jobs AS (
        SELECT
          pj.organization_id,
          COUNT(*) FILTER (WHERE pj.printer_target IS NOT NULL AND pj.printer_target <> '') AS jobs_with_printer,
          MAX(NULLIF(pj.printer_target, '')) AS sample_printer_target,
          MAX(pj.created_at) AS last_print_job_at
        FROM print_jobs pj
        GROUP BY pj.organization_id
      )
      SELECT
        o.id,
        o.slug,
        o.name,
        COALESCE(oj.jobs_with_printer, 0) AS jobs_with_printer,
        oj.sample_printer_target,
        oj.last_print_job_at
      FROM organizations o
      LEFT JOIN org_jobs oj ON oj.organization_id = o.id
      ORDER BY o.slug ASC;
    `);

    if (result.rows.length === 0) {
      console.log('No tenants found in organizations table.');
      return;
    }

    console.log('Tenant printer setup status:');
    for (const row of result.rows) {
      const hasPrinter = Number(row.jobs_with_printer) > 0;
      console.log(`- ${row.slug} (${row.name}): ${hasPrinter ? 'HAS printer target in print history' : 'NO printer target found'}`);
      if (row.sample_printer_target) {
        console.log(`  sample printer_target: ${row.sample_printer_target}`);
      }
      if (row.last_print_job_at) {
        console.log(`  last print job at: ${row.last_print_job_at.toISOString?.() || row.last_print_job_at}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to check tenant printer setup:', err.message || err);
  process.exit(1);
});
