/* eslint-disable no-console */
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: true });

async function main() {
  const cfg = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "dentra",
    password: process.env.DB_PASSWORD || "dentra_pass",
    database: process.env.DB_NAME || "dentraos",
  };

  console.log("[db_smoke] using config:", {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    database: cfg.database,
  });

  let conn;
  try {
    conn = await mysql.createConnection(cfg);

    const [pingRows] = await conn.query("SELECT DATABASE() AS db, NOW() AS nowts");
    console.log("[db_smoke] ping:", pingRows[0]);

    const [tables] = await conn.query("SHOW TABLES");
    console.log(`[db_smoke] tables: ${tables.length}`);

    const keyTableNames = [
      "users",
      "appointments",
      "cases",
      "case_summaries",
      "case_timeline",
      "inventory_items",
      "invoices",
      "notifications",
      "agent_events",
      "idempotency_locks",
    ];

    const tableSet = new Set(
      tables.map((row) => Object.values(row)[0]).filter(Boolean).map((v) => String(v).toLowerCase())
    );

    const missing = keyTableNames.filter((t) => !tableSet.has(t));
    if (missing.length) {
      console.error("[db_smoke] FAIL missing key tables:", missing.join(", "));
      process.exitCode = 2;
      return;
    }

    try {
      const [eventCount] = await conn.query("SELECT COUNT(*) AS total FROM agent_events");
      console.log("[db_smoke] agent_events count:", eventCount[0].total);
    } catch (e) {
      console.error("[db_smoke] FAIL agent_events query:", e.message);
      process.exitCode = 3;
      return;
    }

    console.log("[db_smoke] PASS");
  } catch (err) {
    console.error("[db_smoke] FAIL", err.code || "", err.message);
    process.exitCode = 1;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

main();
