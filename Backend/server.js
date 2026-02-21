// server.js
// ===================================
// BASIC SETUP
// ===================================
const path = require("path");
// Load shared env from repo root first, then allow local overrides in Backend/.env if present
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// ✅ NEW (for attachments + exports + SSE support)
const multer = require("multer");
const fs = require("fs");

// ✅ Payment Gateway
const paymentGateway = require("./payment_gateway");

// ✅ AI Case Assistant
const aiCaseAssistant = require("./ai_case_assistant");

// ============================================================
// TEMP: schema runner for Railway internal import (remove later)
// ============================================================
const runSchemaOnce = async () => {
  const schemaPath = path.join(__dirname, "db", "schema_query.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await pool.query(stmt);
  }
};

const app = express();


// CORS so your React app (Vite) can talk to this server
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json({ limit: "2mb" }));

// ===================================
// MYSQL CONNECTION POOL  ✅ FIXED for India timezone + DATE handling
// ===================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "dental_app",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "dental_clinic",
  waitForConnections: true,
  connectionLimit: 10,

  // ✅ CRITICAL: prevents DATE columns turning into JS Date objects (UTC shift)
  dateStrings: true, // or: dateStrings: ["DATE", "DATETIME", "TIMESTAMP"]

  // ✅ Keep driver aligned with India time for DATETIME/TIMESTAMP conversions
  timezone: "+05:30",
});

// ✅ Set MySQL session timezone (NOW(), CURDATE() behave as India)
(async () => {
  try {
    await pool.query("SET time_zone = '+05:30'");
    console.log("✅ MySQL session time_zone set to +05:30");

    // ✅ MIGRATION: Ensure invoice_items has item_type
    const [cols] = await pool.query("SHOW COLUMNS FROM invoice_items LIKE 'item_type'");
    if (cols.length === 0) {
      console.log("🛠 Migrating invoice_items: adding item_type column...");
      await pool.query(`
        ALTER TABLE invoice_items 
        ADD COLUMN item_type ENUM('PROCEDURE', 'MATERIAL', 'APPARATUS') DEFAULT 'PROCEDURE'
      `);
      console.log("✅ Migration complete: item_type added.");
    }

    // ✅ MIGRATION: Add financial overrides to patient_profiles
    const [ppCols] = await pool.query("SHOW COLUMNS FROM patient_profiles LIKE 'billed_override'");
    if (ppCols.length === 0) {
      console.log("🛠 Migrating patient_profiles: adding override columns...");
      await pool.query(`
        ALTER TABLE patient_profiles 
        ADD COLUMN billed_override DECIMAL(10,2) NULL,
        ADD COLUMN paid_override DECIMAL(10,2) NULL,
        ADD COLUMN balance_override DECIMAL(10,2) NULL
      `);
      console.log("✅ Migration complete: financial overrides added.");
    }
  } catch (e) {
    console.error("Failed to set MySQL time_zone or run migrations:", e?.message || e);
  }
})();


if (typeof initAgents === "function") {
  initAgents(pool).catch((e) => console.error("Agent init failed:", e));
}

// ✅ Optional Node hooks (kept guarded)
let enqueueEvent = null;
let retryFailedFromEventQueue = null;
let runAppointmentAgentOnce = null;
let runInventoryAgentOnce = null;
let runRevenueAgentOnce = null;
let retryFailedFromAgentsIndex = null;

try {
  ({ enqueueEvent, retryFailed: retryFailedFromEventQueue } = require("./agents/eventQueue"));
} catch (_) { }


try {
  ({
    runAppointmentAgentOnce,
    runInventoryAgentOnce,
    runRevenueAgentOnce,
    retryFailed: retryFailedFromAgentsIndex,
  } = require("./agents"));
} catch (_) { }

// ✅ Optional legacy Node PDF export hook (kept guarded)
let exportCasePdf = null;
try {
  ({ exportCasePdf } = require("./agents/caseTrackingAgent"));
} catch (_) { }

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

// ===================================
// APP TIMEZONE HELPERS (India)
// ===================================
const APP_TZ = process.env.APP_TZ || "Asia/Kolkata";

// Returns YYYY-MM-DD in Asia/Kolkata (prevents server UTC offset bugs)
function formatDateYYYYMMDD(d = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(d); // YYYY-MM-DD
  } catch {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
const _enumCache = new Map();

const DOCTOR_BASE = "/api/doctor";
function _parseEnumValues(columnType) {
  // columnType like: enum('NEW','PROCESSING','DONE')
  const m = String(columnType || "").match(/^enum\((.*)\)$/i);
  if (!m) return [];
  const inner = m[1];
  // split by comma, remove quotes
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^'(.*)'$/, "$1"))
    .filter(Boolean);
}
async function getEnumValues(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (_enumCache.has(key)) return _enumCache.get(key);

  try {
    const [rows] = await pool.query(
      `
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [tableName, columnName]
    );
    const vals = rows?.[0]?.COLUMN_TYPE ? _parseEnumValues(rows[0].COLUMN_TYPE) : [];
    _enumCache.set(key, vals);
    return vals;
  } catch (e) {
    console.error("getEnumValues error:", e?.message || e);
    _enumCache.set(key, []);
    return [];
  }
}
function pickEnumValue(values, preferredList, fallback) {
  const set = new Set(values || []);
  for (const v of preferredList) if (set.has(v)) return v;
  return fallback;
}

function toDateStr(x) {
  const s = String(x || "").trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function toTimeStr(x) {
  const s = String(x || "").trim();
  if (!s) return "";
  return s.length === 5 ? `${s}:00` : s; // HH:MM -> HH:MM:SS
}
function safeJsonParse(value, fallback = null) {
  try {
    if (value == null) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}
function formatDateTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const h = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  const sec = String(dt.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}
// ===================================
// ✅ DOCTOR: INVENTORY (read-only)
// Fixes frontend calls:
//   GET /api/doctor/inventory/catalog
//   GET /api/doctor/inventory
// ===================================
app.get(
  `${DOCTOR_BASE}/inventory/catalog`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "DOCTOR INVENTORY CATALOG",
        `SELECT item_code, name, category, stock, status, reorder_threshold, expiry_date
         FROM inventory_items
         ORDER BY name ASC`,
        []
      );

      const items = (rows || []).map((r) => ({
        id: r.item_code,
        itemCode: r.item_code,
        name: r.name,
        category: r.category,
        stock: Number(r.stock || 0),
        status: r.status || null,
        reorderThreshold: Number(r.reorder_threshold || 0),
        expiryDate: r.expiry_date ? toDateStr(r.expiry_date) : null,
      }));

      return res.json({ items });
    } catch (e) {
      console.error("GET /doctor/inventory/catalog error:", e);
      return res.json({ items: [], error: true });
    }
  }
);

// Many UIs call /api/doctor/inventory (same payload as catalog)
app.get(
  `${DOCTOR_BASE}/inventory`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "DOCTOR INVENTORY",
        `SELECT item_code, name, category, stock, status, reorder_threshold, expiry_date
         FROM inventory_items
         ORDER BY name ASC`,
        []
      );

      const items = (rows || []).map((r) => ({
        id: r.item_code,
        itemCode: r.item_code,
        name: r.name,
        category: r.category,
        stock: Number(r.stock || 0),
        status: r.status || null,
        reorderThreshold: Number(r.reorder_threshold || 0),
        expiryDate: r.expiry_date ? toDateStr(r.expiry_date) : null,
      }));

      return res.json({ items });
    } catch (e) {
      console.error("GET /doctor/inventory error:", e);
      return res.json({ items: [], error: true });
    }
  }
);
// ===================================
// ✅ DOCTOR: APPOINTMENT CONSUMABLES (compat route)
// Frontend calls: /api/doctor/appointments/:dbId/consumables
// Backend stores under visits + visit_consumables
// ===================================
async function getOrCreateVisitIdForAppointment({ appointmentId, doctorId }) {
  const okVisits = await tableExists("visits");
  if (!okVisits) return { visitId: null, error: "visits table not found" };

  const visitsCols = await getTableColumns("visits");
  const vIdCol = pickCol(visitsCols, ["id"]);
  const vUidCol = pickCol(visitsCols, ["visit_uid", "uid"]);
  const vApptCol = pickCol(visitsCols, ["appointment_id", "appointment_db_id", "appointmentid"]);
  const vDoctorCol = pickCol(visitsCols, ["doctor_id"]);
  const vPatientCol = pickCol(visitsCols, ["patient_id"]);
  const vVisitDateCol = pickCol(visitsCols, ["visit_date", "visited_at", "date"]);
  const vNotesCol = pickCol(visitsCols, ["notes"]);
  const vCreatedAtCol = pickCol(visitsCols, ["created_at"]); // if exists

  if (!vIdCol || !vApptCol) {
    return { visitId: null, error: "visits table missing appointment link column" };
  }

  // 1) Ensure appointment exists and belongs to this doctor
  const [arows] = await pool.query(
    `SELECT id, patient_id, doctor_id, scheduled_date
     FROM appointments
     WHERE id = ? AND doctor_id = ?
     LIMIT 1`,
    [appointmentId, doctorId]
  );
  if (!arows.length) return { visitId: null, error: "appointment not found for doctor" };

  // 2) Check existing visit
  const [vrows] = await pool.query(
    `SELECT ${vIdCol} AS id FROM visits WHERE ${vApptCol} = ? LIMIT 1`,
    [appointmentId]
  );
  if (vrows.length) return { visitId: Number(vrows[0].id), error: null };

  // 3) Create visit (only with columns that exist)
  const a = arows[0];
  const insertCols = [vApptCol];
  const insertVals = [appointmentId];

  if (vUidCol) {
    const nonce = Math.floor(Math.random() * 10000);
    insertCols.push(vUidCol);
    insertVals.push(`VIS-${Date.now()}-${nonce}`);
  }
  if (vDoctorCol) { insertCols.push(vDoctorCol); insertVals.push(a.doctor_id); }
  if (vPatientCol) { insertCols.push(vPatientCol); insertVals.push(a.patient_id); }
  if (vVisitDateCol) { insertCols.push(vVisitDateCol); insertVals.push(toDateStr(a.scheduled_date)); }
  if (vNotesCol) { insertCols.push(vNotesCol); insertVals.push(null); }
  if (vCreatedAtCol) {
    // If created_at exists and is NOT defaulted, give NOW(); if defaulted, this is harmless.
    // But only add if column exists and you want explicit timestamps.
  }

  const placeholders = insertCols.map(() => "?").join(",");
  const [ins] = await pool.query(
    `INSERT INTO visits (${insertCols.join(",")}) VALUES (${placeholders})`,
    insertVals
  );

  return { visitId: Number(ins.insertId), error: null };
}

async function listVisitConsumablesByVisitId(visitId) {
  const okVc = await tableExists("visit_consumables");
  const okInv = await tableExists("inventory_items");
  if (!okVc) return { items: [], error: "visit_consumables table not found" };

  const vcCols = await getTableColumns("visit_consumables");
  const invCols = okInv ? await getTableColumns("inventory_items") : new Set();

  const vcVisitCol = pickCol(vcCols, ["visit_id"]);
  const vcItemCol = pickCol(vcCols, ["inventory_item_id", "item_id", "item_code", "inventory_item_code"]);
  const vcQtyCol = pickCol(vcCols, ["qty", "quantity", "quantity_used", "qty_used", "units"]);
  const vcUnitCol = pickCol(vcCols, ["unit", "uom"]);
  const vcIdCol = pickCol(vcCols, ["id"]);

  const invIdCol = pickCol(invCols, ["id", "inventory_item_id"]);
  const invCodeCol = pickCol(invCols, ["item_code", "code"]);
  const invNameCol = pickCol(invCols, ["name", "item_name"]);
  const invCatCol = pickCol(invCols, ["category"]);

  if (!vcVisitCol || !vcItemCol) return { items: [], error: "visit_consumables schema missing visit/item cols" };

  const joinOn =
    okInv && (vcItemCol.toLowerCase().includes("id") && invIdCol)
      ? `vc.${vcItemCol} = i.${invIdCol}`
      : okInv && invCodeCol
        ? `vc.${vcItemCol} = i.${invCodeCol}`
        : null;

  const rows = await safeQuery(
    "APPT->VISIT CONSUMABLES LIST",
    `
    SELECT
      ${vcIdCol ? `vc.${vcIdCol} AS id,` : "NULL AS id,"}
      vc.${vcVisitCol} AS visit_id,
      vc.${vcItemCol} AS item_ref,
      ${vcQtyCol ? `vc.${vcQtyCol} AS qty,` : "1 AS qty,"}
      ${vcUnitCol ? `vc.${vcUnitCol} AS unit,` : "NULL AS unit,"}
      ${joinOn && invCodeCol ? `i.${invCodeCol} AS item_code,` : "NULL AS item_code,"}
      ${joinOn && invNameCol ? `i.${invNameCol} AS name,` : "NULL AS name,"}
      ${joinOn && invCatCol ? `i.${invCatCol} AS category` : "NULL AS category"}
    FROM visit_consumables vc
    ${joinOn ? `LEFT JOIN inventory_items i ON ${joinOn}` : ""}
    WHERE vc.${vcVisitCol} = ?
    ORDER BY ${joinOn && invNameCol ? `i.${invNameCol}` : "vc.item_ref"} ASC
    `,
    [visitId]
  );

  return { items: rows || [], error: null };
}

async function replaceVisitConsumables({ visitId, items }) {
  const okVc = await tableExists("visit_consumables");
  if (!okVc) return { ok: false, error: "visit_consumables table not found" };

  const vcCols = await getTableColumns("visit_consumables");
  const vcVisitCol = pickCol(vcCols, ["visit_id"]);
  const vcItemCol = pickCol(vcCols, ["inventory_item_id", "item_id", "item_code", "inventory_item_code"]);
  const vcQtyCol = pickCol(vcCols, ["qty", "quantity", "quantity_used", "qty_used", "units"]);
  const vcUnitCol = pickCol(vcCols, ["unit", "uom"]);

  if (!vcVisitCol || !vcItemCol) return { ok: false, error: "visit_consumables schema missing visit/item cols" };

  const vcItemIsId =
    vcItemCol.toLowerCase().includes("id") && !vcItemCol.toLowerCase().includes("code");

  async function resolveItemRef(itemRef) {
    if (!vcItemIsId) return itemRef;
    const asNum = Number(itemRef);
    if (Number.isFinite(asNum) && asNum > 0) return Math.floor(asNum);

    const okInv = await tableExists("inventory_items");
    if (!okInv) return null;
    const invCols = await getTableColumns("inventory_items");
    const invIdCol = pickCol(invCols, ["id", "inventory_item_id"]);
    const invCodeCol = pickCol(invCols, ["item_code", "code"]);
    if (!invIdCol || !invCodeCol) return null;

    const [rows] = await pool.query(
      `SELECT ${invIdCol} AS id FROM inventory_items WHERE ${invCodeCol} = ? LIMIT 1`,
      [String(itemRef)]
    );
    if (!rows.length) return null;
    const id = Number(rows[0].id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  const normalized = [];
  for (const row of items || []) {
    const itemRef = asNonEmptyString(row?.itemRef ?? row?.item_ref ?? row?.itemKey ?? row?.item_key ?? row?.item_code);
    const qty = asPositiveNumber(row?.qty ?? row?.quantity ?? 1, 1);
    const unit = asNonEmptyString(row?.unit ?? row?.uom ?? null);
    if (!itemRef) continue;
    normalized.push({ itemRef, qty, unit });
  }

  const resolved = [];
  for (const row of normalized) {
    const ref = await resolveItemRef(row.itemRef);
    if (!ref) continue;
    resolved.push({ ...row, itemRef: ref });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM visit_consumables WHERE ${vcVisitCol} = ?`, [visitId]);

    if (resolved.length) {
      const insertCols = [vcVisitCol, vcItemCol];
      if (vcQtyCol) insertCols.push(vcQtyCol);
      if (vcUnitCol) insertCols.push(vcUnitCol);

      const placeholders = [];
      const values = [];

      for (const r of resolved) {
        const rowVals = [visitId, r.itemRef];
        if (vcQtyCol) rowVals.push(r.qty);
        if (vcUnitCol) rowVals.push(r.unit);
        placeholders.push(`(${insertCols.map(() => "?").join(",")})`);
        values.push(...rowVals);
      }

      await conn.query(
        `INSERT INTO visit_consumables (${insertCols.join(",")}) VALUES ${placeholders.join(",")}`,
        values
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return { ok: true, count: resolved.length };
}

// GET appointment consumables
app.get(
  `${DOCTOR_BASE}/appointments/:dbId/consumables`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.dbId);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }

      const doctorId = req.user.id;
      const { visitId, error } = await getOrCreateVisitIdForAppointment({ appointmentId, doctorId });
      if (!visitId) return res.status(501).json({ message: error || "Cannot resolve visit" });

      const out = await listVisitConsumablesByVisitId(visitId);
      return res.json({ visitId, items: out.items || [] });
    } catch (e) {
      console.error("GET /doctor/appointments/:dbId/consumables error:", e);
      return res.json({ visitId: null, items: [], error: true });
    }
  }
);

// PUT appointment consumables (replaces all)
app.put(
  `${DOCTOR_BASE}/appointments/:dbId/consumables`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.dbId);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }

      const doctorId = req.user.id;
      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items) return res.status(400).json({ message: "items[] required" });

      const { visitId, error } = await getOrCreateVisitIdForAppointment({ appointmentId, doctorId });
      if (!visitId) return res.status(501).json({ message: error || "Cannot resolve visit" });

      const r = await replaceVisitConsumables({ visitId, items });

      await enqueueEventCompat({
        eventType: "VisitConsumablesUpdated",
        payload: { visitId, appointmentId },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true, visitId, count: r.count || 0 });
    } catch (e) {
      console.error("PUT /doctor/appointments/:dbId/consumables error:", e);
      return res.status(500).json({ ok: false, message: "Failed to save appointment consumables" });
    }
  }
);

// ===================================
// ✅ SCHEMA INTROSPECTION HELPERS (for consumables endpoints)
// ===================================
const _colsCache = new Map();
async function getTableColumns(tableName) {
  if (_colsCache.has(tableName)) return _colsCache.get(tableName);
  try {
    const [rows] = await pool.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `,
      [tableName]
    );
    const cols = new Set((rows || []).map((r) => String(r.COLUMN_NAME || "").toLowerCase()));
    _colsCache.set(tableName, cols);
    return cols;
  } catch (e) {
    console.error("getTableColumns error:", tableName, e?.message || e);
    const cols = new Set();
    _colsCache.set(tableName, cols);
    return cols;
  }
}

async function tableExists(tableName) {
  try {
    const [rows] = await pool.query(
      `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
      `,
      [tableName]
    );
    return !!rows?.length;
  } catch (_) {
    return false;
  }
}

function pickCol(colsSet, candidates) {
  for (const c of candidates) {
    if (colsSet.has(String(c).toLowerCase())) return c;
  }
  return null;
}

function asNonEmptyString(x) {
  const s = String(x ?? "").trim();
  return s.length ? s : null;
}

function asPositiveNumber(x, fallback = null) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return n > 0 ? n : fallback;
}

function clampInt(x, min, max, fallback) {
  const n = parseInt(String(x), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// Admin variant (no doctor check)
async function getOrCreateVisitIdForAppointmentAdmin(appointmentId) {
  const okVisits = await tableExists("visits");
  if (!okVisits) return { visitId: null, error: "visits table not found" };

  const visitsCols = await getTableColumns("visits");
  const vIdCol = pickCol(visitsCols, ["id"]);
  const vUidCol = pickCol(visitsCols, ["visit_uid", "uid"]);
  const vApptCol = pickCol(visitsCols, ["appointment_id", "appointment_db_id", "appointmentid"]);
  const vDoctorCol = pickCol(visitsCols, ["doctor_id"]);
  const vPatientCol = pickCol(visitsCols, ["patient_id"]);
  const vVisitDateCol = pickCol(visitsCols, ["visit_date", "visited_at", "date", "created_at"]);

  if (!vIdCol || !vApptCol) {
    return { visitId: null, error: "visits table missing appointment link column" };
  }

  const [arows] = await pool.query(
    `SELECT id, patient_id, doctor_id, scheduled_date
     FROM appointments
     WHERE id = ?
     LIMIT 1`,
    [appointmentId]
  );
  if (!arows.length) return { visitId: null, error: "appointment not found" };

  const [vrows] = await pool.query(
    `SELECT ${vIdCol} AS id FROM visits WHERE ${vApptCol} = ? LIMIT 1`,
    [appointmentId]
  );
  if (vrows.length) return { visitId: Number(vrows[0].id), error: null };

  const a = arows[0];
  const insertCols = [vApptCol];
  const insertVals = [appointmentId];

  if (vUidCol) {
    const nonce = Math.floor(Math.random() * 10000);
    insertCols.push(vUidCol);
    insertVals.push(`VIS-${Date.now()}-${nonce}`);
  }
  if (vDoctorCol) { insertCols.push(vDoctorCol); insertVals.push(a.doctor_id); }
  if (vPatientCol) { insertCols.push(vPatientCol); insertVals.push(a.patient_id); }
  if (vVisitDateCol) { insertCols.push(vVisitDateCol); insertVals.push(toDateStr(a.scheduled_date)); }

  const placeholders = insertCols.map(() => "?").join(",");
  const [ins] = await pool.query(
    `INSERT INTO visits (${insertCols.join(",")}) VALUES (${placeholders})`,
    insertVals
  );

  return { visitId: Number(ins.insertId), error: null };
}

async function listVisitProceduresByVisitId(visitId) {
  const okVp = await tableExists("visit_procedures");
  if (!okVp) return { items: [], error: "visit_procedures table not found" };

  const vpCols = await getTableColumns("visit_procedures");
  const vpVisitCol = pickCol(vpCols, ["visit_id"]);
  const vpCodeCol = pickCol(vpCols, ["procedure_code", "procedure_type", "code"]);
  const vpQtyCol = pickCol(vpCols, ["qty", "quantity"]);
  const vpUnitCol = pickCol(vpCols, ["unit_price", "price"]);
  const vpAmountCol = pickCol(vpCols, ["amount", "total"]);
  const vpNotesCol = pickCol(vpCols, ["notes", "note"]);
  const vpIdCol = pickCol(vpCols, ["id"]);

  if (!vpVisitCol || !vpCodeCol) return { items: [], error: "visit_procedures schema missing visit/code cols" };

  const rows = await safeQuery(
    "ADMIN VISIT PROCEDURES LIST",
    `
    SELECT
      ${vpIdCol ? `vp.${vpIdCol} AS id,` : "NULL AS id,"}
      vp.${vpVisitCol} AS visit_id,
      vp.${vpCodeCol} AS procedure_code,
      ${vpQtyCol ? `vp.${vpQtyCol} AS qty,` : "1 AS qty,"}
      ${vpUnitCol ? `vp.${vpUnitCol} AS unit_price,` : "NULL AS unit_price,"}
      ${vpAmountCol ? `vp.${vpAmountCol} AS amount,` : "NULL AS amount,"}
      ${vpNotesCol ? `vp.${vpNotesCol} AS notes` : "NULL AS notes"}
    FROM visit_procedures vp
    WHERE vp.${vpVisitCol} = ?
    ORDER BY ${vpIdCol ? `vp.${vpIdCol}` : "vp.${vpVisitCol}"} ASC
    `,
    [visitId]
  );

  return { items: rows || [], error: null };
}

async function replaceVisitProcedures({ visitId, items }) {
  const okVp = await tableExists("visit_procedures");
  if (!okVp) return { ok: false, error: "visit_procedures table not found" };

  const vpCols = await getTableColumns("visit_procedures");
  const vpVisitCol = pickCol(vpCols, ["visit_id"]);
  const vpCodeCol = pickCol(vpCols, ["procedure_code", "procedure_type", "code"]);
  const vpQtyCol = pickCol(vpCols, ["qty", "quantity"]);
  const vpUnitCol = pickCol(vpCols, ["unit_price", "price"]);
  const vpAmountCol = pickCol(vpCols, ["amount", "total"]);
  const vpNotesCol = pickCol(vpCols, ["notes", "note"]);

  if (!vpVisitCol || !vpCodeCol) return { ok: false, error: "visit_procedures schema missing visit/code cols" };

  const normalized = [];
  for (const row of items || []) {
    const code = asNonEmptyString(
      row?.procedureCode ??
      row?.procedure_code ??
      row?.procedureType ??
      row?.procedure_type ??
      row?.code ??
      row?.name
    );
    if (!code) continue;

    const qty = asPositiveNumber(row?.qty ?? row?.quantity ?? 1, 1);
    const unitPrice = Number(row?.unitPrice ?? row?.unit_price ?? row?.price ?? 0) || 0;
    const amount = Number(row?.amount ?? row?.total ?? (qty * unitPrice)) || 0;
    const notes = asNonEmptyString(row?.notes ?? row?.note ?? null);

    normalized.push({ code, qty, unitPrice, amount, notes });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM visit_procedures WHERE ${vpVisitCol} = ?`, [visitId]);

    if (normalized.length) {
      const insertCols = [vpVisitCol, vpCodeCol];
      if (vpQtyCol) insertCols.push(vpQtyCol);
      if (vpUnitCol) insertCols.push(vpUnitCol);
      if (vpAmountCol) insertCols.push(vpAmountCol);
      if (vpNotesCol) insertCols.push(vpNotesCol);

      const placeholders = [];
      const values = [];

      for (const r of normalized) {
        const rowVals = [visitId, r.code];
        if (vpQtyCol) rowVals.push(r.qty);
        if (vpUnitCol) rowVals.push(r.unitPrice);
        if (vpAmountCol) rowVals.push(r.amount);
        if (vpNotesCol) rowVals.push(r.notes);
        placeholders.push(`(${insertCols.map(() => "?").join(",")})`);
        values.push(...rowVals);
      }

      await conn.query(
        `INSERT INTO visit_procedures (${insertCols.join(",")}) VALUES ${placeholders.join(",")}`,
        values
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return { ok: true, count: normalized.length };
}

// ===================================
// ✅ Inventory inline consumption fallback (if agents are not running)
// ===================================
async function hasInventoryConsumedAudit(appointmentId) {
  const ok = await tableExists("appointment_audit_logs");
  if (!ok) return false;
  try {
    const [rows] = await pool.query(
      `
      SELECT 1 AS ok
      FROM appointment_audit_logs
      WHERE appointment_id = ?
        AND action = 'INVENTORY_CONSUMED'
      LIMIT 1
      `,
      [appointmentId]
    );
    return !!rows?.length;
  } catch (_) {
    return false;
  }
}

async function writeInventoryConsumedAudit({ appointmentId, userId, meta }) {
  const ok = await tableExists("appointment_audit_logs");
  if (!ok) return;
  const cols = await getTableColumns("appointment_audit_logs");
  const insertCols = [];
  const insertVals = [];

  if (cols.has("appointment_id")) {
    insertCols.push("appointment_id");
    insertVals.push(appointmentId);
  }
  if (cols.has("actor_user_id")) {
    insertCols.push("actor_user_id");
    insertVals.push(userId || null);
  }
  if (cols.has("action")) {
    insertCols.push("action");
    insertVals.push("INVENTORY_CONSUMED");
  }
  if (cols.has("note")) {
    insertCols.push("note");
    insertVals.push("Inline inventory consumption from visit_consumables");
  }
  if (cols.has("meta_json")) {
    insertCols.push("meta_json");
    insertVals.push(meta ? JSON.stringify(meta) : null);
  }

  if (!insertCols.length) return;

  const placeholders = insertCols.map(() => "?").join(",");
  try {
    await pool.query(
      `INSERT INTO appointment_audit_logs (${insertCols.join(",")}) VALUES (${placeholders})`,
      insertVals
    );
  } catch (_) { }
}

async function writeAppointmentAuditAction({
  appointmentId,
  actorUserId = null,
  action,
  reason = null,
  note = null,
  meta = null,
}) {
  const ok = await tableExists("appointment_audit_logs");
  if (!ok) return;
  const cols = await getTableColumns("appointment_audit_logs");
  const insertCols = [];
  const insertVals = [];

  if (cols.has("appointment_id")) {
    insertCols.push("appointment_id");
    insertVals.push(appointmentId);
  }
  if (cols.has("actor_user_id")) {
    insertCols.push("actor_user_id");
    insertVals.push(actorUserId || null);
  }
  if (cols.has("action")) {
    insertCols.push("action");
    insertVals.push(String(action || "UPDATED").slice(0, 64));
  }
  if (cols.has("reason") && reason !== null && reason !== undefined) {
    insertCols.push("reason");
    insertVals.push(String(reason).slice(0, 255));
  }
  if (cols.has("note")) {
    insertCols.push("note");
    insertVals.push(note ? String(note).slice(0, 1000) : null);
  }
  if (cols.has("meta_json")) {
    insertCols.push("meta_json");
    insertVals.push(meta ? JSON.stringify(meta) : null);
  }
  if (!insertCols.length) return;

  const placeholders = insertCols.map(() => "?").join(",");
  try {
    await pool.query(
      `INSERT INTO appointment_audit_logs (${insertCols.join(",")}) VALUES (${placeholders})`,
      insertVals
    );
  } catch (err) {
    console.error("writeAppointmentAuditAction error:", err?.message || err);
  }
}

async function insertInventoryUsageLogFromDeduction({
  appointmentId,
  visitId,
  doctorId,
  itemId = null,
  itemCode = null,
  qtyUsed,
  eventId = null,
  sourceType = "VISIT_CONSUMABLES",
}) {
  const ok = await tableExists("inventory_usage_logs");
  if (!ok) return { ok: false, reason: "inventory_usage_logs missing" };

  const qty = Math.max(0, Math.floor(Number(qtyUsed || 0)));
  if (!qty) return { ok: false, reason: "invalid qty" };

  const itemKey = itemId ? `id:${itemId}` : `code:${itemCode || "unknown"}`;
  const eventKey = Number.isFinite(Number(eventId)) ? Number(eventId) : "inline";
  const lockKey = `inv_usage:${appointmentId || 0}:${visitId || 0}:${itemKey}:${qty}:${eventKey}`;
  const locked = await insertIdempotencyLockIfPossible(lockKey);
  if (!locked) return { ok: false, skipped: true, reason: "duplicate" };

  const cols = await getTableColumns("inventory_usage_logs");
  const insertCols = [];
  const insertVals = [];

  if (cols.has("appointment_id")) {
    insertCols.push("appointment_id");
    insertVals.push(appointmentId || null);
  }
  if (cols.has("visit_id")) {
    insertCols.push("visit_id");
    insertVals.push(visitId || null);
  }
  if (cols.has("item_id") && itemId != null) {
    insertCols.push("item_id");
    insertVals.push(itemId);
  }
  if (cols.has("item_code") && itemCode) {
    insertCols.push("item_code");
    insertVals.push(String(itemCode));
  }
  if (cols.has("qty_used")) {
    insertCols.push("qty_used");
    insertVals.push(qty);
  } else if (cols.has("qty")) {
    insertCols.push("qty");
    insertVals.push(qty);
  }
  if (cols.has("doctor_id")) {
    insertCols.push("doctor_id");
    insertVals.push(doctorId || null);
  }
  if (cols.has("source")) {
    const sourceValues = await getEnumValues("inventory_usage_logs", "source");
    insertCols.push("source");
    insertVals.push(pickEnumValue(sourceValues, ["AUTO", "MANUAL", "ADJUSTMENT"], "AUTO"));
  }
  if (cols.has("source_type")) {
    insertCols.push("source_type");
    insertVals.push(sourceType);
  }
  if (cols.has("source_ref_id")) {
    insertCols.push("source_ref_id");
    insertVals.push(visitId || appointmentId || null);
  }
  if (cols.has("event_id")) {
    insertCols.push("event_id");
    insertVals.push(Number.isFinite(Number(eventId)) ? Number(eventId) : null);
  }
  if (cols.has("dedupe_key")) {
    insertCols.push("dedupe_key");
    insertVals.push(lockKey.slice(0, 190));
  }
  if (cols.has("meta_json")) {
    insertCols.push("meta_json");
    insertVals.push(
      JSON.stringify({
        appointmentId: appointmentId || null,
        visitId: visitId || null,
        itemId: itemId || null,
        itemCode: itemCode || null,
        qtyUsed: qty,
        sourceType,
        eventId: Number.isFinite(Number(eventId)) ? Number(eventId) : null,
      })
    );
  }
  if (cols.has("created_at")) {
    insertCols.push("created_at");
    insertVals.push(new Date());
  } else if (cols.has("used_at")) {
    insertCols.push("used_at");
    insertVals.push(new Date());
  }

  if (!insertCols.length) return { ok: false, reason: "no compatible columns" };
  const placeholders = insertCols.map(() => "?").join(",");
  await pool.query(
    `INSERT INTO inventory_usage_logs (${insertCols.join(",")}) VALUES (${placeholders})`,
    insertVals
  );
  return { ok: true };
}

async function ensureLowStockPoDraft({ itemId, itemCode, vendorId = null, stock, threshold }) {
  const hasPo = await tableExists("purchase_orders");
  const hasPoi = await tableExists("purchase_order_items");
  if (!hasPo || !hasPoi) return { ok: false, reason: "po tables missing" };

  const dateKey = formatDateYYYYMMDD();
  const key = `po_draft:${vendorId || 0}:${itemCode || itemId}:${dateKey}`;
  const locked = await insertIdempotencyLockIfPossible(key);
  if (!locked) return { ok: false, skipped: true, reason: "duplicate" };

  const poCols = await getTableColumns("purchase_orders");
  const poiCols = await getTableColumns("purchase_order_items");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let poId = null;
    const statusFilter = poCols.has("status") ? "AND status IN ('DRAFT','REQUESTED')" : "";
    if (poCols.has("vendor_id")) {
      const [existing] = await conn.query(
        `SELECT id FROM purchase_orders
         WHERE ${(vendorId == null ? "vendor_id IS NULL" : "vendor_id = ?")}
           AND DATE(created_at) = CURDATE()
           ${statusFilter}
         ORDER BY id DESC
         LIMIT 1`,
        vendorId == null ? [] : [vendorId]
      );
      if (existing.length) poId = Number(existing[0].id);
    }

    if (!poId) {
      const cols = [];
      const vals = [];
      if (poCols.has("vendor_id")) {
        cols.push("vendor_id");
        vals.push(vendorId);
      }
      if (poCols.has("status")) {
        cols.push("status");
        vals.push("DRAFT");
      }
      if (poCols.has("notes")) {
        cols.push("notes");
        vals.push(`Auto draft for low stock (${itemCode || itemId})`);
      }
      if (poCols.has("created_at")) {
        cols.push("created_at");
        vals.push(new Date());
      }
      if (poCols.has("updated_at")) {
        cols.push("updated_at");
        vals.push(new Date());
      }
      const placeholders = cols.map(() => "?").join(",");
      const [insPo] = await conn.query(
        `INSERT INTO purchase_orders (${cols.join(",")}) VALUES (${placeholders})`,
        vals
      );
      poId = Number(insPo.insertId);
    }

    const qty = Math.max(1, Number(threshold || 0) - Number(stock || 0) + 1);
    const [existingPoi] = await conn.query(
      `SELECT id FROM purchase_order_items
       WHERE purchase_order_id = ? AND item_code = ?
       LIMIT 1`,
      [poId, String(itemCode || "")]
    );
    if (!existingPoi.length) {
      const itemCols = [];
      const itemVals = [];
      if (poiCols.has("purchase_order_id")) {
        itemCols.push("purchase_order_id");
        itemVals.push(poId);
      }
      if (poiCols.has("item_code")) {
        itemCols.push("item_code");
        itemVals.push(String(itemCode || ""));
      }
      if (poiCols.has("qty")) {
        itemCols.push("qty");
        itemVals.push(qty);
      }
      if (poiCols.has("created_at")) {
        itemCols.push("created_at");
        itemVals.push(new Date());
      }
      const ph = itemCols.map(() => "?").join(",");
      await conn.query(
        `INSERT INTO purchase_order_items (${itemCols.join(",")}) VALUES (${ph})`,
        itemVals
      );
    }

    await conn.commit();

    await insertNotificationInline({
      userRole: "Admin",
      title: "Low stock PO drafted",
      message: `Auto-created PO draft for ${itemCode || `item ${itemId}`}.`,
      notifType: "INVENTORY_LOW_STOCK_PO_DRAFTED",
      relatedType: "purchase_orders",
      relatedId: poId,
      priority: 125,
      meta: { poId, itemId, itemCode, stock, threshold },
    });

    return { ok: true, poId };
  } catch (e) {
    await conn.rollback();
    return { ok: false, reason: e?.message || "po insert failed" };
  } finally {
    conn.release();
  }
}

async function insertIdempotencyLockIfPossible(lockKey) {
  const ok = await tableExists("idempotency_locks");
  if (!ok) return true;
  const cols = await getTableColumns("idempotency_locks");
  if (!cols.has("lock_key")) return true;

  const insertCols = ["lock_key"];
  const insertVals = [String(lockKey).slice(0, 190)];

  if (cols.has("locked_by")) {
    insertCols.push("locked_by");
    insertVals.push("server-inline");
  }
  if (cols.has("expires_at")) {
    insertCols.push("expires_at");
    insertVals.push(new Date(Date.now() + 24 * 60 * 60 * 1000));
  }
  if (cols.has("created_at")) {
    insertCols.push("created_at");
    insertVals.push(new Date());
  }

  const placeholders = insertCols.map(() => "?").join(",");
  try {
    await pool.query(
      `INSERT INTO idempotency_locks (${insertCols.join(",")}) VALUES (${placeholders})`,
      insertVals
    );
    return true;
  } catch (_) {
    return false;
  }
}

async function emitLowStockNotification({ itemId, itemName, stock, threshold }) {
  const ok = await tableExists("notifications");
  if (!ok) return;

  const dedupeKey = `low_stock:${itemId}:${threshold}`;
  const locked = await insertIdempotencyLockIfPossible(dedupeKey);
  if (!locked) return;

  const cols = await getTableColumns("notifications");
  const insertCols = [];
  const insertVals = [];

  if (cols.has("user_id")) {
    insertCols.push("user_id");
    insertVals.push(null);
  }
  if (cols.has("user_role")) {
    insertCols.push("user_role");
    insertVals.push("Admin");
  }
  if (cols.has("channel")) {
    insertCols.push("channel");
    insertVals.push("IN_APP");
  }
  if (cols.has("type")) {
    insertCols.push("type");
    insertVals.push("LOW_STOCK");
  }
  if (cols.has("title")) {
    insertCols.push("title");
    insertVals.push(`Low stock: ${itemName}`);
  }
  if (cols.has("message")) {
    insertCols.push("message");
    insertVals.push(`${itemName} is low (stock ${stock}, threshold ${threshold}).`);
  }
  if (cols.has("status")) {
    const statusValues = await getEnumValues("notifications", "status");
    const picked = pickEnumValue(statusValues, ["PENDING", "NEW"], "PENDING");
    insertCols.push("status");
    insertVals.push(picked);
  }
  if (cols.has("priority")) {
    insertCols.push("priority");
    insertVals.push(120);
  }
  if (cols.has("related_entity_type")) {
    insertCols.push("related_entity_type");
    insertVals.push("inventory_items");
  } else if (cols.has("related_table")) {
    insertCols.push("related_table");
    insertVals.push("inventory_items");
  }
  if (cols.has("related_entity_id")) {
    insertCols.push("related_entity_id");
    insertVals.push(itemId);
  } else if (cols.has("related_id")) {
    insertCols.push("related_id");
    insertVals.push(itemId);
  }
  if (cols.has("meta_json")) {
    insertCols.push("meta_json");
    insertVals.push(JSON.stringify({ itemId, stock, threshold }, null, 0));
  }
  if (cols.has("created_at")) {
    insertCols.push("created_at");
    insertVals.push(new Date());
  }
  if (cols.has("updated_at")) {
    insertCols.push("updated_at");
    insertVals.push(new Date());
  }

  if (!insertCols.length) return;
  const placeholders = insertCols.map(() => "?").join(",");
  await pool.query(
    `INSERT INTO notifications (${insertCols.join(",")}) VALUES (${placeholders})`,
    insertVals
  );
}

async function insertNotificationInline({
  userId = null,
  userRole = null,
  title,
  message,
  notifType,
  relatedType = null,
  relatedId = null,
  priority = 120,
  meta = null,
}) {
  const ok = await tableExists("notifications");
  if (!ok) return;

  const cols = await getTableColumns("notifications");
  const insertCols = [];
  const insertVals = [];

  if (cols.has("user_id")) {
    insertCols.push("user_id");
    insertVals.push(userId);
  }
  if (cols.has("user_role") && userRole) {
    insertCols.push("user_role");
    insertVals.push(userRole);
  }
  if (cols.has("channel")) {
    insertCols.push("channel");
    insertVals.push("IN_APP");
  }
  if (cols.has("type")) {
    insertCols.push("type");
    insertVals.push(notifType || null);
  }
  if (cols.has("title")) {
    insertCols.push("title");
    insertVals.push(title || null);
  }
  if (cols.has("message")) {
    insertCols.push("message");
    insertVals.push(message || "");
  }
  if (cols.has("status")) {
    const statusValues = await getEnumValues("notifications", "status");
    const picked = pickEnumValue(statusValues, ["PENDING", "NEW"], "PENDING");
    insertCols.push("status");
    insertVals.push(picked);
  }
  if (cols.has("priority")) {
    insertCols.push("priority");
    insertVals.push(priority);
  }
  if (cols.has("related_entity_type")) {
    insertCols.push("related_entity_type");
    insertVals.push(relatedType);
  } else if (cols.has("related_table")) {
    insertCols.push("related_table");
    insertVals.push(relatedType);
  }
  if (cols.has("related_entity_id")) {
    insertCols.push("related_entity_id");
    insertVals.push(relatedId);
  } else if (cols.has("related_id")) {
    insertCols.push("related_id");
    insertVals.push(relatedId);
  }
  if (cols.has("meta_json") && meta) {
    insertCols.push("meta_json");
    insertVals.push(JSON.stringify(meta));
  }
  if (cols.has("created_at")) {
    insertCols.push("created_at");
    insertVals.push(new Date());
  }
  if (cols.has("updated_at")) {
    insertCols.push("updated_at");
    insertVals.push(new Date());
  }

  if (!insertCols.length) return;
  const placeholders = insertCols.map(() => "?").join(",");
  await pool.query(
    `INSERT INTO notifications (${insertCols.join(",")}) VALUES (${placeholders})`,
    insertVals
  );
}

function buildReminderSchedule({ scheduledDate, scheduledTime }) {
  const base = new Date(`${scheduledDate}T${scheduledTime || "09:00:00"}`);
  if (Number.isNaN(base.getTime())) return [];
  const plan = [
    { offsetMin: -24 * 60, label: "24h reminder" },
    { offsetMin: -2 * 60, label: "2h reminder" },
    { offsetMin: -15, label: "15m reminder" },
  ];
  return plan
    .map((p) => ({
      label: p.label,
      scheduledAt: new Date(base.getTime() + p.offsetMin * 60 * 1000),
    }))
    .filter((p) => p.scheduledAt.getTime() > Date.now() - 5 * 60 * 1000);
}

async function createReminderJobsIfPossible({
  appointmentId,
  patientId,
  doctorId,
  scheduledDate,
  scheduledTime,
  channels = ["IN_APP", "WHATSAPP", "SMS", "CALL"],
}) {
  if (!(await tableExists("reminder_jobs"))) return { created: 0 };

  const jobs = [];
  const schedule = buildReminderSchedule({ scheduledDate, scheduledTime });
  const channelSet = Array.from(new Set(channels.map((c) => String(c).toUpperCase())));
  const users = [patientId, doctorId].filter((v) => Number.isFinite(Number(v)) && Number(v) > 0);

  for (const userId of users) {
    for (const slot of schedule) {
      for (const channel of channelSet) {
        const dedupe = `reminder:${appointmentId}:${userId}:${channel}:${slot.scheduledAt.toISOString().slice(0, 16)}`;
        const locked = await insertIdempotencyLockIfPossible(dedupe);
        if (!locked) continue;
        await pool.query(
          `
          INSERT INTO reminder_jobs (appointment_id, user_id, channel, status, scheduled_at, meta_json)
          VALUES (?, ?, ?, 'QUEUED', ?, ?)
          `,
          [
            appointmentId,
            userId,
            channel,
            formatDateTime(slot.scheduledAt),
            JSON.stringify({ label: slot.label, dedupeKey: dedupe, source: "appointment_create" }),
          ]
        );
        jobs.push({ userId, channel, scheduledAt: slot.scheduledAt, label: slot.label });
      }
    }
  }

  return { created: jobs.length, jobs };
}

async function applyInventoryConsumptionFromVisit({ appointmentId, doctorId, userId }) {
  const okVisits = await tableExists("visits");
  const okVc = await tableExists("visit_consumables");
  const okInv = await tableExists("inventory_items");
  if (!okVisits || !okVc || !okInv) return { ok: false, reason: "missing tables" };

  if (await hasInventoryConsumedAudit(appointmentId)) {
    return { ok: false, skipped: true, reason: "already_consumed" };
  }

  const visitsCols = await getTableColumns("visits");
  const vIdCol = pickCol(visitsCols, ["id"]);
  const vApptCol = pickCol(visitsCols, ["appointment_id", "appointment_db_id", "appointmentid"]);
  if (!vIdCol || !vApptCol) return { ok: false, reason: "visits schema" };

  const [vrows] = await pool.query(
    `SELECT ${vIdCol} AS id FROM visits WHERE ${vApptCol} = ? ORDER BY ${vIdCol} DESC LIMIT 1`,
    [appointmentId]
  );
  if (!vrows.length) return { ok: false, reason: "no visit" };
  const visitId = Number(vrows[0].id || 0);
  if (!visitId) return { ok: false, reason: "invalid visit" };

  const vcCols = await getTableColumns("visit_consumables");
  const vcVisitCol = pickCol(vcCols, ["visit_id"]);
  const vcItemCol = pickCol(vcCols, ["inventory_item_id", "item_id", "item_code", "inventory_item_code"]);
  const vcQtyCol = pickCol(vcCols, ["qty", "quantity", "quantity_used", "qty_used", "units"]);
  if (!vcVisitCol || !vcItemCol || !vcQtyCol) return { ok: false, reason: "visit_consumables schema" };

  const invCols = await getTableColumns("inventory_items");
  const invIdCol = pickCol(invCols, ["id", "inventory_item_id"]);
  const invCodeCol = pickCol(invCols, ["item_code", "code"]);
  const updateById = vcItemCol.toLowerCase().includes("id") && invIdCol;
  const updateByCode = !updateById && invCodeCol;
  if (!updateById && !updateByCode) return { ok: false, reason: "inventory schema" };

  const [rows] = await pool.query(
    `
    SELECT ${vcItemCol} AS item_ref, ${vcQtyCol} AS qty
    FROM visit_consumables
    WHERE ${vcVisitCol} = ?
    `,
    [visitId]
  );

  const items = (rows || [])
    .map((r) => ({
      itemRef: r.item_ref,
      qty: Number(r.qty || 0),
    }))
    .filter((r) => r.itemRef && Number.isFinite(r.qty) && r.qty > 0);

  if (!items.length) return { ok: false, reason: "no consumables" };

  const usageByRef = new Map();
  for (const it of items) {
    const k = String(it.itemRef);
    usageByRef.set(k, (usageByRef.get(k) || 0) + Number(it.qty || 0));
  }
  const dedupeItems = Array.from(usageByRef.entries()).map(([itemRef, qty]) => ({ itemRef, qty }));

  const conn = await pool.getConnection();
  const touchedRefs = [];
  let updated = 0;
  try {
    await conn.beginTransaction();

    for (const it of dedupeItems) {
      const q = Math.floor(Number(it.qty || 0));
      if (!q || q <= 0) continue;

      if (updateById) {
        await conn.query(
          `UPDATE inventory_items SET stock = stock - ? WHERE ${invIdCol} = ?`,
          [q, it.itemRef]
        );
        touchedRefs.push({ by: "id", value: it.itemRef, qty: q });
      } else {
        await conn.query(
          `UPDATE inventory_items SET stock = stock - ? WHERE ${invCodeCol} = ?`,
          [q, it.itemRef]
        );
        touchedRefs.push({ by: "code", value: it.itemRef, qty: q });
      }
      updated += 1;
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  if (updated > 0) {
    await writeInventoryConsumedAudit({
      appointmentId,
      userId: userId || null,
      meta: { visitId, doctorId: doctorId || null, items },
    });
  }

  // Low stock notifications (inline fallback)
  let usageRowsInserted = 0;
  if (touchedRefs.length) {
    const invCols = await getTableColumns("inventory_items");
    const invIdCol = pickCol(invCols, ["id", "inventory_item_id"]);
    const invCodeCol = pickCol(invCols, ["item_code", "code"]);
    const invNameCol = pickCol(invCols, ["name", "item_name"]);
    const invStockCol = pickCol(invCols, ["stock", "current_stock", "qty_on_hand"]);
    const invThCol = pickCol(invCols, ["low_stock_threshold", "reorder_threshold", "reorder_level"]);

    for (const ref of touchedRefs) {
      if (!invStockCol || !invThCol) continue;
      const whereCol = ref.by === "id" ? invIdCol : invCodeCol;
      if (!whereCol) continue;
      const [r] = await pool.query(
        `
        SELECT ${invIdCol ? `${invIdCol} AS id,` : "NULL AS id,"}
               ${invCols.has("vendor_id") ? "vendor_id AS vendor_id," : "NULL AS vendor_id,"}
               ${invCodeCol ? `${invCodeCol} AS code,` : "NULL AS code,"}
               ${invNameCol ? `${invNameCol} AS name,` : "NULL AS name,"}
               ${invStockCol} AS stock,
               ${invThCol} AS threshold
        FROM inventory_items
        WHERE ${whereCol} = ?
        LIMIT 1
        `,
        [ref.value]
      );
      const row = r?.[0];
      if (!row) continue;
      const logRes = await insertInventoryUsageLogFromDeduction({
        appointmentId,
        visitId,
        doctorId: doctorId || null,
        itemId: Number.isFinite(Number(row.id)) ? Number(row.id) : null,
        itemCode: row.code || (ref.by === "code" ? String(ref.value) : null),
        qtyUsed: ref.qty,
        eventId: null,
        sourceType: "VISIT_CONSUMABLES",
      });
      if (logRes?.ok) usageRowsInserted += 1;

      const stock = Number(row.stock ?? 0);
      const threshold = Number(row.threshold ?? 0);
      if (!Number.isFinite(stock) || !Number.isFinite(threshold)) continue;
      if (stock <= threshold) {
        await emitLowStockNotification({
          itemId: Number(row.id || 0),
          itemName: row.name || "Inventory item",
          stock,
          threshold,
        });
        await ensureLowStockPoDraft({
          itemId: Number(row.id || 0) || null,
          itemCode: row.code || (ref.by === "code" ? String(ref.value) : null),
          vendorId: row.vendor_id != null ? Number(row.vendor_id) : null,
          stock,
          threshold,
        });
      }
    }
  }
  const [recentUsageRows] = await pool.query(
    `SELECT id, appointment_id, visit_id, item_code, qty_used, created_at
     FROM inventory_usage_logs
     ORDER BY id DESC
     LIMIT 5`
  );
  return { ok: true, updated, usageRowsInserted, recentUsageLogs: recentUsageRows || [] };
}

// ===================================
// MAILER (OTP + NOTIFICATIONS)
// ===================================
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure =
  String(process.env.SMTP_SECURE || "").trim() === "1" ||
  String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true" ||
  smtpPort === 465;
const brevoApiKey =
  process.env.BREVO_API_KEY ||
  process.env.SENDINBLUE_API_KEY ||
  "";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Optional verify (won’t crash server)
(async () => {
  try {
    if (brevoApiKey) {
      console.log("ℹ️ Using Brevo API for email delivery (SMTP verify skipped).");
      return;
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.verify();
      console.log("✅ SMTP transporter verified");
    } else {
      console.warn("⚠️ SMTP not fully configured (SMTP_HOST/SMTP_USER/SMTP_PASS). Emails may fail.");
    }
  } catch (e) {
    console.error("❌ SMTP verify failed:", e?.message || e);
  }
})();

function parseMailFrom(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return { name: "Dental Clinic AI", email: String(process.env.SMTP_USER || "").trim() };
  }
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^\"|\"$/g, ""), email: match[2].trim() };
  }
  return { name: "Dental Clinic AI", email: value };
}

async function sendEmail({ to, subject, html, text, from }) {
  if (brevoApiKey) {
    const sender = parseMailFrom(from || process.env.MAIL_FROM || process.env.SMTP_USER);
    const payload = {
      sender,
      to: [{ email: String(to).trim() }],
      subject: String(subject || ""),
      htmlContent: String(html || ""),
    };
    if (text) payload.textContent = String(text);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo API error: ${res.status} ${body}`);
    }
    return;
  }

  await transporter.sendMail({
    from: from || process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
}

// Generate 6-digit OTP like "483920"
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ============ EMAIL TEMPLATES ============
function buildOtpEmailHtml(name, code) {
  const safeName = (name || "there").toString();
  const safeCode = String(code || "");
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="margin:0 0 10px 0">Password reset</h2>
    <p style="margin:0 0 12px 0">Hi ${safeName},</p>
    <p style="margin:0 0 12px 0">Use this OTP to reset your password:</p>
    <div style="font-size:28px;font-weight:700;letter-spacing:3px;padding:12px 16px;border:1px solid #e5e7eb;border-radius:10px;display:inline-block">
      ${safeCode}
    </div>
    <p style="margin:12px 0 0 0;color:#6b7280">This code expires in 10 minutes.</p>
  </div>`;
}

function buildEmailVerificationHtml(name, code) {
  const safeName = (name || "there").toString();
  const safeCode = String(code || "");
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="margin:0 0 10px 0">Email verification</h2>
    <p style="margin:0 0 12px 0">Hi ${safeName},</p>
    <p style="margin:0 0 12px 0">Use this code to verify your email:</p>
    <div style="font-size:28px;font-weight:700;letter-spacing:3px;padding:12px 16px;border:1px solid #e5e7eb;border-radius:10px;display:inline-block">
      ${safeCode}
    </div>
    <p style="margin:12px 0 0 0;color:#6b7280">This code expires in 10 minutes.</p>
  </div>`;
}

function buildPasswordChangedEmailHtml(name) {
  const safeName = (name || "there").toString();
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="margin:0 0 10px 0">Password changed</h2>
    <p style="margin:0 0 12px 0">Hi ${safeName},</p>
    <p style="margin:0 0 12px 0">Your Dental Clinic AI account password was changed successfully.</p>
    <p style="margin:0;color:#6b7280">If this wasn’t you, contact your clinic/admin immediately.</p>
  </div>`;
}

// ===================================
// HELPERS
// ===================================
const signupOtpStore = new Map(); // email -> { code, expiresAt, verified? }

function generateUid(role) {
  const n = Math.floor(1000 + Math.random() * 9000);
  if (role === "Admin") return `AD-${n}`;
  if (role === "Doctor") return `DC-${n}`;
  if (role === "Assistant") return `AS-${n}`;
  return `PT-${n}`;
}

function normalizeRoleFromClient(role) {
  // Client may send: Admin/Doctor/Patient/Assistant OR ADMIN/DOCTOR/PATIENT/ASSISTANT
  if (!role) return "Patient";
  const r = String(role).trim();
  const u = r.toUpperCase();
  if (u === "ADMIN" || r === "Admin") return "Admin";
  if (u === "DOCTOR" || r === "Doctor") return "Doctor";
  if (u === "ASSISTANT" || r === "Assistant") return "Assistant";
  return "Patient";
}

function normalizeRoleToClient(dbRole) {
  if (dbRole === "Admin") return "ADMIN";
  if (dbRole === "Doctor") return "DOCTOR";
  if (dbRole === "Assistant") return "ASSISTANT";
  return "PATIENT";
}

function createTokenForUser(user) {
  const payload = {
    id: user.id,
    uid: user.uid,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

// Helper to avoid 500 when SQL schema is incomplete
async function safeQuery(label, sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.error(`${label} SQL ERROR:`, err);
    return [];
  }
}

// ===================================
// ✅ ADDITIVE SCHEMA FIXES (won’t remove/change existing data)
// ===================================
async function ensureUsersResetSchema() {
  // Your forgot/reset uses users.reset_code + users.reset_expires
  const alterSafe = async (sql) => {
    try {
      await pool.query(sql);
    } catch (_) { }
  };
  await alterSafe(`ALTER TABLE users ADD COLUMN reset_code VARCHAR(12) NULL`);
  await alterSafe(`ALTER TABLE users ADD COLUMN reset_expires DATETIME NULL`);
}
ensureUsersResetSchema().catch((e) => console.error("ensureUsersResetSchema failed:", e?.message || e));

// ===================================
// ✅ agent_events schema (align to MariaDB authoritative enum)
// ===================================
async function ensureAgentEventsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_type VARCHAR(64) NOT NULL,
        payload_json LONGTEXT NULL,

        -- ✅ authoritative status set (NO PENDING)
        status ENUM('NEW','PROCESSING','DONE','FAILED','DEAD') NOT NULL DEFAULT 'NEW',

        available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        locked_by VARCHAR(64) NULL,
        locked_until DATETIME NULL,

        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 7,
        priority INT NOT NULL DEFAULT 100,
        last_error TEXT NULL,

        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        KEY idx_status_available (status, available_at),
        KEY idx_locked_until (locked_until),
        KEY idx_event_type (event_type),
        KEY idx_created_at (created_at)
      ) ENGINE=InnoDB;
    `);

    // Cache enum values for later inserts (optional but helpful)
    await getEnumValues("agent_events", "status");

    console.log("✅ agent_events schema ready (NEW/PROCESSING/DONE/FAILED/DEAD)");
  } catch (e) {
    console.error("ensureAgentEventsSchema failed:", e?.message || e);
  }
}
ensureAgentEventsSchema();


// ===================================
// ✅ COMPAT HELPERS (works even if ./agents is missing)
// ===================================
// ===================================
// ✅ DB outbox enqueue (Python worker)
// ===================================
function normalizeAgentEventPayload(eventType, payload, createdByUserId = null) {
  const base = { ...(payload || {}) };
  const entityType =
    base.entityType ||
    (base.caseId || base.caseDbId ? "cases" : null) ||
    (base.appointmentId ? "appointments" : null) ||
    (base.invoiceId ? "invoices" : null) ||
    (base.itemId || base.item_code || base.itemCode ? "inventory_items" : null) ||
    null;
  const entityId =
    base.entityId ??
    base.caseId ??
    base.caseDbId ??
    base.appointmentId ??
    base.invoiceId ??
    base.itemId ??
    null;
  const clinicId = base.clinicId ?? base.clinic_id ?? null;
  const actorUserId = base.actorUserId ?? base.actor_user_id ?? createdByUserId ?? null;
  const traceId =
    base.traceId ||
    `${String(eventType || "event")}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  return {
    ...base,
    entityType,
    entityId,
    clinicId,
    actorUserId,
    traceId,
    __meta: {
      createdByUserId: createdByUserId || null,
      createdAt: new Date().toISOString(),
    },
  };
}

async function enqueueEventDb(eventType, payload, createdByUserId = null) {
  const safePayload = normalizeAgentEventPayload(eventType, payload, createdByUserId);

  // choose correct "new" status from real enum
  const statusValues = await getEnumValues("agent_events", "status");
  const NEW_STATUS = pickEnumValue(statusValues, ["NEW", "PENDING"], "NEW"); // fallback NEW
  const cols = await getTableColumns("agent_events");

  if (cols.has("created_by_user_id")) {
    await pool.query(
      `
      INSERT INTO agent_events (event_type, payload_json, status, available_at, locked_by, locked_until, created_by_user_id)
      VALUES (?, ?, ?, NOW(), NULL, NULL, ?)
      `,
      [String(eventType), JSON.stringify(safePayload), NEW_STATUS, createdByUserId || null]
    );
  } else {
    await pool.query(
      `
      INSERT INTO agent_events (event_type, payload_json, status, available_at, locked_by, locked_until)
      VALUES (?, ?, ?, NOW(), NULL, NULL)
      `,
      [String(eventType), JSON.stringify(safePayload), NEW_STATUS]
    );
  }
}


async function enqueueEventCompat({ eventType, payload, createdByUserId }) {
  // ✅ If optional Node queue exists, try it
  if (typeof enqueueEvent === "function") {
    try {
      await enqueueEvent(pool, eventType, payload, { createdByUserId: createdByUserId || null });
      return;
    } catch (e1) {
      try {
        await enqueueEvent(pool, { eventType, payload, createdByUserId: createdByUserId || null });
        return;
      } catch (e2) {
        console.error("enqueueEventCompat -> enqueueEvent failed; fallback DB outbox:", e2?.message || e2);
      }
    }
  }

  // ✅ Always works: DB outbox for Python worker
  await enqueueEventDb(eventType, payload, createdByUserId || null);
}


async function retryFailedCompat(limit = 100) {
  const fn = retryFailedFromAgentsIndex || retryFailedFromEventQueue;

  if (typeof fn === "function") {
    try {
      const r = await fn(pool, { limit });
      if (typeof r === "number") return r;
      if (r && typeof r.updated === "number") return r.updated;
      if (r && typeof r.retried === "number") return r.retried;
      return 0;
    } catch (e1) {
      try {
        const r = await fn(pool, limit);
        return typeof r === "number" ? r : 0;
      } catch (e2) {
        console.error("retryFailedCompat failed:", e2?.message || e2);
      }
    }
    return 0;
  }

  // ✅ Fallback: FAILED -> NEW (schema-safe)
  try {
    const statusValues = await getEnumValues("agent_events", "status");
    const NEW_STATUS = pickEnumValue(statusValues, ["NEW", "PENDING"], "NEW");

    const [r] = await pool.query(
      `
      UPDATE agent_events
      SET status = ?,
          available_at = NOW(),
          locked_by = NULL,
          locked_until = NULL,
          last_error = NULL
      WHERE status = 'FAILED'
      ORDER BY id ASC
      LIMIT ?
      `,
      [NEW_STATUS, Number(limit) || 100]
    );

    return r?.affectedRows || 0;
  } catch (e) {
    console.error("retryFailedCompat fallback failed:", e?.message || e);
    return 0;
  }
}


// ===================================
// ✅ NOTIFICATIONS SCHEMA (safe, additive)
// ===================================
async function ensureNotificationsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT NULL,
        user_role VARCHAR(16) NULL,
        channel ENUM('IN_APP','EMAIL','SMS','WHATSAPP','CALL') NOT NULL DEFAULT 'IN_APP',
        type VARCHAR(64) NULL,
        title VARCHAR(200) NULL,
        message TEXT NOT NULL,
        status ENUM('NEW','PENDING','SENT','FAILED','READ') NOT NULL DEFAULT 'NEW',
        scheduled_at DATETIME NULL,
        read_at DATETIME NULL,
        priority INT NOT NULL DEFAULT 100,
        related_entity_type VARCHAR(40) NULL,
        related_entity_id BIGINT NULL,
        template_key VARCHAR(64) NULL,
        template_vars_json LONGTEXT NULL,
        meta_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user (user_id),
        KEY idx_role (user_role),
        KEY idx_status (status),
        KEY idx_created_at (created_at),
        KEY idx_scheduled_at (scheduled_at)
      ) ENGINE=InnoDB;
    `);

    const alterSafe = async (sql) => {
      try {
        await pool.query(sql);
      } catch (_) { }
    };

    await alterSafe(`ALTER TABLE notifications MODIFY COLUMN status ENUM('NEW','PENDING','SENT','FAILED','READ') NOT NULL DEFAULT 'NEW'`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN user_role VARCHAR(16) NULL AFTER user_id`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN type VARCHAR(64) NULL AFTER channel`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN title VARCHAR(200) NULL AFTER type`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN scheduled_at DATETIME NULL AFTER status`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN read_at DATETIME NULL AFTER scheduled_at`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN priority INT NOT NULL DEFAULT 100 AFTER read_at`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN related_entity_type VARCHAR(40) NULL AFTER priority`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN related_entity_id BIGINT NULL AFTER related_entity_type`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN template_key VARCHAR(64) NULL AFTER related_entity_id`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN template_vars_json LONGTEXT NULL AFTER template_key`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN meta_json LONGTEXT NULL AFTER template_vars_json`);
    await alterSafe(`ALTER TABLE notifications ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    await alterSafe(`ALTER TABLE notifications ADD KEY idx_role (user_role)`);
    await alterSafe(`ALTER TABLE notifications ADD KEY idx_scheduled_at (scheduled_at)`);

    console.log("✅ Notifications schema ready");
  } catch (e) {
    console.error("ensureNotificationsSchema failed:", e?.message || e);
  }
}
ensureNotificationsSchema();

// ===================================
// ✅ CASE ATTACHMENTS SCHEMA (safe, additive)
// ===================================
async function ensureCaseAttachmentsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS case_attachments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        case_id BIGINT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        mime_type VARCHAR(120) NULL,
        uploaded_by_user_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_case (case_id),
        KEY idx_created_at (created_at)
      ) ENGINE=InnoDB;
    `);
  } catch (e) {
    console.error("ensureCaseAttachmentsSchema failed:", e?.message || e);
  }
}
ensureCaseAttachmentsSchema();

// ===================================
// ✅ CLINIC SETUP + ROLES/PERMISSIONS (safe, additive)
// ===================================
async function ensureClinicSetupSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_settings (
        id TINYINT NOT NULL,
        clinic_name VARCHAR(120) NULL,
        clinic_phone VARCHAR(40) NULL,
        clinic_email VARCHAR(190) NULL,
        clinic_address TEXT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
        working_hours_json LONGTEXT NULL,
        treatment_catalog_json LONGTEXT NULL,
        note_templates_json LONGTEXT NULL,
        ai_preferences_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`INSERT IGNORE INTO clinic_settings (id, timezone) VALUES (1, 'Asia/Kolkata')`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role ENUM('Admin','Doctor','Assistant','Patient') NOT NULL,
        permissions_json LONGTEXT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (role)
      ) ENGINE=InnoDB;
    `);

    // Seed defaults (idempotent)
    await pool.query(
      `INSERT IGNORE INTO role_permissions (role, permissions_json) VALUES
        ('Admin', '{"admin_all":true}'),
        ('Doctor', '{"doctor_portal":true,"cases":true,"appointments":true}'),
        ('Assistant', '{"assistant_portal":true,"inventory":true,"appointments":true}'),
        ('Patient', '{"patient_portal":true,"appointments":true,"billing":true}')`
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS patient_profiles (
        user_id BIGINT UNSIGNED NOT NULL,
        medical_history TEXT NULL,
        allergies TEXT NULL,
        notes TEXT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
      ) ENGINE=InnoDB;
    `);

    console.log('✅ clinic_settings + role_permissions + patient_profiles ready');
  } catch (e) {
    console.error('ensureClinicSetupSchema failed:', e?.message || e);
  }
}
ensureClinicSetupSchema();

// ===================================
// Agent feature tables (additive, safe)
// ===================================
async function ensureAgentFeatureTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointment_recommendations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        appointment_id BIGINT UNSIGNED NULL,
        doctor_id BIGINT UNSIGNED NULL,
        recommended_start DATETIME NOT NULL,
        recommended_end DATETIME NULL,
        reason VARCHAR(255) NULL,
        confidence INT NOT NULL DEFAULT 50,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_appt_rec_doctor (doctor_id, created_at),
        KEY idx_appt_rec_appt (appointment_id)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminder_jobs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        appointment_id BIGINT UNSIGNED NULL,
        user_id BIGINT UNSIGNED NULL,
        channel ENUM('IN_APP','EMAIL','SMS','WHATSAPP','CALL') NOT NULL DEFAULT 'IN_APP',
        status ENUM('QUEUED','SENT','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
        scheduled_at DATETIME NOT NULL,
        sent_at DATETIME NULL,
        meta_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_reminder_appt (appointment_id, scheduled_at),
        KEY idx_reminder_user (user_id, status),
        KEY idx_reminder_status (status, scheduled_at)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_anomalies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        item_code VARCHAR(64) NOT NULL,
        doctor_id BIGINT UNSIGNED NULL,
        procedure_code VARCHAR(64) NULL,
        anomaly_type VARCHAR(64) NOT NULL,
        severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
        score DECIMAL(6,2) NOT NULL DEFAULT 0,
        meta_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_inventory_anomaly_item (item_code, created_at),
        KEY idx_inventory_anomaly_doctor (doctor_id, created_at)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS revenue_anomalies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        invoice_id BIGINT UNSIGNED NULL,
        appointment_id BIGINT UNSIGNED NULL,
        anomaly_type VARCHAR(64) NOT NULL,
        severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
        estimated_loss DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        meta_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_revenue_anomaly_invoice (invoice_id, created_at),
        KEY idx_revenue_anomaly_appt (appointment_id, created_at)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS case_documents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        case_id BIGINT UNSIGNED NOT NULL,
        doc_type ENUM('clinical_summary','patient_explanation','consent','post_op') NOT NULL,
        content LONGTEXT NULL,
        status ENUM('DRAFT','READY','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
        created_by_agent_event_id BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_case_doc (case_id, doc_type),
        KEY idx_case_doc_created (created_at)
      ) ENGINE=InnoDB;
    `);

    console.log("Agent feature tables ready");
  } catch (e) {
    console.error("ensureAgentFeatureTables failed:", e?.message || e);
  }
}
ensureAgentFeatureTables();

// ===================================
// ✅ Schema capability detection (to keep conflict logic robust across DB versions)
// ===================================
const schemaCaps = {
  appointments_has_scheduled_end_time: true,
  appointments_has_operatory_id: true,
};

async function detectSchemaCaps() {
  try {
    const [cols] = await pool.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'appointments'
      `
    );
    const set = new Set((cols || []).map((r) => String(r.COLUMN_NAME || "").toLowerCase()));
    schemaCaps.appointments_has_scheduled_end_time = set.has("scheduled_end_time");
    schemaCaps.appointments_has_operatory_id = set.has("operatory_id");
  } catch (_) {
    // defaults remain true; conflict checks are wrapped anyway
  }
}
detectSchemaCaps();

// ===================================
// HEALTH CHECK
// ===================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", tz: APP_TZ, today: formatDateYYYYMMDD() });
});

// ===================================
// SIGN-UP EMAIL OTP (for Create Account)
// ===================================
const SIGNUP_OTP_BYPASS =
  String(process.env.SIGNUP_OTP_BYPASS || "").trim() === "1" ||
  String(process.env.SIGNUP_OTP_BYPASS || "").trim().toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

app.post("/api/auth/email-otp/request", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existing] = await pool.query("SELECT id, full_name FROM users WHERE email = ?", [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered. Please login instead." });
    }

    if (SIGNUP_OTP_BYPASS) {
      // Local/dev bypass: allow signup flow without external mail dependency.
      signupOtpStore.set(normalizedEmail, {
        code: "000000",
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        verified: true,
      });
      return res.json({ message: "OTP bypass enabled. Email marked verified for signup." });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    signupOtpStore.set(normalizedEmail, { code: otp, expiresAt });

    const html = buildEmailVerificationHtml(null, otp);

    await sendEmail({
      from: process.env.MAIL_FROM || '"Dental Clinic AI" <no-reply@clinic.ai>',
      to: normalizedEmail,
      subject: "Verify your Dental Clinic AI email",
      html,
      text: `Your Dental Clinic AI email verification code is ${otp}. It expires in 10 minutes.`,
    });

    return res.json({ message: "Verification code sent" });
  } catch (err) {
    console.error("EMAIL OTP REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/email-otp/verify", (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required", valid: false });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (SIGNUP_OTP_BYPASS) {
      signupOtpStore.set(normalizedEmail, {
        code: String(otp || "000000"),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        verified: true,
      });
      return res.json({ message: "OTP bypass enabled", valid: true });
    }

    const entry = signupOtpStore.get(normalizedEmail);

    if (!entry) {
      return res.status(400).json({ message: "No verification code for this email", valid: false });
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      signupOtpStore.delete(normalizedEmail);
      return res.status(400).json({ message: "Code has expired", valid: false });
    }

    if (entry.code !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid code", valid: false });
    }

    signupOtpStore.set(normalizedEmail, { ...entry, verified: true });
    return res.json({ message: "Email verified", valid: true });
  } catch (err) {
    console.error("EMAIL OTP VERIFY ERROR:", err);
    return res.status(500).json({ message: "Server error", valid: false });
  }
});

// ===================================
// REGISTER / LOGIN / PASSWORD FLOWS
// ===================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { role, fullName, email, phone, dob, gender, address, password } = req.body || {};

    if (!role || !fullName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const roleDb = normalizeRoleFromClient(role);
    if (!["Admin", "Doctor", "Patient"].includes(roleDb)) {
      return res.status(400).json({
        message: "Invalid role",
        allowed: ["ADMIN", "DOCTOR", "PATIENT"],
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const uid = generateUid(roleDb);

    const [result] = await pool.query(
      `INSERT INTO users
        (uid, full_name, email, phone, dob, gender, address, role, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        String(fullName).trim(),
        normalizedEmail,
        phone ? String(phone).trim() : null,
        dob ? String(dob).trim() : null,
        gender ? String(gender).trim() : null,
        address ? String(address).trim() : null,
        roleDb,
        passwordHash,
      ]
    );

    const newUserId = result.insertId;

    const token = createTokenForUser({
      id: newUserId,
      uid,
      role: roleDb,
    });

    return res.status(201).json({
      message: "User created",
      uid,
      name: String(fullName).trim(),
      email: normalizedEmail,
      role: normalizeRoleToClient(roleDb),
      token,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body || {};

    if (!email || !password || !role) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const roleDb = normalizeRoleFromClient(role);
    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? AND role = ?", [normalizedEmail, roleDb]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email, password, or role" });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email, password, or role" });
    }

    const token = createTokenForUser(user);

    return res.json({
      token,
      uid: user.uid,
      name: user.full_name,
      email: user.email,
      role: normalizeRoleToClient(user.role),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query("SELECT id, full_name, email FROM users WHERE email = ?", [normalizedEmail]);

    // ✅ Don’t reveal existence (security). Same response either way.
    if (rows.length === 0) {
      return res.json({ message: "If that email exists, an OTP has been sent." });
    }

    const user = rows[0];
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query("UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?", [otp, expires, user.id]);

    const html = buildOtpEmailHtml(user.full_name, otp);

    await sendEmail({
      from: process.env.MAIL_FROM || '"Dental Clinic AI" <no-reply@clinic.ai>',
      to: user.email,
      subject: "Your Dental Clinic AI password reset code",
      html,
      text: `Your Dental Clinic AI password reset code is ${otp}. It expires in 10 minutes.`,
    });

    return res.json({ message: "If that email exists, an OTP has been sent." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query("SELECT id, reset_code, reset_expires FROM users WHERE email = ?", [normalizedEmail]);

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid email or code" });
    }

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires) {
      return res.status(400).json({ message: "No active reset code for this email" });
    }

    const now = Date.now();
    const expiresAt = new Date(user.reset_expires).getTime();

    if (String(user.reset_code) !== String(otp)) {
      return res.status(400).json({ message: "Invalid code" });
    }

    if (now > expiresAt) {
      return res.status(400).json({ message: "Code has expired" });
    }

    return res.json({ message: "Code verified" });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query(
      "SELECT id, full_name, reset_code, reset_expires FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid email or code" });
    }

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires) {
      return res.status(400).json({ message: "No active reset code for this email" });
    }

    const now = Date.now();
    const expiresAt = new Date(user.reset_expires).getTime();

    if (String(user.reset_code) !== String(otp)) {
      return res.status(400).json({ message: "Invalid code" });
    }

    if (now > expiresAt) {
      return res.status(400).json({ message: "Code has expired" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?",
      [passwordHash, user.id]
    );

    try {
      const html = buildPasswordChangedEmailHtml(user.full_name);
      await sendEmail({
        from: process.env.MAIL_FROM || '"Dental Clinic AI" <no-reply@clinic.ai>',
        to: normalizedEmail,
        subject: "Your Dental Clinic AI password was changed",
        html,
        text: "Your Dental Clinic AI account password was just changed. If this was not you, contact your clinic or administrator immediately.",
      });
    } catch (emailErr) {
      console.error("PASSWORD CHANGE EMAIL ERROR:", emailErr);
    }

    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ===================================
// AUTH MIDDLEWARE  ✅ header token + optional query token (SSE safe)
// ===================================
// ===================================
// AUTH MIDDLEWARE  ✅ header token + optional query token (SSE safe)
// ===================================
const PUBLIC_PREFIXES = [
  "/api/health",
  "/debug/routes",

  // auth endpoints must be public
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
  "/api/auth/email-otp/request",
  "/api/auth/email-otp/verify",

  // static uploads should be public (or keep it protected if you want)
  "/uploads",
];

function isPublicPath(req) {
  const p = String(req.path || "");
  return PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x + "/"));
}

function authMiddleware(req, res, next) {
  // ✅ IMPORTANT: never require JWT for login/register/otp endpoints
  if (isPublicPath(req)) return next();

  const authHeader = req.headers.authorization || "";
  const tokenFromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const tokenFromQuery = req.query?.token ? String(req.query.token) : ""; // SSE support
  const token = tokenFromHeader || tokenFromQuery;

  if (!token) {
    return res.status(401).json({ message: "Missing token", code: "NO_TOKEN" });
  }

  try {
    // clockTolerance helps small system clock skews (common on new laptops)
    const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 60 });
    req.user = decoded;
    return next();
  } catch (err) {
    const msg = err?.message || "Invalid or expired token";

    // ✅ Make expired-token explicit so frontend can auto-logout/redirect
    if (err?.name === "TokenExpiredError") {
      console.error("AUTH ERROR:", msg);
      return res.status(401).json({
        message: "Token expired. Please login again.",
        code: "TOKEN_EXPIRED",
      });
    }

    console.error("AUTH ERROR:", msg);
    return res.status(401).json({ message: "Invalid token", code: "INVALID_TOKEN" });
  }
}


app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const userUid = req.user?.uid || null;

    if (!userId && !userUid) {
      return res.json({ user: req.user });
    }

    const rows = await safeQuery(
      "AUTH ME",
      "SELECT id, uid, full_name, email, role FROM users WHERE id = ? OR uid = ? LIMIT 1",
      [userId, userUid]
    );

    if (!rows || rows.length === 0) {
      return res.json({ user: req.user });
    }

    const dbUser = rows[0];
    return res.json({
      user: {
        id: dbUser.id,
        uid: dbUser.uid,
        name: dbUser.full_name,
        email: dbUser.email,
        role: normalizeRoleToClient(dbUser.role),
      },
    });
  } catch (err) {
    console.error("AUTH ME ERROR:", err);
    return res.json({ user: req.user });
  }
});

// Admin-only: run schema import inside Railway (remove after use)
app.post("/api/admin/run-schema", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    await runSchemaOnce();
    return res.json({ ok: true });
  } catch (err) {
    console.error("RUN SCHEMA ERROR:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Schema import failed" });
  }
});

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

const requireAuth = authMiddleware;

// ===================================
// ✅ NOTIFICATIONS API
// ===================================
app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const includeRead = String(req.query.includeRead || "1") === "1";
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "200"), 10) || 200, 1), 500);

    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = String(userRole || "").toLowerCase() === "admin";
    const globalClause = isAdmin ? "OR (user_id IS NULL AND user_role IS NULL)" : "";
    const inventoryFilterClause = isAdmin ? "" : "AND (type IS NULL OR type NOT LIKE 'INVENTORY_%')";

    const rows = await safeQuery(
      "NOTIFICATIONS LIST",
      `
      SELECT
        id, channel, type, title, message, status,
        related_entity_type,
        related_entity_id,
        DATE_FORMAT(scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduled_at,
        DATE_FORMAT(read_at, '%Y-%m-%d %H:%i:%s') AS read_at,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM notifications
      WHERE (
        user_id = ?
        OR (user_id IS NULL AND user_role = ?)
        ${globalClause}
      )
      AND (${includeRead ? "1=1" : "status <> 'READ'"})
      ${inventoryFilterClause}
      ORDER BY id DESC
      LIMIT ?
      `,
      [userId, userRole, limit]
    );

    res.json({ items: rows });
  } catch (e) {
    console.error("GET /api/notifications error:", e);
    res.json({ items: [], error: true });
  }
});

app.post("/api/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = String(userRole || "").toLowerCase() === "admin";
    const globalClause = isAdmin ? "OR (user_id IS NULL AND user_role IS NULL)" : "";
    const inventoryFilterClause = isAdmin ? "" : "AND (type IS NULL OR type NOT LIKE 'INVENTORY_%')";
    const id = Number(req.params.id);

    await pool.query(
      `
      UPDATE notifications
      SET status='READ', read_at=NOW()
      WHERE id = ?
        AND (
          user_id = ?
          OR (user_id IS NULL AND user_role = ?)
          ${globalClause}
        )
        ${inventoryFilterClause}
      `,
      [id, userId, userRole]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("POST read notification error:", e);
    res.json({ ok: false, error: true });
  }
});

app.post("/api/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = String(userRole || "").toLowerCase() === "admin";
    const globalClause = isAdmin ? "OR (user_id IS NULL AND user_role IS NULL)" : "";
    const inventoryFilterClause = isAdmin ? "" : "AND (type IS NULL OR type NOT LIKE 'INVENTORY_%')";

    await pool.query(
      `
      UPDATE notifications
      SET status='READ', read_at=NOW()
      WHERE status <> 'READ'
        AND (
          user_id = ?
          OR (user_id IS NULL AND user_role = ?)
          ${globalClause}
        )
        ${inventoryFilterClause}
      `,
      [userId, userRole]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("POST read-all notifications error:", e);
    res.json({ ok: false, error: true });
  }
});

// ===================================
// ✅ REALTIME SSE (NO websockets)
// ===================================
app.get("/api/events/stream", authMiddleware, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const userId = req.user.id;
  const userRole = req.user.role;
  const isAdmin = String(userRole || "").toLowerCase() === "admin";
  const globalClause = isAdmin ? "OR (user_id IS NULL AND user_role IS NULL)" : "";
  const inventoryFilterClause = isAdmin ? "" : "AND (type IS NULL OR type NOT LIKE 'INVENTORY_%')";

  let lastId = 0;
  let alive = true;

  req.on("close", () => {
    alive = false;
  });

  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const interval = setInterval(async () => {
    if (!alive) return clearInterval(interval);

    const rows = await safeQuery(
      "SSE notifications",
      `
      SELECT id, type, title, message, status,
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM notifications
      WHERE id > ?
        AND (
          user_id = ?
          OR (user_id IS NULL AND user_role = ?)
          ${globalClause}
        )
        ${inventoryFilterClause}
      ORDER BY id ASC
      LIMIT 25
      `,
      [lastId, userId, userRole]
    );

    for (const n of rows) {
      lastId = n.id;
      res.write(`event: notification\n`);
      res.write(`data: ${JSON.stringify(n)}\n\n`);
    }

    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 3000);
});

// ===================================
// ADMIN ROUTES
// ===================================
const ADMIN_BASE = "/api/admin";






// ===================================
// ✅ ADMIN: CONSUMABLES (procedure -> inventory usage templates)
// Requires tables: procedure_catalog, procedure_consumables, inventory_items
// ===================================
app.get(
  `${ADMIN_BASE}/consumables/procedures`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const ok = await tableExists("procedure_catalog");
      if (!ok) return res.status(501).json({ message: "procedure_catalog table not found" });

      const cols = await getTableColumns("procedure_catalog");
      const idCol = pickCol(cols, ["id", "procedure_id"]);
      const codeCol = pickCol(cols, ["code", "procedure_code"]);
      const nameCol = pickCol(cols, ["name", "procedure_name", "title"]);
      const priceCol = pickCol(cols, ["default_price", "price", "amount"]);

      // Choose a stable key to return to frontend
      const keyExpr = idCol ? `p.${idCol}` : codeCol ? `p.${codeCol}` : "p.id";

      const rows = await safeQuery(
        "ADMIN PROCEDURE_CATALOG",
        `
        SELECT
          ${keyExpr} AS procedure_key,
          ${codeCol ? `p.${codeCol} AS code,` : "NULL AS code,"}
          ${nameCol ? `p.${nameCol} AS name,` : "NULL AS name,"}
          ${priceCol ? `p.${priceCol} AS default_price` : "NULL AS default_price"}
        FROM procedure_catalog p
        ORDER BY ${nameCol ? `p.${nameCol}` : "procedure_key"} ASC
        LIMIT 2000
        `,
        []
      );

      return res.json({ items: rows || [] });
    } catch (e) {
      console.error("GET /admin/consumables/procedures error:", e);
      return res.json({ items: [], error: true });
    }
  }
);

app.get(
  `${ADMIN_BASE}/consumables/inventory-items`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const ok = await tableExists("inventory_items");
      if (!ok) return res.status(501).json({ message: "inventory_items table not found" });

      const cols = await getTableColumns("inventory_items");
      const idCol = pickCol(cols, ["id", "inventory_item_id"]);
      const codeCol = pickCol(cols, ["item_code", "code"]);
      const nameCol = pickCol(cols, ["name", "item_name"]);
      const catCol = pickCol(cols, ["category"]);
      const stockCol = pickCol(cols, ["stock"]);

      const keyExpr = idCol ? `i.${idCol}` : codeCol ? `i.${codeCol}` : "i.id";

      const rows = await safeQuery(
        "ADMIN INVENTORY_ITEMS PICKER",
        `
        SELECT
          ${keyExpr} AS item_key,
          ${codeCol ? `i.${codeCol} AS item_code,` : "NULL AS item_code,"}
          ${nameCol ? `i.${nameCol} AS name,` : "NULL AS name,"}
          ${catCol ? `i.${catCol} AS category,` : "NULL AS category,"}
          ${stockCol ? `i.${stockCol} AS stock` : "NULL AS stock"}
        FROM inventory_items i
        ORDER BY ${nameCol ? `i.${nameCol}` : "item_key"} ASC
        LIMIT 5000
        `,
        []
      );

      return res.json({ items: rows || [] });
    } catch (e) {
      console.error("GET /admin/consumables/inventory-items error:", e);
      return res.json({ items: [], error: true });
    }
  }
);

app.get(
  `${ADMIN_BASE}/consumables/procedures/:procedureKey/items`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const procedureKey = asNonEmptyString(req.params.procedureKey);
      if (!procedureKey) return res.status(400).json({ message: "Invalid procedureKey" });

      const okPc = await tableExists("procedure_consumables");
      const okInv = await tableExists("inventory_items");
      if (!okPc) return res.status(501).json({ message: "procedure_consumables table not found" });
      if (!okInv) return res.status(501).json({ message: "inventory_items table not found" });

      const pcCols = await getTableColumns("procedure_consumables");
      const invCols = await getTableColumns("inventory_items");

      const pcProcCol = pickCol(pcCols, ["procedure_id", "procedure_code", "procedure_key"]);
      const pcItemCol = pickCol(pcCols, ["inventory_item_id", "item_id", "item_code", "inventory_item_code"]);
      const pcQtyCol = pickCol(pcCols, ["qty", "quantity", "quantity_used", "qty_used", "units"]);
      const pcUnitCol = pickCol(pcCols, ["unit", "uom"]);
      const pcIdCol = pickCol(pcCols, ["id"]);

      if (!pcProcCol || !pcItemCol) {
        return res.status(500).json({
          message: "procedure_consumables schema not supported (missing procedure/item reference columns)",
        });
      }

      const invIdCol = pickCol(invCols, ["id", "inventory_item_id"]);
      const invCodeCol = pickCol(invCols, ["item_code", "code"]);
      const invNameCol = pickCol(invCols, ["name", "item_name"]);
      const invCatCol = pickCol(invCols, ["category"]);
      const invStockCol = pickCol(invCols, ["stock"]);

      // join condition depends on whether pc item ref matches inv id or code
      const joinOn =
        (pcItemCol.toLowerCase().includes("id") && invIdCol)
          ? `pc.${pcItemCol} = i.${invIdCol}`
          : (invCodeCol ? `pc.${pcItemCol} = i.${invCodeCol}` : null);

      if (!joinOn) {
        return res.status(500).json({ message: "Cannot join procedure_consumables to inventory_items (no compatible keys)" });
      }

      const rows = await safeQuery(
        "ADMIN PROCEDURE CONSUMABLES LIST",
        `
        SELECT
          ${pcIdCol ? `pc.${pcIdCol} AS id,` : "NULL AS id,"}
          pc.${pcProcCol} AS procedure_key,
          pc.${pcItemCol} AS item_ref,
          ${pcQtyCol ? `pc.${pcQtyCol} AS qty,` : "1 AS qty,"}
          ${pcUnitCol ? `pc.${pcUnitCol} AS unit,` : "NULL AS unit,"}
          ${invCodeCol ? `i.${invCodeCol} AS item_code,` : "NULL AS item_code,"}
          ${invNameCol ? `i.${invNameCol} AS name,` : "NULL AS name,"}
          ${invCatCol ? `i.${invCatCol} AS category,` : "NULL AS category,"}
          ${invStockCol ? `i.${invStockCol} AS stock` : "NULL AS stock"}
        FROM procedure_consumables pc
        LEFT JOIN inventory_items i ON ${joinOn}
        WHERE pc.${pcProcCol} = ?
        ORDER BY ${invNameCol ? `i.${invNameCol}` : "pc.item_ref"} ASC
        `,
        [procedureKey]
      );

      return res.json({ items: rows || [] });
    } catch (e) {
      console.error("GET /admin/consumables/procedures/:procedureKey/items error:", e);
      return res.json({ items: [], error: true });
    }
  }
);

app.put(
  `${ADMIN_BASE}/consumables/procedures/:procedureKey/items`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const procedureKey = asNonEmptyString(req.params.procedureKey);
      if (!procedureKey) return res.status(400).json({ message: "Invalid procedureKey" });

      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items) return res.status(400).json({ message: "items[] required" });

      const okPc = await tableExists("procedure_consumables");
      if (!okPc) return res.status(501).json({ message: "procedure_consumables table not found" });

      const pcCols = await getTableColumns("procedure_consumables");
      const pcProcCol = pickCol(pcCols, ["procedure_id", "procedure_code", "procedure_key"]);
      const pcItemCol = pickCol(pcCols, ["inventory_item_id", "item_id", "item_code", "inventory_item_code"]);
      const pcQtyCol = pickCol(pcCols, ["qty", "quantity", "quantity_used", "qty_used", "units"]);
      const pcUnitCol = pickCol(pcCols, ["unit", "uom"]);

      if (!pcProcCol || !pcItemCol) {
        return res.status(500).json({
          message: "procedure_consumables schema not supported (missing procedure/item reference columns)",
        });
      }

      // Normalize rows
      const normalized = [];
      for (const row of items) {
        const itemRef = asNonEmptyString(row?.itemRef ?? row?.item_ref ?? row?.itemKey ?? row?.item_key ?? row?.item_code);
        const qty = asPositiveNumber(row?.qty ?? row?.quantity ?? 1, 1);
        const unit = asNonEmptyString(row?.unit ?? row?.uom ?? null);
        if (!itemRef) continue;
        normalized.push({ itemRef, qty, unit });
      }

      // Replace all (transaction)
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(
          `DELETE FROM procedure_consumables WHERE ${pcProcCol} = ?`,
          [procedureKey]
        );

        if (normalized.length) {
          const values = [];
          const placeholders = [];
          for (const r of normalized) {
            const cols = [pcProcCol, pcItemCol];
            const vals = [procedureKey, r.itemRef];

            if (pcQtyCol) {
              cols.push(pcQtyCol);
              vals.push(r.qty);
            }
            if (pcUnitCol) {
              cols.push(pcUnitCol);
              vals.push(r.unit);
            }

            placeholders.push(`(${cols.map(() => "?").join(",")})`);
            values.push(...vals);
          }

          // build one INSERT that matches actual table columns
          const insertCols = [pcProcCol, pcItemCol];
          if (pcQtyCol) insertCols.push(pcQtyCol);
          if (pcUnitCol) insertCols.push(pcUnitCol);

          await conn.query(
            `INSERT INTO procedure_consumables (${insertCols.join(",")}) VALUES ${placeholders.join(",")}`,
            values
          );
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      // Optional: let Python InventoryAgent know rules changed (safe even if agent ignores)
      await enqueueEventCompat({
        eventType: "InventoryRulesUpdated",
        payload: { procedureKey },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true, count: normalized.length });
    } catch (e) {
      console.error("PUT /admin/consumables/procedures/:procedureKey/items error:", e);
      return res.status(500).json({ ok: false, message: "Failed to save procedure consumables" });
    }
  }
);

// ===================================
// ✅ ADMIN: APPOINTMENT PROCEDURES (visit_procedures)
// ===================================
app.get(
  `${ADMIN_BASE}/appointments/:dbId/procedures`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.dbId);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }

      const { visitId, error } = await getOrCreateVisitIdForAppointmentAdmin(appointmentId);
      if (!visitId) return res.status(501).json({ message: error || "Cannot resolve visit" });

      const out = await listVisitProceduresByVisitId(visitId);
      return res.json({ visitId, items: out.items || [] });
    } catch (e) {
      console.error("GET /admin/appointments/:dbId/procedures error:", e);
      return res.json({ visitId: null, items: [], error: true });
    }
  }
);

app.put(
  `${ADMIN_BASE}/appointments/:dbId/procedures`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.dbId);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }

      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items) return res.status(400).json({ message: "items[] required" });

      const { visitId, error } = await getOrCreateVisitIdForAppointmentAdmin(appointmentId);
      if (!visitId) return res.status(501).json({ message: error || "Cannot resolve visit" });

      const r = await replaceVisitProcedures({ visitId, items });
      return res.json({ ok: true, visitId, count: r.count || 0 });
    } catch (e) {
      console.error("PUT /admin/appointments/:dbId/procedures error:", e);
      return res.status(500).json({ ok: false, message: "Failed to save appointment procedures" });
    }
  }
);


// ===================================
// ✅ DOCTOR: VISIT CONSUMABLES (actual usage)
// Requires tables: visits, visit_consumables, inventory_items
// ===================================
app.get(
  `${DOCTOR_BASE}/visits/:visitId/consumables`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const visitId = Number(req.params.visitId);
      if (!Number.isFinite(visitId) || visitId <= 0) return res.status(400).json({ message: "Invalid visitId" });

      const okVc = await tableExists("visit_consumables");
      const okInv = await tableExists("inventory_items");
      if (!okVc) return res.status(501).json({ message: "visit_consumables table not found" });
      if (!okInv) return res.status(501).json({ message: "inventory_items table not found" });

      const vcCols = await getTableColumns("visit_consumables");
      const invCols = await getTableColumns("inventory_items");

      const vcVisitCol = pickCol(vcCols, ["visit_id"]);
      const vcItemCol = pickCol(vcCols, ["inventory_item_id", "item_id", "item_code", "inventory_item_code"]);
      const vcQtyCol = pickCol(vcCols, ["qty", "quantity", "quantity_used", "qty_used", "units"]);
      const vcUnitCol = pickCol(vcCols, ["unit", "uom"]);
      const vcIdCol = pickCol(vcCols, ["id"]);

      if (!vcVisitCol || !vcItemCol) {
        return res.status(500).json({ message: "visit_consumables schema not supported (missing visit/item cols)" });
      }

      const invIdCol = pickCol(invCols, ["id", "inventory_item_id"]);
      const invCodeCol = pickCol(invCols, ["item_code", "code"]);
      const invNameCol = pickCol(invCols, ["name", "item_name"]);
      const invCatCol = pickCol(invCols, ["category"]);

      const joinOn =
        (vcItemCol.toLowerCase().includes("id") && invIdCol)
          ? `vc.${vcItemCol} = i.${invIdCol}`
          : (invCodeCol ? `vc.${vcItemCol} = i.${invCodeCol}` : null);

      const rows = await safeQuery(
        "DOCTOR VISIT CONSUMABLES LIST",
        `
        SELECT
          ${vcIdCol ? `vc.${vcIdCol} AS id,` : "NULL AS id,"}
          vc.${vcVisitCol} AS visit_id,
          vc.${vcItemCol} AS item_ref,
          ${vcQtyCol ? `vc.${vcQtyCol} AS qty,` : "1 AS qty,"}
          ${vcUnitCol ? `vc.${vcUnitCol} AS unit,` : "NULL AS unit,"}
          ${joinOn && invCodeCol ? `i.${invCodeCol} AS item_code,` : "NULL AS item_code,"}
          ${joinOn && invNameCol ? `i.${invNameCol} AS name,` : "NULL AS name,"}
          ${joinOn && invCatCol ? `i.${invCatCol} AS category` : "NULL AS category"}
        FROM visit_consumables vc
        ${joinOn ? `LEFT JOIN inventory_items i ON ${joinOn}` : ""}
        WHERE vc.${vcVisitCol} = ?
        ORDER BY ${joinOn && invNameCol ? `i.${invNameCol}` : "vc.item_ref"} ASC
        `,
        [visitId]
      );

      return res.json({ items: rows || [] });
    } catch (e) {
      console.error("GET /doctor/visits/:visitId/consumables error:", e);
      return res.json({ items: [], error: true });
    }
  }
);

app.put(
  `${DOCTOR_BASE}/visits/:visitId/consumables`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const visitId = Number(req.params.visitId);
      if (!Number.isFinite(visitId) || visitId <= 0) return res.status(400).json({ message: "Invalid visitId" });

      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items) return res.status(400).json({ message: "items[] required" });

      const okVc = await tableExists("visit_consumables");
      if (!okVc) return res.status(501).json({ message: "visit_consumables table not found" });

      const vcCols = await getTableColumns("visit_consumables");
      const vcVisitCol = pickCol(vcCols, ["visit_id"]);
      const vcItemCol = pickCol(vcCols, ["inventory_item_id", "item_id", "item_code", "inventory_item_code"]);
      const vcQtyCol = pickCol(vcCols, ["qty", "quantity", "quantity_used", "qty_used", "units"]);
      const vcUnitCol = pickCol(vcCols, ["unit", "uom"]);

      if (!vcVisitCol || !vcItemCol) {
        return res.status(500).json({ message: "visit_consumables schema not supported (missing visit/item cols)" });
      }

      const normalized = [];
      for (const row of items) {
        const itemRef = asNonEmptyString(row?.itemRef ?? row?.item_ref ?? row?.itemKey ?? row?.item_key ?? row?.item_code);
        const qty = asPositiveNumber(row?.qty ?? row?.quantity ?? 1, 1);
        const unit = asNonEmptyString(row?.unit ?? row?.uom ?? null);
        if (!itemRef) continue;
        normalized.push({ itemRef, qty, unit });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Replace all for visit (simple + deterministic)
        await conn.query(`DELETE FROM visit_consumables WHERE ${vcVisitCol} = ?`, [visitId]);

        if (normalized.length) {
          const placeholders = [];
          const values = [];

          const insertCols = [vcVisitCol, vcItemCol];
          if (vcQtyCol) insertCols.push(vcQtyCol);
          if (vcUnitCol) insertCols.push(vcUnitCol);

          for (const r of normalized) {
            const rowVals = [visitId, r.itemRef];
            if (vcQtyCol) rowVals.push(r.qty);
            if (vcUnitCol) rowVals.push(r.unit);
            placeholders.push(`(${insertCols.map(() => "?").join(",")})`);
            values.push(...rowVals);
          }

          await conn.query(
            `INSERT INTO visit_consumables (${insertCols.join(",")}) VALUES ${placeholders.join(",")}`,
            values
          );
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      // Optional: tell Python InventoryAgent that real usage was recorded (if it cares)
      await enqueueEventCompat({
        eventType: "VisitConsumablesUpdated",
        payload: { visitId },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true, count: normalized.length });
    } catch (e) {
      console.error("PUT /doctor/visits/:visitId/consumables error:", e);
      return res.status(500).json({ ok: false, message: "Failed to save visit consumables" });
    }
  }
);

// ===================================
// ✅ ADMIN: CLINIC SETUP (clinic profile, hours, templates, permissions)
// ===================================
app.get(
  `${ADMIN_BASE}/clinic-setup`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "CLINIC SETTINGS",
        `SELECT
           id, clinic_name, clinic_phone, clinic_email, clinic_address, timezone,
           working_hours_json, treatment_catalog_json, note_templates_json, ai_preferences_json,
           updated_at
         FROM clinic_settings
         WHERE id = 1
         LIMIT 1`,
        []
      );

      const r = rows[0] || {};
      const parseJson = (x, fallback) => {
        try {
          return x ? JSON.parse(String(x)) : fallback;
        } catch {
          return fallback;
        }
      };

      // role permissions
      const rp = await safeQuery(
        "ROLE PERMISSIONS",
        `SELECT role, permissions_json FROM role_permissions ORDER BY role`,
        []
      );

      const permissions = {};
      for (const row of rp) {
        permissions[row.role] = parseJson(row.permissions_json, {});
      }

      return res.json({
        clinic: {
          clinicName: r.clinic_name || "",
          phone: r.clinic_phone || "",
          email: r.clinic_email || "",
          address: r.clinic_address || "",
          timezone: r.timezone || "Asia/Kolkata",
          workingHours: parseJson(r.working_hours_json, { start: "09:00", end: "18:00", stepMin: 15, days: [1, 2, 3, 4, 5, 6] }),
          treatmentCatalog: parseJson(r.treatment_catalog_json, []),
          noteTemplates: parseJson(r.note_templates_json, []),
          aiPreferences: parseJson(r.ai_preferences_json, { enableAiSummaries: true, enableSmartScheduling: true }),
          updatedAt: r.updated_at || null,
        },
        permissions,
      });
    } catch (e) {
      console.error("GET clinic-setup error:", e);
      return res.json({
        clinic: {
          clinicName: "",
          phone: "",
          email: "",
          address: "",
          timezone: "Asia/Kolkata",
          workingHours: { start: "09:00", end: "18:00", stepMin: 15, days: [1, 2, 3, 4, 5, 6] },
          treatmentCatalog: [],
          noteTemplates: [],
          aiPreferences: { enableAiSummaries: true, enableSmartScheduling: true },
          updatedAt: null,
        },
        permissions: {},
        error: true,
      });
    }
  }
);

app.put(
  `${ADMIN_BASE}/clinic-setup`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const {
        clinicName,
        phone,
        email,
        address,
        timezone,
        workingHours,
        treatmentCatalog,
        noteTemplates,
        aiPreferences,
        permissions,
      } = req.body || {};

      await pool.query(
        `UPDATE clinic_settings
         SET clinic_name = ?, clinic_phone = ?, clinic_email = ?, clinic_address = ?, timezone = ?,
             working_hours_json = ?, treatment_catalog_json = ?, note_templates_json = ?, ai_preferences_json = ?,
             updated_at = NOW()
         WHERE id = 1`,
        [
          clinicName ? String(clinicName).trim() : null,
          phone ? String(phone).trim() : null,
          email ? String(email).trim() : null,
          address ? String(address).trim() : null,
          timezone ? String(timezone).trim() : "Asia/Kolkata",
          workingHours ? JSON.stringify(workingHours) : null,
          treatmentCatalog ? JSON.stringify(treatmentCatalog) : null,
          noteTemplates ? JSON.stringify(noteTemplates) : null,
          aiPreferences ? JSON.stringify(aiPreferences) : null,
        ]
      );

      // Save role permissions (config only; middleware can enforce later)
      if (permissions && typeof permissions === "object") {
        for (const [role, perms] of Object.entries(permissions)) {
          if (!["Admin", "Doctor", "Assistant", "Patient"].includes(String(role))) continue;
          await pool.query(
            `INSERT INTO role_permissions (role, permissions_json)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE permissions_json = VALUES(permissions_json), updated_at = NOW()`,
            [String(role), JSON.stringify(perms || {})]
          );
        }
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error("PUT clinic-setup error:", e);
      return res.status(500).json({ message: "Failed to save clinic setup" });
    }
  }
);

// ===================================
// ✅ ADMIN: USER MANAGEMENT (create staff + patients, list users)
// ===================================
app.get(
  `${ADMIN_BASE}/patients`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "ADMIN PATIENT LIST",
        `
        SELECT
          u.id,
          u.uid,
          u.full_name,
          u.email,
          u.phone,
          (
            SELECT COUNT(*)
            FROM appointments a
            WHERE a.patient_id = u.id
          ) AS appointment_count,
          (
            SELECT MAX(a.scheduled_date)
            FROM appointments a
            WHERE a.patient_id = u.id
          ) AS last_appointment,
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM invoices
            WHERE patient_id = u.id
          ) AS total_billed,
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM invoices
            WHERE patient_id = u.id AND status = 'Paid'
          ) AS total_paid,
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM invoices
            WHERE patient_id = u.id AND status != 'Paid'
          ) AS balance
        FROM users u
        WHERE u.role = 'Patient'
        ORDER BY u.created_at DESC
        LIMIT 500
        `,
        []
      );

      const patients = rows.map((r) => ({
        id: String(r.uid || r.id),
        full_name: r.full_name || "",
        email: r.email || null,
        phone: r.phone || null,
        appointment_count: Number(r.appointment_count || 0),
        last_appointment: r.last_appointment || null,
        totalBilled: Number(r.total_billed || 0),
        totalPaid: Number(r.total_paid || 0),
        balance: Number(r.balance || 0),
      }));

      return res.json({ patients });
    } catch (e) {
      console.error("GET /api/admin/patients error:", e);
      return res.json({ patients: [], error: true });
    }
  }
);

// ✅ NEW: Patient Management Session (Clinical + Financial overrides)
app.get(
  `${ADMIN_BASE}/patients/:id/management`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params; // uid or dbId
      const [rows] = await pool.query(
        `SELECT u.id, u.uid, u.full_name, pp.medical_history, pp.billed_override, pp.paid_override, pp.balance_override,
                (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE patient_id = u.id) AS auto_billed,
                (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE patient_id = u.id AND status = 'Paid') AS auto_paid
         FROM users u
         LEFT JOIN patient_profiles pp ON pp.user_id = u.id
         WHERE u.uid = ? OR u.id = ?
         LIMIT 1`,
        [id, id]
      );

      if (!rows.length) return res.status(404).json({ message: "Patient not found" });
      const p = rows[0];

      return res.json({
        id: p.uid,
        fullName: p.full_name,
        medicalHistory: p.medical_history || "",
        financials: {
          autoBilled: Number(p.auto_billed),
          autoPaid: Number(p.auto_paid),
          billedOverride: p.billed_override,
          paidOverride: p.paid_override,
          balanceOverride: p.balance_override,
          finalBilled: p.billed_override != null ? p.billed_override : p.auto_billed,
          finalPaid: p.paid_override != null ? p.paid_override : p.auto_paid,
        }
      });
    } catch (e) {
      console.error("GET /admin/patients/:id/management error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

app.put(
  `${ADMIN_BASE}/patients/:id/management`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { billedOverride, paidOverride, balanceOverride, medicalHistory } = req.body || {};

      const [uRows] = await pool.query("SELECT id FROM users WHERE uid = ? OR id = ? LIMIT 1", [id, id]);
      if (!uRows.length) return res.status(404).json({ message: "Patient not found" });
      const userId = uRows[0].id;

      // Ensure profile exists
      await pool.query("INSERT IGNORE INTO patient_profiles (user_id) VALUES (?)", [userId]);

      await pool.query(
        `UPDATE patient_profiles 
         SET billed_override = ?, 
             paid_override = ?, 
             balance_override = ?,
             medical_history = ?,
             updated_at = NOW()
         WHERE user_id = ?`,
        [
          billedOverride === "" ? null : billedOverride,
          paidOverride === "" ? null : paidOverride,
          balanceOverride === "" ? null : balanceOverride,
          medicalHistory || null,
          userId
        ]
      );

      return res.json({ ok: true });
    } catch (e) {
      console.error("PUT /admin/patients/:id/management error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

function roleDbFromClient(role) {
  const upper = String(role || "").toUpperCase().trim();
  if (upper === "ADMIN") return "Admin";
  if (upper === "DOCTOR") return "Doctor";
  if (upper === "ASSISTANT") return "Assistant";
  return "Patient";
}

function roleClientFromDb(roleDb) {
  if (roleDb === "Admin") return "ADMIN";
  if (roleDb === "Doctor") return "DOCTOR";
  if (roleDb === "Assistant") return "ASSISTANT";
  return "PATIENT";
}

function randomTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function buildInviteEmailHtml(name, roleLabel, tempPassword) {
  const safeName = (name || "there").toString();
  const safeRole = (roleLabel || "user").toString();
  const safePw = (tempPassword || "").toString();
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="margin:0 0 10px 0">Your ${safeRole} account is ready</h2>
    <p style="margin:0 0 10px 0">Hi ${safeName},</p>
    <p style="margin:0 0 10px 0">An admin created your Dental Clinic AI account.</p>
    <p style="margin:0 0 10px 0"><b>Temporary password:</b></p>
    <div style="font-size:20px;font-weight:700;letter-spacing:1px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;display:inline-block">
      ${safePw}
    </div>
    <p style="margin:12px 0 0 0;color:#6b7280">Login with this password and change it immediately using “Forgot password”.</p>
  </div>`;
}

app.get(
  `${ADMIN_BASE}/users`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const role = req.query.role ? String(req.query.role) : "";
      const roleDb = role ? roleDbFromClient(role) : null;

      const rows = await safeQuery(
        "ADMIN USERS LIST",
        `SELECT id, uid, full_name, email, phone, role, created_at
         FROM users
         WHERE (? IS NULL OR role = ?)
         ORDER BY created_at DESC
         LIMIT 500`,
        [roleDb, roleDb]
      );

      const items = rows.map((u) => ({
        id: u.id,
        uid: u.uid,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        role: roleClientFromDb(u.role),
        createdAt: u.created_at,
      }));

      return res.json({ items });
    } catch (e) {
      console.error("GET admin/users error:", e);
      return res.json({ items: [], error: true });
    }
  }
);

app.post(
  `${ADMIN_BASE}/users`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const {
        role,
        fullName,
        email,
        phone,
        dob,
        gender,
        address,
        medicalHistory,
        allergies,
        notes,
        sendInviteEmail,
        tempPassword,
      } = req.body || {};

      if (!role || !fullName) {
        return res.status(400).json({ message: "role and fullName are required" });
      }

      const roleDb = roleDbFromClient(role);
      if (!["Admin", "Doctor", "Assistant", "Patient"].includes(roleDb)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const name = String(fullName).trim();
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

      // Require email for staff roles (so they can login)
      if (["Admin", "Doctor", "Assistant"].includes(roleDb) && !normalizedEmail) {
        return res.status(400).json({ message: "Email is required for staff accounts" });
      }

      if (normalizedEmail) {
        const [existing] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [normalizedEmail]);
        if (existing.length) {
          return res.status(409).json({ message: "Email already exists" });
        }
      }

      const uid = generateUid(roleDb);

      // Password behavior:
      // - Staff: always create a password (provided or generated) so login works
      // - Patient: optional password; if email provided, create password so patient can use portal
      let passwordHash = null;
      let usedTempPassword = null;

      if (["Admin", "Doctor", "Assistant"].includes(roleDb) || normalizedEmail) {
        const pw = tempPassword && String(tempPassword).trim() ? String(tempPassword).trim() : randomTempPassword();
        usedTempPassword = pw;
        passwordHash = await bcrypt.hash(pw, 10);
      }

      const [result] = await pool.query(
        `INSERT INTO users
          (uid, full_name, email, phone, dob, gender, address, role, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid,
          name,
          normalizedEmail,
          phone ? String(phone).trim() : null,
          dob ? String(dob).trim() : null,
          gender ? String(gender).trim() : null,
          address ? String(address).trim() : null,
          roleDb,
          passwordHash,
        ]
      );

      const newUserId = result.insertId;

      // Patient profile extras
      if (roleDb === "Patient") {
        try {
          await pool.query(
            `INSERT INTO patient_profiles (user_id, medical_history, allergies, notes)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE medical_history = VALUES(medical_history), allergies = VALUES(allergies), notes = VALUES(notes)`,
            [
              newUserId,
              medicalHistory ? String(medicalHistory) : null,
              allergies ? String(allergies) : null,
              notes ? String(notes) : null,
            ]
          );
        } catch (e) {
          console.error("patient_profiles upsert failed:", e?.message || e);
        }
      }

      // Optional invite email
      const shouldSend =
        String(sendInviteEmail || "").toLowerCase() === "true" ||
        sendInviteEmail === 1 ||
        sendInviteEmail === true;

      if (shouldSend && normalizedEmail && usedTempPassword) {
        try {
          const roleLabel = roleDb === "Doctor" ? "Doctor" : roleDb === "Assistant" ? "Assistant" : roleDb;
          const html = buildInviteEmailHtml(name, roleLabel, usedTempPassword);
          await sendEmail({
            from: process.env.MAIL_FROM || '"Dental Clinic AI" <no-reply@clinic.ai>',
            to: normalizedEmail,
            subject: "Your Dental Clinic AI account details",
            html,
            text: `Your ${roleLabel} account is ready. Temporary password: ${usedTempPassword}. Please change it using Forgot password after login.`,
          });
        } catch (e) {
          console.error("Invite email failed:", e?.message || e);
        }
      }

      return res.status(201).json({
        message: "User created",
        user: {
          id: newUserId,
          uid,
          fullName: name,
          email: normalizedEmail,
          phone: phone || null,
          role: roleClientFromDb(roleDb),
        },
      });
    } catch (e) {
      console.error("POST admin/users error:", e);
      return res.status(500).json({ message: "Failed to create user" });
    }
  }
);


// DASHBOARD SUMMARY (UNCHANGED)
app.get(
  `${ADMIN_BASE}/dashboard-summary`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    const todayStr = formatDateYYYYMMDD(new Date());

    try {
      const rowsAppointments = await safeQuery(
        "ADMIN DASHBOARD appointments",
        `SELECT COUNT(*) AS count
         FROM appointments
         WHERE scheduled_date = ? AND status IN ('Confirmed','Checked in','Completed')`,
        [todayStr]
      );
      const todayAppointments = rowsAppointments[0]?.count ?? 0;

      const rowsLowStock = await safeQuery(
        "ADMIN DASHBOARD low stock",
        `SELECT COUNT(*) AS count
         FROM inventory_items
         WHERE stock <= COALESCE(reorder_threshold, 0)`,
        []
      );
      const lowStockItems = rowsLowStock[0]?.count ?? 0;

      const rowsRevenueToday = await safeQuery(
        "ADMIN DASHBOARD revenue today",
        `SELECT COALESCE(SUM(amount),0) AS total
         FROM invoices
         WHERE paid_date = ?
           AND status = 'Paid'`,
        [todayStr]
      );
      const todaysRevenue = Number(rowsRevenueToday[0]?.total || 0);

      const rowsCases = await safeQuery(
        "ADMIN DASHBOARD case pipeline",
        `SELECT stage, COUNT(*) AS count
         FROM cases
         GROUP BY stage`,
        []
      );
      const pipeline = {
        NEW: 0,
        IN_TREATMENT: 0,
        WAITING_ON_PATIENT: 0,
        READY_TO_CLOSE: 0,
        CLOSED: 0,
        BLOCKED: 0,
      };
      for (const r of rowsCases) {
        if (r.stage && Object.prototype.hasOwnProperty.call(pipeline, r.stage)) {
          pipeline[r.stage] = r.count;
        }
      }

      const activeCases =
        (pipeline.NEW || 0) +
        (pipeline.IN_TREATMENT || 0) +
        (pipeline.WAITING_ON_PATIENT || 0) +
        (pipeline.READY_TO_CLOSE || 0);

      const rowsNewPatients = await safeQuery(
        "ADMIN DASHBOARD new patients",
        `SELECT COUNT(*) AS count
         FROM users
         WHERE role = 'Patient'
           AND DATE(created_at) = ?`,
        [todayStr]
      );
      const newPatientsToday = rowsNewPatients[0]?.count ?? 0;

      const rowsReturningPatients = await safeQuery(
        "ADMIN DASHBOARD returning patients",
        `SELECT COUNT(DISTINCT a.patient_id) AS count
         FROM appointments a
         JOIN users u ON u.id = a.patient_id
         WHERE a.scheduled_date = ?
           AND u.role = 'Patient'
           AND u.created_at < ?`,
        [todayStr, todayStr]
      );
      const returningPatientsToday = rowsReturningPatients[0]?.count ?? 0;

      const rowsCancelled = await safeQuery(
        "ADMIN DASHBOARD cancellations",
        `SELECT COUNT(*) AS count
         FROM appointments
         WHERE scheduled_date = ?
           AND status = 'Cancelled'`,
        [todayStr]
      );
      const cancelledAppointmentsToday = rowsCancelled[0]?.count ?? 0;

      res.json({
        todayAppointments,
        todayAppointmentsDelta: 0,
        lowStockItems,
        todaysRevenue,
        todaysRevenueDeltaPercent: 0,
        activeCases,
        casePipeline: {
          new: pipeline.NEW,
          inTreatment: pipeline.IN_TREATMENT,
          awaitingFollowUp: pipeline.WAITING_ON_PATIENT,
        },
        patientSnapshot: {
          newPatientsToday,
          returningPatientsToday,
          cancelledAppointmentsToday,
        },
        asOf: todayStr,
      });
    } catch (err) {
      console.error("ADMIN DASHBOARD SUMMARY HANDLER ERROR:", err);
      res.json({
        todayAppointments: 0,
        todayAppointmentsDelta: 0,
        lowStockItems: 0,
        todaysRevenue: 0,
        todaysRevenueDeltaPercent: 0,
        activeCases: 0,
        casePipeline: { new: 0, inTreatment: 0, awaitingFollowUp: 0 },
        patientSnapshot: {
          newPatientsToday: 0,
          returningPatientsToday: 0,
          cancelledAppointmentsToday: 0,
        },
        asOf: todayStr,
        error: true,
      });
    }
  }
);

// ✅ Fallback suggest-slots logic (works without Node agents; safe, additive)
async function fallbackSuggestSlots({ doctorId, operatoryId, dateStr, durationMin, startMin = null, maxSlots = 10 }) {
  const stepMin = 15;
  const clinicStart = process.env.CLINIC_START || "09:00:00";
  const clinicEnd = process.env.CLINIC_END || "18:00:00";

  // Parse HH:MM:SS to minutes
  const toMin = (t) => {
    const [hh, mm] = String(t).split(":").map((x) => parseInt(x, 10));
    return (hh || 0) * 60 + (mm || 0);
  };
  const toTime = (m) => {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}:00`;
  };

  const startM = toMin(clinicStart);
  const endM = toMin(clinicEnd);
  const dur = Math.max(5, Number(durationMin) || 30);

  // Pull existing appointments for doctor (and operatory if provided)
  let rows = [];
  try {
    rows = await safeQuery(
      "SUGGEST fallback appointments",
      `
      SELECT scheduled_time, scheduled_end_time, predicted_duration_min, status, operatory_id
      FROM appointments
      WHERE scheduled_date = ?
        AND status NOT IN ('Cancelled')
        AND (
          doctor_id = ?
          ${schemaCaps.appointments_has_operatory_id && operatoryId ? " OR operatory_id = ?" : ""}
        )
      `,
      schemaCaps.appointments_has_operatory_id && operatoryId ? [dateStr, doctorId, operatoryId] : [dateStr, doctorId]
    );
  } catch (_) {
    rows = [];
  }

  const busy = [];
  for (const r of rows) {
    const st = toTimeStr(r.scheduled_time || "");
    if (!st) continue;

    let et = null;

    // Prefer scheduled_end_time when present
    if (schemaCaps.appointments_has_scheduled_end_time && r.scheduled_end_time) {
      et = toTimeStr(r.scheduled_end_time);
    }

    // Otherwise compute from predicted_duration_min
    if (!et) {
      const pd = Number(r.predicted_duration_min || 0) || 30;
      const m = toMin(st) + pd;
      et = toTime(m);
    }

    busy.push([toMin(st), toMin(et)]);
  }

  const isFree = (s, e) => {
    for (const [bs, be] of busy) {
      if (s < be && e > bs) return false; // overlap
    }
    return true;
  };

  const out = [];
  const minStart = Number.isFinite(Number(startMin)) ? Math.max(startM, Number(startMin)) : startM;
  for (let m = minStart; m + dur <= endM; m += stepMin) {
    const s = m;
    const e = m + dur;
    if (isFree(s, e)) out.push({ time: toTime(s).slice(0, 5), timeStr: toTime(s) });
    if (out.length >= (Number(maxSlots) || 10)) break;
  }

  return out;
}

// ✅ Inventory monitor tick (periodic)
async function enqueueInventoryMonitorTick() {
  const key = `inventory_monitor:${formatDateYYYYMMDD(new Date())}:${new Date().getHours()}`;
  const ok = await insertIdempotencyLockIfPossible(key);
  if (!ok) return;

  await enqueueEventCompat({
    eventType: "InventoryMonitorTick",
    payload: { horizon_days: 30 },
    createdByUserId: null,
  });
}

// ✅ Appointment monitor tick (periodic no-show/delay automation)
async function enqueueAppointmentMonitorTick() {
  const now = new Date();
  const intervalMin = Math.max(1, Number(process.env.APPOINTMENT_MONITOR_INTERVAL_MIN || 10));
  const bucket = Math.floor(now.getMinutes() / intervalMin);
  const key = `appointment_monitor:${formatDateYYYYMMDD(now)}:${now.getHours()}:${bucket}`;
  const ok = await insertIdempotencyLockIfPossible(key);
  if (!ok) return;

  await enqueueEventCompat({
    eventType: "AppointmentMonitorTick",
    payload: { source: "scheduler", intervalMin },
    createdByUserId: null,
  });
}

setTimeout(() => {
  enqueueAppointmentMonitorTick().catch(() => { });
  setInterval(() => {
    enqueueAppointmentMonitorTick().catch(() => { });
  }, Math.max(1, Number(process.env.APPOINTMENT_MONITOR_INTERVAL_MIN || 10)) * 60 * 1000);

  enqueueInventoryMonitorTick().catch(() => { });
  setInterval(() => {
    enqueueInventoryMonitorTick().catch(() => { });
  }, 60 * 60 * 1000);
}, 5 * 1000);
function mapDurationMinutes({ type, reason }) {
  const s = `${type || ""} ${reason || ""}`.toLowerCase();
  if (s.includes("root canal")) return 90;
  if (s.includes("implant")) return 90;
  if (s.includes("extraction")) return 45;
  if (s.includes("scaling")) return 45;
  if (s.includes("filling")) return 40;
  if (s.includes("cleaning")) return 30;
  if (s.includes("ortho")) return 30;
  if (s.includes("consult") || s.includes("general")) return 20;
  return 20;
}

function timeToMinutes(t) {
  const s = String(t || "");
  const [hh, mm] = s.split(":").map((x) => parseInt(x, 10));
  return (hh || 0) * 60 + (mm || 0);
}

function addMinutesToTimeStr(timeStr, addMin) {
  const baseMin = timeToMinutes(timeStr);
  const total = baseMin + (Number(addMin) || 0);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

async function buildSuggestedSlots({
  doctorId,
  operatoryId,
  dateStr,
  startTime,
  durationMin,
  maxSlots = 12,
  daysAhead = 7,
}) {
  const out = [];
  const startMin = startTime ? timeToMinutes(startTime) : null;

  for (let i = 0; i <= daysAhead; i++) {
    const d = addDaysYYYYMMDD(dateStr, i);
    const slots = await fallbackSuggestSlots({
      doctorId,
      operatoryId,
      dateStr: d,
      durationMin,
      startMin: i === 0 && startMin != null ? startMin : null,
      maxSlots,
    });

    for (const s of slots || []) {
      const start = toTimeStr(s.timeStr || s.time);
      out.push({
        date: d,
        startTime: start,
        endTime: addMinutesToTimeStr(start, durationMin),
        predictedDurationMin: durationMin,
      });
      if (out.length >= maxSlots) return out;
    }
  }

  return out;
}
function addDaysYYYYMMDD(dateStr, addDays) {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map((x) => parseInt(x, 10));
  const base = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  base.setUTCDate(base.getUTCDate() + (Number(addDays) || 0));
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getNowHHMMSSInTZ() {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
}

async function fallbackSuggestSlotsAcrossDays({ doctorId, operatoryId, startDateStr, durationMin, daysAhead = 7 }) {
  const todayStr = formatDateYYYYMMDD(new Date());
  const nowMin = (() => {
    const t = getNowHHMMSSInTZ();
    const [hh, mm] = String(t).split(":").map((x) => parseInt(x, 10));
    return (hh || 0) * 60 + (mm || 0);
  })();

  for (let i = 0; i <= (Number(daysAhead) || 0); i++) {
    const dateStr = addDaysYYYYMMDD(startDateStr, i);
    const slots = await fallbackSuggestSlots({ doctorId, operatoryId, dateStr, durationMin });

    // if it's today, remove times in the past
    const cleaned =
      dateStr === todayStr
        ? (slots || []).filter((s) => {
          const t = String(s?.timeStr || s?.time || "");
          const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
          const m = (hh || 0) * 60 + (mm || 0);
          return m >= nowMin + 2;
        })
        : (slots || []);

    if (cleaned.length) {
      return {
        date: dateStr,
        slots: cleaned.map((x) => ({
          date: dateStr,
          time: String(x.timeStr || x.time || ""), // "HH:MM:SS"
          timeHHMM: String(x.time || "").slice(0, 5), // "HH:MM"
        })),
      };
    }
  }

  return { date: null, slots: [] };
}

// ✅ NEW: smart slot suggestions (does not break existing create appointment)
app.post(
  `${ADMIN_BASE}/appointments/suggest-slots`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const payload = req.body || {};
      console.log("SUGGEST_SLOTS payload:", payload);

      const {
        doctorUid,
        doctorId,
        doctor_id,
        patientUid,
        patientId,
        patient_id,
        date,
        time,
        type,
        reason,
        operatoryId,
      } = payload;

      if (!date) {
        return res.status(400).json({ message: "date required" });
      }

      let resolvedDoctorId = Number(doctorId || doctor_id || 0);
      if (!Number.isFinite(resolvedDoctorId) || resolvedDoctorId <= 0) {
        if (!doctorUid) {
          return res.status(400).json({ message: "doctorUid or doctorId required" });
        }
        const [drows] = await pool.query(
          `SELECT id FROM users WHERE uid = ? AND role = 'Doctor' LIMIT 1`,
          [doctorUid]
        );
        if (drows.length === 0) return res.status(400).json({ message: "Doctor not found" });
        resolvedDoctorId = Number(drows[0].id);
      }

      let resolvedPatientId = Number(patientId || patient_id || 0);
      if ((!Number.isFinite(resolvedPatientId) || resolvedPatientId <= 0) && patientUid) {
        try {
          const [prows] = await pool.query(
            `SELECT id FROM users WHERE uid = ? AND role = 'Patient' LIMIT 1`,
            [patientUid]
          );
          if (prows.length) resolvedPatientId = Number(prows[0].id);
        } catch (_) { }
      }

      const dateStr = toDateStr(date);
      const startTime = time ? toTimeStr(time) : null;
      const durationMin = mapDurationMinutes({ type, reason });

      const suggestedSlots = await buildSuggestedSlots({
        doctorId: resolvedDoctorId,
        operatoryId: operatoryId || null,
        dateStr,
        startTime,
        durationMin,
        maxSlots: 12,
      });

      console.log("SUGGEST_SLOTS parsed:", {
        doctorId: resolvedDoctorId,
        patientId: resolvedPatientId || null,
        durationMin,
        slots: suggestedSlots.length,
      });

      return res.json({ ok: true, suggestedSlots });
    } catch (err) {
      console.error("SUGGEST SLOTS ERROR:", err);
      return res.json({ ok: false, suggestedSlots: [], error: true });
    }
  }
);

// APPOINTMENTS LIST (UNCHANGED)
app.get(
  `${ADMIN_BASE}/appointments`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    const { date } = req.query;
    const dateFilter =
      typeof date === "string" && date.length ? toDateStr(date) : formatDateYYYYMMDD(new Date());

    try {
      const rows = await safeQuery(
        "ADMIN APPOINTMENTS LIST",
        `SELECT
           a.id,
           a.appointment_uid,
           DATE_FORMAT(a.scheduled_date, '%Y-%m-%d') AS scheduled_date,
           TIME_FORMAT(a.scheduled_time, '%h:%i %p') AS time_display,
           a.type,
           a.status,
           p.full_name AS patient_name,
           d.full_name AS doctor_name
         FROM appointments a
         LEFT JOIN users p ON p.id = a.patient_id
         LEFT JOIN users d ON d.id = a.doctor_id
         WHERE a.scheduled_date = ?
         ORDER BY a.scheduled_date, a.scheduled_time`,
        [dateFilter]
      );

      const items = rows.map((r) => ({
        dbId: Number(r.id),
        id: r.appointment_uid || r.id,
        date: r.scheduled_date || null,
        time: r.time_display || null,
        patient: r.patient_name || "—",
        doctor: r.doctor_name || "—",
        type: r.type || "General",
        status: r.status || "Unknown",
      }));

      res.json({ items, date: dateFilter });
    } catch (err) {
      console.error("ADMIN APPOINTMENTS HANDLER ERROR:", err);
      res.json({ items: [], date: dateFilter, error: true });
    }
  }
);

// ADMIN: CREATE APPOINTMENT (existing behavior preserved) ✅ + NEW event emit for agents

app.get(
  `${ADMIN_BASE}/appointments/:dbId`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }
      const [rows] = await pool.query(
        `
        SELECT
          a.id, a.appointment_uid, a.patient_id, a.doctor_id, a.linked_case_id,
          DATE_FORMAT(a.scheduled_date, '%Y-%m-%d') AS scheduled_date,
          TIME_FORMAT(a.scheduled_time, '%H:%i:%s') AS scheduled_time,
          a.type, a.status, NULL AS notes,
          p.full_name AS patient_name, d.full_name AS doctor_name, c.case_uid
        FROM appointments a
        LEFT JOIN users p ON p.id = a.patient_id
        LEFT JOIN users d ON d.id = a.doctor_id
        LEFT JOIN cases c ON c.id = a.linked_case_id
        WHERE a.id = ?
        LIMIT 1
        `,
        [dbId]
      );
      if (!rows.length) return res.status(404).json({ message: "Appointment not found" });

      const [usageRows] = await pool.query(
        `
        SELECT
          l.id,
          l.appointment_id,
          l.visit_id,
          l.item_code,
          COALESCE(i.name, l.item_code) AS item_name,
          l.qty_used,
          l.created_at
        FROM inventory_usage_logs l
        LEFT JOIN inventory_items i ON i.id = l.item_id
        WHERE l.appointment_id = ?
        ORDER BY l.id DESC
        LIMIT 20
        `,
        [dbId]
      );
      const [invoiceRows] = await pool.query(
        `
        SELECT id, amount, status, issue_date, paid_date
        FROM invoices
        WHERE appointment_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [dbId]
      );

      return res.json({
        item: {
          ...rows[0],
          consumables: usageRows || [],
          invoice: invoiceRows?.[0] || null,
        },
      });
    } catch (err) {
      console.error("ADMIN APPOINTMENT DETAILS ERROR:", err);
      return res.status(500).json({ message: "Failed to load appointment details" });
    }
  }
);


app.patch(
  `${ADMIN_BASE}/appointments/:dbId`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const status = String(req.body?.status || "").trim();
      const reason = String(req.body?.reason || "").trim();
      const note = String(req.body?.note || "").trim();
      if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: "Invalid appointment id" });
      if (!status) return res.status(400).json({ message: "Status is required" });
      const [existingRows] = await pool.query(`SELECT status FROM appointments WHERE id = ? LIMIT 1`, [dbId]);
      if (!existingRows.length) return res.status(404).json({ message: "Appointment not found" });
      const currentStatus = String(existingRows[0].status || "").trim().toLowerCase();
      const nextStatus = status.toLowerCase();
      const isTerminalCurrent =
        currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "no-show";
      if (isTerminalCurrent && currentStatus !== nextStatus) {
        return res.status(409).json({
          message: "Appointment is in terminal state and cannot be changed",
          status: existingRows[0].status,
        });
      }
      if (nextStatus !== "cancelled") {
        return res.status(403).json({ message: "Admin can only cancel from this endpoint" });
      }
      if (!reason || !note) {
        return res.status(400).json({ message: "Cancel reason and note are required" });
      }
      await pool.query(`UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?`, [status, dbId]);
      await writeAppointmentAuditAction({
        appointmentId: dbId,
        actorUserId: req.user?.id || null,
        action: "CANCELLED_BY_ADMIN",
        reason,
        note,
        meta: {
          fromStatus: existingRows[0].status,
          toStatus: status,
        },
      });
      return res.json({ ok: true, id: dbId, status });
    } catch (err) {
      console.error("ADMIN APPOINTMENT STATUS UPDATE ERROR:", err);
      return res.status(500).json({ message: "Failed to update appointment status" });
    }
  }
);

app.post(
  `${ADMIN_BASE}/appointments`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    const { patientUid, doctorUid, date, time, type, status, operatoryId } = req.body || {};

    if (!patientUid || !doctorUid || !date || !time) {
      return res.status(400).json({ message: "patientUid, doctorUid, date, and time are required" });
    }

    try {
      // Resolve patient by UID
      const [rowsPatient] = await pool.query(
        `SELECT id FROM users WHERE uid = ? AND role = 'Patient' LIMIT 1`,
        [patientUid]
      );
      if (rowsPatient.length === 0) {
        return res.status(400).json({ message: `Patient not found for UID ${patientUid}` });
      }
      const patientId = rowsPatient[0].id;

      // Resolve doctor by UID
      const [rowsDoctor] = await pool.query(
        `SELECT id FROM users WHERE uid = ? AND role = 'Doctor' LIMIT 1`,
        [doctorUid]
      );
      if (rowsDoctor.length === 0) {
        return res.status(400).json({ message: `Doctor not found for UID ${doctorUid}` });
      }
      const doctorId = rowsDoctor[0].id;

      const dateStr = toDateStr(date); // YYYY-MM-DD
      const timeStr = toTimeStr(time); // HH:MM:SS

      // ✅ Predict duration + suggestSlots + hasConflict (guard require)
      let predictDurationMinutes = async () => 30;
      let suggestSlots = async () => [];
      let hasConflictFn = null;

      try {
        const appointmentAgent = require("./agents/appointmentAgent");
        if (typeof appointmentAgent.predictDurationMinutes === "function") {
          predictDurationMinutes = appointmentAgent.predictDurationMinutes;
        }
        if (typeof appointmentAgent.suggestSlots === "function") {
          suggestSlots = appointmentAgent.suggestSlots;
        }
        if (typeof appointmentAgent.hasConflict === "function") {
          hasConflictFn = appointmentAgent.hasConflict;
        }
      } catch (_) {
        // Node agents missing => keep defaults/fallback DB overlap check below
      }

      const durationMin = await predictDurationMinutes(pool, { type: type || "General", doctorId });

      // ✅ Conflict check (uses Node agent if available; fallback is DB-safe)
      let conflict = false;

      if (hasConflictFn) {
        conflict = await hasConflictFn(pool, {
          doctorId,
          operatoryId: operatoryId || null,
          dateStr,
          startTime: timeStr,
          durationMin,
        });
      } else {
        try {
          // Compute end time
          const [[trow]] = await pool.query(
            `SELECT TIME_FORMAT(ADDTIME(?, SEC_TO_TIME(?*60)), '%H:%i:%s') AS end_time`,
            [timeStr, durationMin]
          );
          const endTime = trow.end_time;

          // Prefer scheduled_end_time overlap logic when column exists
          if (schemaCaps.appointments_has_scheduled_end_time) {
            const [rowsConflict] = await pool.query(
              `
              SELECT 1
              FROM appointments
              WHERE doctor_id = ?
                AND scheduled_date = ?
                AND status NOT IN ('Cancelled')
                AND TIMESTAMP(scheduled_date, scheduled_time) < TIMESTAMP(?, ?)
                AND TIMESTAMP(scheduled_date, scheduled_end_time) > TIMESTAMP(?, ?)
              LIMIT 1
              `,
              [doctorId, dateStr, dateStr, endTime, dateStr, timeStr]
            );
            if (rowsConflict.length) conflict = true;

            if (!conflict && schemaCaps.appointments_has_operatory_id && operatoryId) {
              const [rowsOpConflict] = await pool.query(
                `
                SELECT 1
                FROM appointments
                WHERE operatory_id = ?
                  AND scheduled_date = ?
                  AND status NOT IN ('Cancelled')
                  AND TIMESTAMP(scheduled_date, scheduled_time) < TIMESTAMP(?, ?)
                  AND TIMESTAMP(scheduled_date, scheduled_end_time) > TIMESTAMP(?, ?)
                LIMIT 1
                `,
                [operatoryId, dateStr, dateStr, endTime, dateStr, timeStr]
              );
              if (rowsOpConflict.length) conflict = true;
            }
          } else {
            // Fallback if scheduled_end_time doesn't exist: approximate with predicted_duration_min
            const [rows] = await pool.query(
              `
              SELECT scheduled_time, predicted_duration_min
              FROM appointments
              WHERE doctor_id = ?
                AND scheduled_date = ?
                AND status NOT IN ('Cancelled')
              `,
              [doctorId, dateStr]
            );

            const toMin = (t) => {
              const [hh, mm] = String(t || "00:00:00").split(":").map((x) => parseInt(x, 10));
              return (hh || 0) * 60 + (mm || 0);
            };
            const sNew = toMin(timeStr);
            const eNew = sNew + durationMin;

            for (const r of rows) {
              const s = toMin(toTimeStr(r.scheduled_time));
              const d = Number(r.predicted_duration_min || 0) || 30;
              const e = s + d;
              if (sNew < e && eNew > s) {
                conflict = true;
                break;
              }
            }
          }
        } catch (e) {
          // If conflict query fails for any schema mismatch, don't block booking (but log)
          console.error("Conflict fallback check error:", e?.message || e);
          conflict = false;
        }
      }

      if (conflict) {
        const suggestedSlots = await buildSuggestedSlots({
          doctorId,
          operatoryId: operatoryId || null,
          dateStr,
          startTime: timeStr,
          durationMin: mapDurationMinutes({ type, reason: req.body?.reason }),
          maxSlots: 12,
        });

        console.log("CONFLICT_SUGGEST parsed:", {
          doctorId,
          patientId,
          durationMin,
          slots: suggestedSlots.length,
        });

        return res.status(409).json({
          message: "Time slot conflict: doctor already has an overlapping appointment.",
          conflict: true,
          suggestedSlots,
        });
      }


      // generate BOTH UID and CODE
      const appointmentUid = `APT-${Date.now()}`;
      const appointmentCode = `AC-${Date.now()}`;

      // INSERT (unchanged columns)
      const [result] = await pool.query(
        `
        INSERT INTO appointments
          (appointment_uid, appointment_code, patient_id, doctor_id, scheduled_date, scheduled_time, type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [appointmentUid, appointmentCode, patientId, doctorId, dateStr, timeStr, type || "General", status || "Confirmed"]
      );

      const appointmentDbId = result.insertId;

      // ✅ Fill predicted duration + end time (same as before)
      try {
        await pool.query(
          `UPDATE appointments
           SET predicted_duration_min = ?, scheduled_end_time = ADDTIME(scheduled_time, SEC_TO_TIME(?*60))
           WHERE id = ?`,
          [durationMin, durationMin, appointmentDbId]
        );
      } catch (_) { }

      // ✅ Emit event for Python agents (DB outbox)
      await enqueueEventCompat({
        eventType: "AppointmentCreated",
        payload: {
          appointmentId: appointmentDbId,
          appointmentUid,
          patientId,
          doctorId,
          date: dateStr,
          time: timeStr,
          type: type || "General",
          operatoryId: operatoryId || null,
        },
        createdByUserId: req.user?.id || null,
      });

      // In-app notifications for all relevant roles on appointment creation
      try {
        const pretty = `${dateStr} ${String(timeStr).slice(0, 5)}`;

        await insertNotificationInline({
          userRole: "Admin",
          title: "Appointment Created",
          message: `Appointment #${appointmentDbId} created for ${pretty}.`,
          notifType: "APPOINTMENT_CREATED",
          relatedType: "appointments",
          relatedId: appointmentDbId,
          meta: { appointmentUid, patientId, doctorId, date: dateStr, time: timeStr, type: type || "General" },
          priority: 140,
        });

        await insertNotificationInline({
          userId: doctorId,
          title: "New Appointment Assigned",
          message: `You have a ${type || "General"} appointment on ${pretty}.`,
          notifType: "APPOINTMENT_CREATED",
          relatedType: "appointments",
          relatedId: appointmentDbId,
          meta: { appointmentUid, patientId, doctorId, date: dateStr, time: timeStr, type: type || "General" },
          priority: 135,
        });

        await insertNotificationInline({
          userId: patientId,
          title: "Appointment Confirmed",
          message: `Your appointment is scheduled for ${pretty}.`,
          notifType: "APPOINTMENT_CREATED",
          relatedType: "appointments",
          relatedId: appointmentDbId,
          meta: { appointmentUid, patientId, doctorId, date: dateStr, time: timeStr, type: type || "General" },
          priority: 130,
        });
      } catch (notifyErr) {
        console.error("Appointment created notification error:", notifyErr);
      }

      try {
        await createReminderJobsIfPossible({
          appointmentId: appointmentDbId,
          patientId,
          doctorId,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          channels: ["IN_APP", "WHATSAPP", "SMS", "CALL"],
        });
      } catch (reminderErr) {
        console.error("Appointment reminder job create error:", reminderErr?.message || reminderErr);
      }

      return res.status(201).json({
        appointment: {
          id: appointmentUid,
          code: appointmentCode,
          dbId: appointmentDbId,
          date: dateStr,
          time: timeStr,
          type: type || "General",
          status: status || "Confirmed",
          patientUid,
          doctorUid,
        },
      });
    } catch (err) {
      console.error("ADMIN CREATE APPOINTMENT ERROR:", err);
      return res.status(500).json({ message: "Failed to create appointment. See server logs." });
    }
  }
);

// ✅ NEW: mark appointment completed (triggers Inventory + Revenue + Case timeline via event queue)
app.patch(
  `${ADMIN_BASE}/appointments/:dbId/complete`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const reason = String(req.body?.reason || "").trim();
      const note = String(req.body?.note || "").trim();
      if (!reason || !note) {
        return res.status(400).json({ message: "Force close reason and note are required" });
      }
      const [rows] = await pool.query(`SELECT * FROM appointments WHERE id = ? LIMIT 1`, [dbId]);
      if (rows.length === 0) return res.status(404).json({ message: "Appointment not found" });
      const currentStatus = String(rows[0].status || "").trim().toLowerCase();
      if (currentStatus === "completed") {
        return res.status(409).json({ message: "Appointment is already completed", status: rows[0].status });
      }

      await pool.query(
        `UPDATE appointments
         SET status = 'Completed',
             actual_end_at = COALESCE(actual_end_at, NOW())
         WHERE id = ?`,
        [dbId]
      );
      await writeAppointmentAuditAction({
        appointmentId: dbId,
        actorUserId: req.user?.id || null,
        action: "FORCE_CLOSED_BY_ADMIN",
        reason,
        note,
        meta: {
          fromStatus: rows[0].status,
          toStatus: "Completed",
        },
      });

      await enqueueEventCompat({
        eventType: "AppointmentCompleted",
        payload: {
          appointmentId: dbId,
          patientId: rows[0].patient_id,
          doctorId: rows[0].doctor_id,
          type: rows[0].type || "General",
          linkedCaseId: rows[0].linked_case_id || null,
        },
        createdByUserId: req.user?.id || null,
      });

      // ✅ Inline fallback to keep inventory in sync if agents aren't running
      try {
        await applyInventoryConsumptionFromVisit({
          appointmentId: dbId,
          doctorId: rows[0].doctor_id,
          userId: req.user?.id || null,
        });
      } catch (e) {
        console.error("Inline inventory consumption failed:", e?.message || e);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("COMPLETE APPOINTMENT ERROR:", err);
      return res.json({ ok: false, error: true });
    }
  }
);

app.patch(
  `${ADMIN_BASE}/appointments/:dbId/no-show-override`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const status = String(req.body?.status || "Confirmed").trim();
      const reason = String(req.body?.reason || "").trim();
      const note = String(req.body?.note || "").trim();
      if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: "Invalid appointment id" });
      if (!reason || !note) return res.status(400).json({ message: "Override reason and note are required" });

      const [rows] = await pool.query(`SELECT status FROM appointments WHERE id = ? LIMIT 1`, [dbId]);
      if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
      const current = String(rows[0].status || "").trim().toLowerCase();
      if (current !== "no-show" && current !== "no show") {
        return res.status(409).json({ message: "No-show override is only allowed for no-show appointments" });
      }

      const allowed = new Set(["confirmed", "cancelled"]);
      if (!allowed.has(status.toLowerCase())) {
        return res.status(400).json({ message: "Override status must be Confirmed or Cancelled" });
      }

      await pool.query(`UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?`, [status, dbId]);
      await writeAppointmentAuditAction({
        appointmentId: dbId,
        actorUserId: req.user?.id || null,
        action: "NO_SHOW_OVERRIDE_BY_ADMIN",
        reason,
        note,
        meta: {
          fromStatus: rows[0].status,
          toStatus: status,
        },
      });

      return res.json({ ok: true, id: dbId, status });
    } catch (err) {
      console.error("ADMIN NO-SHOW OVERRIDE ERROR:", err);
      return res.status(500).json({ message: "Failed to override no-show" });
    }
  }
);

app.post(
  `${ADMIN_BASE}/appointments/:id/reminder-preview`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }
      const [rows] = await pool.query(
        `
        SELECT id, patient_id, doctor_id,
               DATE_FORMAT(scheduled_date, '%Y-%m-%d') AS scheduled_date,
               TIME_FORMAT(scheduled_time, '%H:%i:%s') AS scheduled_time,
               status
        FROM appointments
        WHERE id = ?
        LIMIT 1
        `,
        [appointmentId]
      );
      if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
      const appt = rows[0];
      const channels = Array.isArray(req.body?.channels) && req.body.channels.length
        ? req.body.channels.map((c) => String(c).toUpperCase())
        : ["IN_APP", "WHATSAPP", "SMS", "CALL"];
      const schedule = buildReminderSchedule({
        scheduledDate: appt.scheduled_date,
        scheduledTime: appt.scheduled_time,
      });

      const previewJobs = [];
      for (const channel of channels) {
        for (const slot of schedule) {
          previewJobs.push({
            channel,
            status: "QUEUED",
            scheduledAt: formatDateTime(slot.scheduledAt),
            messageWindow: slot.label,
            targetUsers: [appt.patient_id, appt.doctor_id].filter(Boolean),
          });
        }
      }
      return res.json({
        appointmentId,
        status: appt.status,
        channelTargets: channels,
        jobs: previewJobs,
      });
    } catch (err) {
      console.error("REMINDER PREVIEW ERROR:", err);
      return res.status(500).json({ message: "Failed to generate reminder preview" });
    }
  }
);

// ✅ ADMIN: RESCHEDULE SUGGESTIONS (auto-reschedule workflow)
app.get(
  `${ADMIN_BASE}/reschedule-suggestions`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      if (!(await tableExists("appointment_reschedule_suggestions"))) {
        return res.json({ items: [] });
      }

      const status = String(req.query.status || "PENDING").toUpperCase();
      const [rows] = await pool.query(
        `
        SELECT s.id,
               s.appointment_id,
               s.reason,
               s.suggested_slots_json,
               s.status,
               s.created_at,
               a.scheduled_date,
               a.scheduled_time,
               p.full_name AS patient_name,
               d.full_name AS doctor_name
        FROM appointment_reschedule_suggestions s
        LEFT JOIN appointments a ON a.id = s.appointment_id
        LEFT JOIN users p ON p.id = a.patient_id
        LEFT JOIN users d ON d.id = a.doctor_id
        WHERE (? = '' OR UPPER(s.status) = ?)
        ORDER BY s.created_at DESC
        LIMIT 200
        `,
        [status === "ALL" ? "" : status, status === "ALL" ? "" : status]
      );

      const items = (rows || []).map((r) => {
        let slots = [];
        try {
          slots = r.suggested_slots_json ? JSON.parse(r.suggested_slots_json) : [];
        } catch (_) {
          slots = [];
        }
        return {
          id: r.id,
          appointmentId: r.appointment_id,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
          scheduledDate: r.scheduled_date,
          scheduledTime: r.scheduled_time,
          patientName: r.patient_name,
          doctorName: r.doctor_name,
          suggestedSlots: slots,
        };
      });

      return res.json({ items });
    } catch (err) {
      console.error("ADMIN RESCHEDULE SUGGESTIONS ERROR:", err);
      return res.json({ items: [], error: true });
    }
  }
);

app.post(
  `${ADMIN_BASE}/reschedule-suggestions/:id/apply`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      if (!(await tableExists("appointment_reschedule_suggestions"))) {
        return res.status(404).json({ message: "Suggestions table missing" });
      }
      const suggestionId = Number(req.params.id);
      if (!Number.isFinite(suggestionId) || suggestionId <= 0) {
        return res.status(400).json({ message: "Invalid suggestion id" });
      }

      const [rows] = await pool.query(
        `SELECT * FROM appointment_reschedule_suggestions WHERE id = ? LIMIT 1`,
        [suggestionId]
      );
      if (!rows.length) return res.status(404).json({ message: "Suggestion not found" });

      const suggestion = rows[0];
      if (String(suggestion.status || "").toUpperCase() !== "PENDING") {
        return res.status(409).json({ message: "Suggestion already processed" });
      }

      let slots = [];
      try {
        slots = suggestion.suggested_slots_json ? JSON.parse(suggestion.suggested_slots_json) : [];
      } catch (_) {
        slots = [];
      }

      const { slotIndex, slot } = req.body || {};
      let chosen = slot || null;
      if (!chosen && Number.isFinite(slotIndex)) {
        chosen = slots[Number(slotIndex)];
      }
      if (!chosen || !chosen.date || !chosen.startTime) {
        return res.status(400).json({ message: "Valid slot or slotIndex required" });
      }

      const appointmentId = Number(suggestion.appointment_id);
      const [apptRows] = await pool.query(
        `SELECT * FROM appointments WHERE id = ? LIMIT 1`,
        [appointmentId]
      );
      if (!apptRows.length) return res.status(404).json({ message: "Appointment not found" });

      const appt = apptRows[0];
      const apptCols = await getTableColumns("appointments");
      const sets = ["scheduled_date = ?", "scheduled_time = ?"];
      const params = [chosen.date, toTimeStr(chosen.startTime)];

      if (apptCols.has("scheduled_end_time") && chosen.endTime) {
        sets.push("scheduled_end_time = ?");
        params.push(toTimeStr(chosen.endTime));
      }

      if (apptCols.has("updated_at")) {
        sets.push("updated_at = NOW()");
      }

      // Status -> Confirmed
      const statusValues = await getEnumValues("appointments", "status");
      const pickedStatus = pickEnumValue(statusValues, ["Confirmed", "CONFIRMED"], "Confirmed");
      if (pickedStatus) {
        sets.push("status = ?");
        params.push(pickedStatus);
      }

      params.push(appointmentId);
      await pool.query(`UPDATE appointments SET ${sets.join(", ")} WHERE id = ?`, params);

      await pool.query(
        `UPDATE appointment_reschedule_suggestions SET status='APPLIED', updated_at=NOW() WHERE id = ?`,
        [suggestionId]
      );

      await insertAppointmentAudit(appointmentId, req.user?.id || null, "RESCHEDULED", {
        suggestionId,
        chosen,
      });

      // Notify patient, doctor, admin
      const pretty = `${chosen.date} ${String(chosen.startTime).slice(0, 5)}`;
      if (appt.patient_id) {
        await insertNotificationInline({
          userId: appt.patient_id,
          title: "Appointment Rescheduled",
          message: `Your appointment has been rescheduled to ${pretty}.`,
          notifType: "APPOINTMENT_RESCHEDULED",
          relatedType: "appointments",
          relatedId: appointmentId,
          meta: { chosen, suggestionId },
          priority: 140,
        });
      }
      if (appt.doctor_id) {
        await insertNotificationInline({
          userId: appt.doctor_id,
          title: "Appointment Rescheduled",
          message: `Appointment #${appointmentId} rescheduled to ${pretty}.`,
          notifType: "APPOINTMENT_RESCHEDULED",
          relatedType: "appointments",
          relatedId: appointmentId,
          meta: { chosen, suggestionId },
          priority: 145,
        });
      }
      await insertNotificationInline({
        userRole: "Admin",
        title: "Appointment Rescheduled",
        message: `Appointment #${appointmentId} rescheduled to ${pretty}.`,
        notifType: "APPOINTMENT_RESCHEDULED",
        relatedType: "appointments",
        relatedId: appointmentId,
        meta: { chosen, suggestionId },
        priority: 150,
      });

      return res.json({ ok: true, appointmentId, suggestionId, chosen });
    } catch (err) {
      console.error("APPLY RESCHEDULE SUGGESTION ERROR:", err);
      return res.status(500).json({ ok: false, error: true });
    }
  }
);

// ✅ NEW: agent test endpoints (kept; if Node hooks missing, still supports Python via enqueue)
app.post(
  `${ADMIN_BASE}/agents/run`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const { agent } = req.body || {};
      if (!agent) return res.status(400).json({ message: "agent required" });
      const normalized = String(agent).trim().toLowerCase();

      // Legacy Node direct-run hooks (optional)
      if (normalized === "appointment" && runAppointmentAgentOnce) return res.json(await runAppointmentAgentOnce(pool));
      if (normalized === "inventory" && runInventoryAgentOnce) return res.json(await runInventoryAgentOnce(pool));
      if (normalized === "revenue" && runRevenueAgentOnce) return res.json(await runRevenueAgentOnce(pool));

      // Python worker path: enqueue actionable events (not a no-op marker)
      const eventMap = {
        appointment: "AppointmentMonitorTick",
        inventory: "InventoryMonitorTick",
        revenue: "RevenueMonitorTick",
        case: "CaseMonitorTick",
        case_tracking: "CaseMonitorTick",
      };
      const eventType = eventMap[normalized];
      if (!eventType) {
        return res.status(400).json({ message: "Unknown agent. Use appointment|inventory|revenue|case" });
      }

      await enqueueEventCompat({
        eventType,
        payload: { source: "admin_run", requestedAgent: normalized },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true, queued: true, agent: normalized, eventType });
    } catch (err) {
      console.error("AGENT RUN ERROR:", err);
      return res.json({ error: true });
    }
  }
);

app.get(
  `${ADMIN_BASE}/agents/status`,
  authMiddleware,
  requireRole("Admin"),
  async (_req, res) => {
    try {
      const items = await safeQuery(
        "AGENT STATUS COUNTS",
        `SELECT event_type AS eventType, status, COUNT(*) AS count
         FROM agent_events
         GROUP BY event_type, status
         ORDER BY event_type, status`,
        []
      );

      const recent = await safeQuery(
        "AGENT STATUS RECENT",
        `SELECT id, event_type AS eventType, status, locked_by AS lockedBy, last_error AS lastError, created_at AS createdAt, updated_at AS updatedAt
         FROM agent_events
         ORDER BY id DESC
         LIMIT 50`,
        []
      );

      const summary = {};
      for (const row of items || []) {
        const k = row.eventType || "Unknown";
        if (!summary[k]) summary[k] = { NEW: 0, PROCESSING: 0, DONE: 0, FAILED: 0, DEAD: 0 };
        const s = String(row.status || "").toUpperCase();
        if (summary[k][s] !== undefined) summary[k][s] = Number(row.count || 0);
      }

      return res.json({ ok: true, summary, recent: recent || [] });
    } catch (err) {
      console.error("AGENT STATUS ERROR:", err);
      return res.status(500).json({ ok: false, message: "Failed to fetch agent status" });
    }
  }
);

function eventBucketName(eventType) {
  const t = String(eventType || "").toLowerCase();
  if (t.includes("appointment")) return "appointment";
  if (t.includes("invent")) return "inventory";
  if (t.includes("revenue") || t.includes("invoice")) return "revenue";
  if (t.includes("case")) return "case_tracking";
  return "other";
}

app.get(
  `${ADMIN_BASE}/agent-events`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
      const cursor = Number(req.query.cursor || 0);
      const eventType = String(req.query.event_type || "").trim();
      const status = String(req.query.status || "").trim().toUpperCase();
      const entityType = String(req.query.entity_type || "").trim();
      const entityId = Number(req.query.entity_id || 0);

      const where = ["1=1"];
      const vals = [];
      if (cursor > 0) {
        where.push("id < ?");
        vals.push(cursor);
      }
      if (eventType) {
        where.push("event_type = ?");
        vals.push(eventType);
      }
      if (status) {
        where.push("status = ?");
        vals.push(status);
      }
      if (entityType) {
        where.push("payload_json LIKE ?");
        vals.push(`%\"entityType\":\"${entityType}\"%`);
      }
      if (entityId > 0) {
        where.push("(payload_json LIKE ? OR payload_json LIKE ?)");
        vals.push(`%\"entityId\":${entityId}%`);
        vals.push(`%\"entityId\":\"${entityId}\"%`);
      }

      vals.push(limit);
      const [rows] = await pool.query(
        `
        SELECT id, event_type, status, payload_json, attempts, max_attempts, available_at, created_at, updated_at, last_error
        FROM agent_events
        WHERE ${where.join(" AND ")}
        ORDER BY id DESC
        LIMIT ?
        `,
        vals
      );
      const items = (rows || []).map((r) => ({
        id: r.id,
        eventType: r.event_type,
        bucket: eventBucketName(r.event_type),
        status: r.status,
        attempts: Number(r.attempts || 0),
        maxAttempts: Number(r.max_attempts || 0),
        availableAt: r.available_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastError: r.last_error || null,
        payload: safeJsonParse(r.payload_json, {}),
      }));
      return res.json({
        items,
        nextCursor: items.length ? items[items.length - 1].id : null,
      });
    } catch (err) {
      console.error("ADMIN AGENT EVENTS ERROR:", err);
      return res.status(500).json({ items: [], message: "Failed to load agent events" });
    }
  }
);

app.get(
  `${ADMIN_BASE}/agents/feature-status`,
  authMiddleware,
  requireRole("Admin"),
  async (_req, res) => {
    try {
      const [eventRows] = await pool.query(
        `
        SELECT id, event_type, status, updated_at
        FROM agent_events
        ORDER BY id DESC
        LIMIT 400
        `
      );
      const [notifRows] = await pool.query(
        `
        SELECT id, type, status, created_at
        FROM notifications
        ORDER BY id DESC
        LIMIT 200
        `
      );

      const base = {
        appointment: { total: 0, done: 0, failed: 0, processing: 0, latest: null },
        inventory: { total: 0, done: 0, failed: 0, processing: 0, latest: null },
        revenue: { total: 0, done: 0, failed: 0, processing: 0, latest: null },
        case_tracking: { total: 0, done: 0, failed: 0, processing: 0, latest: null },
      };

      for (const row of eventRows || []) {
        const bucket = eventBucketName(row.event_type);
        if (!base[bucket]) continue;
        base[bucket].total += 1;
        const s = String(row.status || "").toUpperCase();
        if (s === "DONE") base[bucket].done += 1;
        if (s === "FAILED" || s === "DEAD") base[bucket].failed += 1;
        if (s === "NEW" || s === "PROCESSING") base[bucket].processing += 1;
        if (!base[bucket].latest) {
          base[bucket].latest = {
            eventId: row.id,
            eventType: row.event_type,
            status: row.status,
            updatedAt: row.updated_at,
          };
        }
      }

      return res.json({
        buckets: base,
        notificationSummary: {
          total: (notifRows || []).length,
          sent: (notifRows || []).filter((n) => String(n.status || "").toUpperCase() === "SENT").length,
          pending: (notifRows || []).filter((n) => ["NEW", "PENDING"].includes(String(n.status || "").toUpperCase())).length,
          failed: (notifRows || []).filter((n) => String(n.status || "").toUpperCase() === "FAILED").length,
        },
      });
    } catch (err) {
      console.error("ADMIN AGENT FEATURE STATUS ERROR:", err);
      return res.status(500).json({ message: "Failed to load feature status" });
    }
  }
);

app.post(
  `${ADMIN_BASE}/agents/retry-failed-events`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const n = await retryFailedCompat(100);
      return res.json({ retried: n });
    } catch (err) {
      console.error("RETRY FAILED EVENTS ERROR:", err);
      return res.json({ retried: 0, error: true });
    }
  }
);

// SIMPLE CASES LIST (UNCHANGED)
app.get(
  `${ADMIN_BASE}/cases`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "ADMIN CASES SIMPLE",
        `SELECT
           c.case_uid,
           c.case_type,
           c.stage,
           p.full_name AS patient_name,
           d.full_name AS doctor_name
         FROM cases c
         LEFT JOIN users p ON p.id = c.patient_id
         LEFT JOIN users d ON d.id = c.doctor_id
         ORDER BY c.created_at DESC`,
        []
      );

      const items = rows.map((r) => ({
        id: r.case_uid,
        patient: r.patient_name || "—",
        doctor: r.doctor_name || "—",
        type: r.case_type || "General case",
        stage: r.stage || "NEW",
      }));

      res.json({ items });
    } catch (err) {
      console.error("ADMIN CASES HANDLER ERROR:", err);
      res.json({ items: [], error: true });
    }
  }
);

// ✅ NEW: export case PDF (kept; if Node hook missing -> 501)
app.get(
  `${ADMIN_BASE}/cases/:caseDbId/export/pdf`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      if (!exportCasePdf) return res.status(501).json({ message: "PDF export not enabled" });

      const caseId = Number(req.params.caseDbId);

      const outDir = path.join(__dirname, "exports");
      fs.mkdirSync(outDir, { recursive: true });

      const outPath = path.join(outDir, `case-${caseId}.pdf`);
      await exportCasePdf(pool, { caseId, outPath });

      return res.download(outPath);
    } catch (err) {
      console.error("CASE PDF EXPORT ERROR:", err);
      return res.status(500).json({ message: "Failed to export PDF" });
    }
  }
);

// ✅ NEW: CREATE INVENTORY ITEM (for AdminInventory "+ New item")
app.post(
  `${ADMIN_BASE}/inventory`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const { itemCode, name, category, stock, reorderThreshold, expiryDate, vendorId, vendor_id } = req.body || {};

      if (!itemCode || !name) {
        return res.status(400).json({ message: "itemCode and name are required" });
      }

      const code = String(itemCode).trim();
      const nm = String(name).trim();
      const cat = String(category || "Uncategorized").trim();

      const stockNum = Number(stock);
      const rtNum = Number(reorderThreshold);

      if (!Number.isFinite(stockNum) || stockNum < 0) return res.status(400).json({ message: "stock must be 0 or greater" });
      if (!Number.isFinite(rtNum) || rtNum < 0) return res.status(400).json({ message: "reorderThreshold must be 0 or greater" });

      let status = "Healthy";
      if (stockNum <= rtNum) status = "Low";
      else if (stockNum <= Math.ceil(rtNum * 1.5)) status = "Reorder soon";

      const exp = expiryDate ? toDateStr(expiryDate) : null;
      const vendorIdNum = Number(vendorId ?? vendor_id);
      const vendorIdVal = Number.isFinite(vendorIdNum) && vendorIdNum > 0 ? Math.floor(vendorIdNum) : null;

      await pool.query(
        `
        INSERT INTO inventory_items
          (item_code, name, category, stock, status, reorder_threshold, expiry_date, vendor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [code, nm, cat, Math.floor(stockNum), status, Math.floor(rtNum), exp, vendorIdVal]
      );

      return res.status(201).json({
        message: "Item created",
        item: {
          id: code,
          name: nm,
          category: cat,
          stock: Math.floor(stockNum),
          status,
          reorderThreshold: Math.floor(rtNum),
          expiryDate: exp,
          vendorId: vendorIdVal,
        },
      });
    } catch (err) {
      console.error("ADMIN CREATE INVENTORY ERROR:", err);
      if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Item code already exists" });
      return res.status(500).json({ message: "Failed to create inventory item" });
    }
  }
);

// INVENTORY (UPDATED: include expiry_date)
app.get(
  `${ADMIN_BASE}/inventory`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const cols = await getTableColumns("inventory_items");
      const stockCol = pickCol(cols, ["stock", "quantity_on_hand", "current_stock", "on_hand"]);
      const reorderCol = pickCol(cols, ["reorder_threshold", "reorder_level", "low_stock_threshold"]);
      const expiryCol = pickCol(cols, ["expiry_date", "expires_on"]);

      const rows = await safeQuery(
        "ADMIN INVENTORY",
        `
        SELECT
          item_code,
          name,
          category,
          ${stockCol ? stockCol : "0"} AS stock,
          status,
          ${reorderCol ? reorderCol : "NULL"} AS reorder_threshold,
          ${expiryCol ? expiryCol : "NULL"} AS expiry_date,
          ${cols.has("vendor_id") ? "vendor_id" : "NULL"} AS vendor_id
        FROM inventory_items
        ORDER BY name ASC
        `,
        []
      );

      const items = rows.map((r) => ({
        id: r.item_code,
        name: r.name,
        category: r.category,
        stock: Number(r.stock || 0),
        status: r.status,
        reorderThreshold: r.reorder_threshold != null ? Number(r.reorder_threshold) : null,
        expiryDate: r.expiry_date || null,
        vendorId: r.vendor_id || null,
      }));

      res.json({ items });
    } catch (err) {
      console.error("ADMIN INVENTORY HANDLER ERROR:", err);
      res.json({ items: [], error: true });
    }
  }
);

// ✅ ADMIN: PURCHASE ORDERS (list + update)
app.get(
  `${ADMIN_BASE}/purchase-orders`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      if (!(await tableExists("purchase_orders"))) {
        return res.json({ items: [] });
      }
      const [rows] = await pool.query(
        `
        SELECT po.id,
               po.status,
               po.notes,
               po.created_at,
               po.updated_at,
               po.vendor_id,
               v.name AS vendor_name,
               COUNT(poi.id) AS item_count,
               COALESCE(SUM(poi.qty), 0) AS total_qty
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
        GROUP BY po.id
        ORDER BY po.created_at DESC
        LIMIT 200
        `
      );
      return res.json({ items: rows || [] });
    } catch (err) {
      console.error("ADMIN PURCHASE ORDERS ERROR:", err);
      return res.json({ items: [], error: true });
    }
  }
);


app.get(
  `${ADMIN_BASE}/purchase-orders/:id`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "Invalid id" });

      const [headRows] = await pool.query(
        `
        SELECT po.id, po.status, po.notes, po.created_at, po.updated_at, po.vendor_id, v.name AS vendor_name
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        WHERE po.id = ?
        LIMIT 1
        `,
        [id]
      );
      if (!headRows.length) return res.status(404).json({ message: "Purchase order not found" });

      const [itemRows] = await pool.query(
        `
        SELECT
          poi.id,
          poi.item_code,
          poi.qty,
          poi.unit_cost AS unit_price,
          ii.name AS item_name
        FROM purchase_order_items poi
        LEFT JOIN inventory_items ii ON ii.item_code = poi.item_code
        WHERE poi.purchase_order_id = ?
        ORDER BY poi.id ASC
        `,
        [id]
      );

      return res.json({ item: headRows[0], items: itemRows || [] });
    } catch (err) {
      console.error("ADMIN PURCHASE ORDER DETAILS ERROR:", err);
      return res.status(500).json({ message: "Failed to load purchase order details" });
    }
  }
);

app.patch(
  `${ADMIN_BASE}/purchase-orders/:id`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      if (!(await tableExists("purchase_orders"))) {
        return res.status(404).json({ message: "purchase_orders table missing" });
      }
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "Invalid id" });

      const { status, notes } = req.body || {};
      const cols = await getTableColumns("purchase_orders");

      const sets = [];
      const vals = [];
      if (cols.has("status") && status) {
        sets.push("status = ?");
        vals.push(String(status));
      }
      if (cols.has("notes") && typeof notes === "string") {
        sets.push("notes = ?");
        vals.push(notes);
      }
      if (cols.has("updated_at")) {
        sets.push("updated_at = NOW()");
      }
      if (!sets.length) return res.status(400).json({ message: "No fields to update" });

      vals.push(id);
      await pool.query(`UPDATE purchase_orders SET ${sets.join(", ")} WHERE id = ?`, vals);

      return res.json({ ok: true, id });
    } catch (err) {
      console.error("ADMIN PURCHASE ORDERS UPDATE ERROR:", err);
      return res.status(500).json({ ok: false, error: true });
    }
  }
);

// ✅ ADMIN: VENDORS (list + create)
app.get(
  `${ADMIN_BASE}/vendors`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "ADMIN VENDORS",
        `SELECT id, name, phone, email FROM vendors ORDER BY name ASC`,
        []
      );
      res.json({ items: rows || [] });
    } catch (err) {
      console.error("ADMIN VENDORS GET ERROR:", err);
      res.json({ items: [], error: true });
    }
  }
);

app.post(
  `${ADMIN_BASE}/vendors`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const { name, phone, email } = req.body || {};
      const nm = String(name || "").trim();
      if (!nm) return res.status(400).json({ message: "Vendor name is required" });

      const ph = phone ? String(phone).trim() : null;
      const em = email ? String(email).trim() : null;

      const [r] = await pool.query(
        `INSERT INTO vendors (name, phone, email) VALUES (?, ?, ?)`,
        [nm, ph, em]
      );

      return res.status(201).json({
        item: { id: r.insertId, name: nm, phone: ph, email: em },
      });
    } catch (err) {
      console.error("ADMIN VENDORS POST ERROR:", err);
      if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Vendor already exists" });
      return res.status(500).json({ message: "Failed to create vendor" });
    }
  }
);

// ✅ ADMIN: INVENTORY update (vendor + thresholds + basics)

app.get(
  `${ADMIN_BASE}/inventory/:itemCode`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const itemCode = String(req.params.itemCode || "").trim();
      if (!itemCode) return res.status(400).json({ message: "itemCode required" });

      // Route-order fallback: "/inventory/usage" may be captured by :itemCode.
      if (itemCode.toLowerCase() === "usage") {
        if (!(await tableExists("inventory_usage_logs"))) {
          return res.json({ items: [] });
        }
        const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
        const [rows] = await pool.query(
          `
          SELECT l.id,
                 l.appointment_id,
                 l.visit_id,
                 l.item_id,
                 l.item_code,
                 l.qty_used,
                 l.source,
                 l.source_type,
                 l.source_ref_id,
                 l.event_id,
                 l.created_at,
                 i.name AS item_name
          FROM inventory_usage_logs l
          LEFT JOIN inventory_items i ON i.id = l.item_id
          ORDER BY l.id DESC
          LIMIT ?
          `,
          [limit]
        );
        return res.json({ items: rows || [] });
      }

      const [rows] = await pool.query(
        `
        SELECT id, item_code, name, category, stock, status, reorder_threshold, expiry_date, vendor_id, updated_at
        FROM inventory_items
        WHERE item_code = ?
        LIMIT 1
        `,
        [itemCode]
      );
      if (!rows.length) return res.status(404).json({ message: "Item not found" });

      const item = rows[0];
      const [usageRows] = await pool.query(
        `
        SELECT
          l.id,
          l.appointment_id,
          l.visit_id,
          l.item_code,
          COALESCE(i.name, l.item_code) AS item_name,
          l.qty_used,
          l.created_at
        FROM inventory_usage_logs l
        LEFT JOIN inventory_items i ON i.id = l.item_id
        WHERE l.item_id = ? OR l.item_code = ?
        ORDER BY l.id DESC
        LIMIT 25
        `,
        [item.id, item.item_code]
      );

      return res.json({ item, usage: usageRows || [] });
    } catch (err) {
      console.error("ADMIN INVENTORY DETAILS ERROR:", err);
      return res.status(500).json({ message: "Failed to load inventory item details" });
    }
  }
);

app.patch(
  `${ADMIN_BASE}/inventory/:itemCode`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const itemCode = String(req.params.itemCode || "").trim();
      if (!itemCode) return res.status(400).json({ message: "itemCode required" });

      const {
        name,
        category,
        stock,
        reorderThreshold,
        expiryDate,
        vendorId,
        vendor_id,
      } = req.body || {};

      const invCols = await getTableColumns("inventory_items");
      const stockCol = pickCol(invCols, ["stock", "quantity_on_hand", "current_stock", "qty_on_hand"]);
      const reorderCol = pickCol(invCols, ["reorder_threshold", "reorder_level", "low_stock_threshold"]);
      const expiryCol = pickCol(invCols, ["expiry_date", "expires_on", "expiry"]);
      const vendorCol = pickCol(invCols, ["vendor_id"]);

      if (!invCols.has("item_code")) {
        return res.status(500).json({ message: "inventory_items missing item_code column" });
      }

      let beforeStock = null;
      let itemId = null;
      if (stockCol) {
        const [rows] = await pool.query(
          `SELECT id, ${stockCol} AS stock FROM inventory_items WHERE item_code = ? LIMIT 1`,
          [itemCode]
        );
        if (!rows.length) return res.status(404).json({ message: "Item not found" });
        beforeStock = Number(rows[0].stock ?? 0);
        itemId = rows[0].id ?? null;
      }

      const sets = [];
      const vals = [];

      if (name != null) {
        sets.push("name = ?");
        vals.push(String(name).trim());
      }
      if (category != null) {
        sets.push("category = ?");
        vals.push(String(category).trim());
      }
      if (stock != null && Number.isFinite(Number(stock))) {
        if (stockCol) {
          sets.push(`${stockCol} = ?`);
          vals.push(Math.max(0, Math.floor(Number(stock))));
        }
      }
      if (reorderThreshold != null && Number.isFinite(Number(reorderThreshold))) {
        if (reorderCol) {
          sets.push(`${reorderCol} = ?`);
          vals.push(Math.max(0, Math.floor(Number(reorderThreshold))));
        }
      }
      if (expiryDate !== undefined) {
        if (expiryCol) {
          sets.push(`${expiryCol} = ?`);
          vals.push(expiryDate ? toDateStr(expiryDate) : null);
        }
      }
      const vIdNum = Number(vendorId ?? vendor_id);
      if (Number.isFinite(vIdNum)) {
        if (vendorCol) {
          sets.push(`${vendorCol} = ?`);
          vals.push(vIdNum > 0 ? Math.floor(vIdNum) : null);
        }
      }

      if (!sets.length) return res.status(400).json({ message: "No fields to update" });

      vals.push(itemCode);
      await pool.query(
        `UPDATE inventory_items SET ${sets.join(", ")}, updated_at = NOW() WHERE item_code = ?`,
        vals
      );

      if (stockCol && stock != null && Number.isFinite(Number(stock))) {
        const afterStock = Math.max(0, Math.floor(Number(stock)));
        if (beforeStock != null && afterStock !== beforeStock) {
          const logCols = await getTableColumns("inventory_usage_logs");
          if (logCols.size) {
            const insertCols = [];
            const insertVals = [];

            if (logCols.has("item_code")) {
              insertCols.push("item_code");
              insertVals.push(itemCode);
            } else if (logCols.has("item_id") && itemId != null) {
              insertCols.push("item_id");
              insertVals.push(itemId);
            }

            if (logCols.has("qty_used")) {
              insertCols.push("qty_used");
              insertVals.push(afterStock - beforeStock);
            } else if (logCols.has("qty")) {
              insertCols.push("qty");
              insertVals.push(afterStock - beforeStock);
            }

            if (logCols.has("source")) {
              const sourceValues = await getEnumValues("inventory_usage_logs", "source");
              insertCols.push("source");
              insertVals.push(pickEnumValue(sourceValues, ["MANUAL", "ADJUSTMENT", "AUTO"], "MANUAL"));
            }

            if (logCols.has("doctor_id") && req.user?.id) {
              insertCols.push("doctor_id");
              insertVals.push(req.user.id);
            }

            if (logCols.has("meta_json")) {
              insertCols.push("meta_json");
              insertVals.push(
                JSON.stringify({
                  before: beforeStock,
                  after: afterStock,
                  delta: afterStock - beforeStock,
                  editedByUserId: req.user?.id || null,
                  itemCode,
                })
              );
            }

            if (logCols.has("created_at")) {
              insertCols.push("created_at");
              insertVals.push(new Date());
            } else if (logCols.has("used_at")) {
              insertCols.push("used_at");
              insertVals.push(new Date());
            }

            if (insertCols.length) {
              const placeholders = insertCols.map(() => "?").join(",");
              await pool.query(
                `INSERT INTO inventory_usage_logs (${insertCols.join(",")}) VALUES (${placeholders})`,
                insertVals
              );
            }
          }
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("ADMIN INVENTORY PATCH ERROR:", err);
      return res.status(500).json({ message: "Failed to update inventory item" });
    }
  }
);

// ✅ NEW: Update Appointment Procedures (Creates Visit + Invoice)
app.put(
  `${ADMIN_BASE}/appointments/:dbId/procedures`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const { items } = req.body || {}; // items: [{ code, qty, unitPrice, notes }]

      if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: "Invalid ID" });
      if (!Array.isArray(items)) return res.status(400).json({ message: "items array required" });

      const [apptRows] = await pool.query("SELECT * FROM appointments WHERE id = ? LIMIT 1", [dbId]);
      if (!apptRows.length) return res.status(404).json({ message: "Appointment not found" });
      const appt = apptRows[0];

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // 1. Ensure Visit Exists
        let [visitRows] = await conn.query("SELECT id FROM visits WHERE appointment_id = ? LIMIT 1", [dbId]);
        let visitId = null;
        if (visitRows.length > 0) {
          visitId = visitRows[0].id;
        } else {
          const visitUid = `VST-${Date.now()}`;
          const [insVisit] = await conn.query(
            `INSERT INTO visits (visit_uid, appointment_id, patient_id, doctor_id, status, created_at)
             VALUES (?, ?, ?, ?, 'OPEN', NOW())`,
            [visitUid, dbId, appt.patient_id, appt.doctor_id]
          );
          visitId = insVisit.insertId;
        }

        // 2. Update Visit Procedures
        await conn.query("DELETE FROM visit_procedures WHERE visit_id = ?", [visitId]);

        let totalAmount = 0;
        const procedureInserts = [];

        for (const it of items) {
          const qty = Number(it.qty || 1);
          const price = Number(it.unitPrice || 0);
          const amount = qty * price;
          totalAmount += amount;

          procedureInserts.push([
            visitId,
            it.code || "MISC",
            qty,
            price,
            amount,
            it.notes || ""
          ]);
        }

        if (procedureInserts.length) {
          await conn.query(
            `INSERT INTO visit_procedures (visit_id, procedure_code, qty, unit_price, amount, notes)
                 VALUES ?`,
            [procedureInserts]
          );
        }

        // 3. Update Invoice (Auto-generate)
        // Check if invoice exists for this appointment
        let [invRows] = await conn.query("SELECT id, status FROM invoices WHERE appointment_id = ? LIMIT 1", [dbId]);
        let invoiceId = null;

        if (invRows.length > 0) {
          invoiceId = invRows[0].id;
          // Update amount only if not fully paid/closed? Or typically update and let user handle balance?
          // For now, we update amount. Status remains unless amount becomes 0?
          await conn.query(
            "UPDATE invoices SET amount = ?, updated_at = NOW() WHERE id = ?",
            [totalAmount, invoiceId]
          );
        } else if (totalAmount > 0) {
          // Create new invoice
          const [insInv] = await conn.query(
            `INSERT INTO invoices (patient_id, appointment_id, issue_date, amount, status, created_at)
                  VALUES (?, ?, CURDATE(), ?, 'Pending', NOW())`,
            [appt.patient_id, dbId, totalAmount]
          );
          invoiceId = insInv.insertId;
        }

        // 4. Update Invoice Items (Mirror procedures)
        if (invoiceId) {
          await conn.query("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
          const invItems = items.map(it => {
            let itemType = it.itemType || it.type || 'PROCEDURE';
            // Normalize to uppercase
            itemType = String(itemType).toUpperCase();
            if (!['PROCEDURE', 'MATERIAL', 'APPARATUS'].includes(itemType)) {
              itemType = 'PROCEDURE';
            }

            return [
              invoiceId,
              it.code || "MISC",
              it.qty || 1,
              it.unitPrice || 0,
              (it.qty || 1) * (it.unitPrice || 0),
              itemType
            ];
          });

          if (invItems.length) {
            await conn.query(
              `INSERT INTO invoice_items (invoice_id, code, qty, unit_price, amount, item_type) VALUES ?`,
              [invItems]
            );
          }
        }

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("PUT PROCEDURES ERROR:", err);
      return res.status(500).json({ message: "Failed to save procedures", error: true });
    }
  }
);

// PATIENTS (Updated with Financials)
app.get(
  `${ADMIN_BASE}/patients`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "ADMIN PATIENTS",
        `SELECT
           u.id,
           u.uid,
           u.full_name,
           u.phone,
           (SELECT MAX(scheduled_date) FROM appointments WHERE patient_id = u.id) AS last_visit,
           (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE patient_id = u.id) AS total_billed,
           (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE patient_id = u.id AND status = 'Paid') AS total_paid
         FROM users u
         WHERE u.role = 'Patient'
         ORDER BY u.full_name ASC`,
        []
      );

      const todayStr = formatDateYYYYMMDD(new Date());
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = formatDateYYYYMMDD(sixMonthsAgo);

      const items = rows.map((r) => {
        const lastVisitStr = r.last_visit ? toDateStr(r.last_visit) : null;
        const isActive = lastVisitStr && lastVisitStr >= sixMonthsAgoStr ? "Active" : "Inactive";

        const billed = Number(r.total_billed || 0);
        const paid = Number(r.total_paid || 0);
        const due = billed - paid;

        let payStatus = "Up to date";
        if (due > 0) payStatus = "Outstanding";
        if (billed === 0) payStatus = "No History";

        return {
          id: r.uid,
          name: r.full_name,
          phone: r.phone,
          lastVisit: lastVisitStr || null,
          status: isActive,
          totalBilled: billed,
          totalPaid: paid,
          balance: due,
          paymentStatus: payStatus
        };
      });

      res.json({ items, patients: items, asOf: todayStr });
    } catch (err) {
      console.error("ADMIN PATIENTS HANDLER ERROR:", err);
      res.json({ items: [], error: true });
    }
  }
);

// DOCTORS (UNCHANGED)
app.get(
  `${ADMIN_BASE}/doctors`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const rows = await safeQuery(
        "ADMIN DOCTORS",
        `SELECT
           u.id,
           u.uid,
           u.full_name,
           u.phone
         FROM users u
         WHERE u.role = 'Doctor'
         ORDER BY u.full_name ASC`,
        []
      );

      const items = rows.map((r) => ({
        id: r.uid,
        name: r.full_name,
        phone: r.phone || null,
      }));

      res.json({ items });
    } catch (err) {
      console.error("ADMIN DOCTORS HANDLER ERROR:", err);
      res.json({ items: [], error: true });
    }
  }
);

// REVENUE DASHBOARD (UNCHANGED)
app.get(
  `${ADMIN_BASE}/revenue-dashboard`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const monthIndex = today.getMonth();
      const monthStart = new Date(year, monthIndex, 1);
      const nextMonthStart = new Date(year, monthIndex + 1, 1);
      const monthStartStr = formatDateYYYYMMDD(monthStart);
      const nextMonthStartStr = formatDateYYYYMMDD(nextMonthStart);

      const rowsCurrent = await safeQuery(
        "ADMIN REVENUE CURRENT",
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END), 0) AS total_paid,
           COALESCE(SUM(CASE WHEN status IN ('Pending','Overdue') THEN amount ELSE 0 END), 0) AS total_pending
         FROM invoices
         WHERE issue_date >= ? AND issue_date < ?`,
        [monthStartStr, nextMonthStartStr]
      );
      const thisMonthTotal = Number(rowsCurrent[0]?.total_paid || 0);
      const pendingOverdue = Number(rowsCurrent[0]?.total_pending || 0);

      const prevMonthStart = new Date(year, monthIndex - 1, 1);
      const currentMonthStart = monthStart;
      const prevMonthStartStr = formatDateYYYYMMDD(prevMonthStart);
      const currentMonthStartStr = formatDateYYYYMMDD(currentMonthStart);

      const rowsPrev = await safeQuery(
        "ADMIN REVENUE PREV",
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END), 0) AS total_paid
         FROM invoices
         WHERE issue_date >= ? AND issue_date < ?`,
        [prevMonthStartStr, currentMonthStartStr]
      );
      const prevMonthTotal = Number(rowsPrev[0]?.total_paid || 0);

      let growthPercent = null;
      if (prevMonthTotal > 0) {
        growthPercent = ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
      }

      const daysElapsed = today.getDate();
      const avgPerDay = daysElapsed > 0 ? thisMonthTotal / daysElapsed : thisMonthTotal;

      const sixMonthsAgo = new Date(year, monthIndex - 5, 1);
      const sixMonthsAgoStr = formatDateYYYYMMDD(sixMonthsAgo);

      const rowsSeries = await safeQuery(
        "ADMIN REVENUE SERIES",
        `SELECT
           DATE_FORMAT(issue_date, '%Y-%m') AS ym,
           COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END), 0) AS total_paid
         FROM invoices
         WHERE issue_date >= ?
         GROUP BY ym
         ORDER BY ym ASC`,
        [sixMonthsAgoStr]
      );

      const last6Months = rowsSeries.map((r) => ({
        label: r.ym,
        value: Number(r.total_paid || 0),
      }));

      res.json({
        thisMonthTotal,
        pendingOverdue,
        avgPerDay,
        growthPercent,
        last6Months,
      });
    } catch (err) {
      console.error("ADMIN REVENUE DASHBOARD HANDLER ERROR:", err);
      res.json({
        thisMonthTotal: 0,
        pendingOverdue: 0,
        avgPerDay: 0,
        growthPercent: null,
        last6Months: [],
        error: true,
      });
    }
  }
);

// ✅ NEW: Revenue summary API for agent insights
app.get(
  `${ADMIN_BASE}/revenue/summary`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const range = String(req.query.range || "30d");
      const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;

      const endDate = formatDateYYYYMMDD(new Date());
      const startDate = addDaysYYYYMMDD(endDate, -(days - 1));

      const hasInvoices = await tableExists("invoices");
      if (!hasInvoices) {
        return res.json({
          range,
          startDate,
          endDate,
          totals: { totalBilled: 0, totalPaid: 0, totalPending: 0, invoiceCount: 0 },
          forecast: null,
          ar: { items: [] },
          topDoctors: [],
          topProcedures: [],
          reports: [],
        });
      }

      const invCols = await getTableColumns("invoices");
      const dateCol = invCols.has("issue_date") ? "issue_date" : invCols.has("created_at") ? "created_at" : null;
      const statusCol = invCols.has("status") ? "status" : null;

      const totalsRows = dateCol
        ? await safeQuery(
          "REVENUE SUMMARY totals",
          `
            SELECT
              COUNT(*) AS invoice_count,
              COALESCE(SUM(amount),0) AS total_billed,
              COALESCE(SUM(CASE WHEN ${statusCol ? `${statusCol} IN ('Paid','PAID','paid')` : "0"} THEN amount ELSE 0 END),0) AS total_paid,
              COALESCE(SUM(CASE WHEN ${statusCol ? `${statusCol} IN ('Pending','PENDING','Overdue','OVERDUE')` : "0"} THEN amount ELSE 0 END),0) AS total_pending
            FROM invoices
            WHERE ${dateCol} >= ? AND ${dateCol} <= ?
            `,
          [startDate, endDate]
        )
        : [];

      const totals = totalsRows[0] || {};

      // Categorized totals (breakdown)
      const typeTotalsRows = dateCol
        ? await safeQuery(
          "REVENUE SUMMARY Type Breakdown",
          `
            SELECT
              ii.item_type,
              COALESCE(SUM(ii.amount), 0) AS revenue
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            WHERE i.${dateCol} >= ? AND i.${dateCol} <= ?
            GROUP BY ii.item_type
            `,
          [startDate, endDate]
        )
        : [];

      const breakdown = {
        PROCEDURE: 0,
        MATERIAL: 0,
        APPARATUS: 0
      };
      typeTotalsRows.forEach(r => {
        if (r.item_type in breakdown) {
          breakdown[r.item_type] = Number(r.revenue || 0);
        }
      });

      const arRows = dateCol
        ? await safeQuery(
          "REVENUE SUMMARY AR",
          `
            SELECT i.id, i.patient_id, i.amount, i.status, i.${dateCol} AS issue_date,
                   u.full_name AS patient_name
            FROM invoices i
            LEFT JOIN users u ON u.id = i.patient_id
            WHERE i.${dateCol} <= ?
              AND ${statusCol ? "i.status IN ('Pending','PENDING','Overdue','OVERDUE')" : "1=0"}
            ORDER BY i.amount DESC
            LIMIT 20
            `,
          [endDate]
        )
        : [];

      const hasAppointments = await tableExists("appointments");
      const apptCols = hasAppointments ? await getTableColumns("appointments") : new Set();
      const hasInvoiceAppt = invCols.has("appointment_id");

      const topDoctors =
        hasAppointments && hasInvoiceAppt && apptCols.has("doctor_id") && apptCols.has("scheduled_date")
          ? await safeQuery(
            "REVENUE SUMMARY top doctors",
            `
              SELECT a.doctor_id, u.full_name AS doctor_name,
                     COUNT(*) AS appointment_count,
                     COALESCE(SUM(i.amount),0) AS revenue
              FROM appointments a
              LEFT JOIN invoices i ON i.appointment_id = a.id
              LEFT JOIN users u ON u.id = a.doctor_id
              WHERE a.scheduled_date >= ? AND a.scheduled_date <= ?
              GROUP BY a.doctor_id
              ORDER BY revenue DESC
              LIMIT 10
              `,
            [startDate, endDate]
          )
          : [];

      const hasInvoiceItems = await tableExists("invoice_items");
      const iiCols = hasInvoiceItems ? await getTableColumns("invoice_items") : new Set();
      const procKey = iiCols.has("code") ? "code" : iiCols.has("description") ? "description" : null;

      const topProcedures =
        hasInvoiceItems && procKey && dateCol
          ? await safeQuery(
            "REVENUE SUMMARY top procedures",
            `
              SELECT ii.${procKey} AS procedure_code,
                     COALESCE(SUM(ii.amount),0) AS revenue,
                     COALESCE(SUM(ii.qty),0) AS qty
              FROM invoice_items ii
              JOIN invoices i ON i.id = ii.invoice_id
              WHERE i.${dateCol} >= ? AND i.${dateCol} <= ?
              GROUP BY ii.${procKey}
              ORDER BY revenue DESC
              LIMIT 10
              `,
            [startDate, endDate]
          )
          : [];

      // Inventory Metrics
      const hasInventory = await tableExists("inventory_items");
      let inventoryMetrics = { totalValue: 0, lowStockCount: 0 };
      if (hasInventory) {
        const invRows = await safeQuery(
          "REVENUE SUMMARY inventory",
          `
            SELECT 
              COALESCE(SUM(stock * unit_cost), 0) AS total_value,
              COUNT(CASE WHEN stock <= reorder_threshold THEN 1 END) AS low_stock_count
            FROM inventory_items
          `,
          []
        );
        inventoryMetrics = {
          totalValue: Number(invRows[0]?.total_value || 0),
          lowStockCount: Number(invRows[0]?.low_stock_count || 0)
        };
      }

      let forecast = null;
      let reports = [];
      const hasInsights = await tableExists("revenue_insights");
      if (hasInsights) {
        const riCols = await getTableColumns("revenue_insights");
        if (riCols.has("insight_type")) {
          const frows = await safeQuery(
            "REVENUE SUMMARY forecast",
            `
            SELECT raw_json
            FROM revenue_insights
            WHERE insight_type = 'FORECAST'
            ORDER BY id DESC
            LIMIT 1
            `,
            []
          );
          if (frows?.[0]?.raw_json) {
            try {
              const parsed = JSON.parse(String(frows[0].raw_json));
              forecast = parsed?.forecast || null;
            } catch { }
          }

          reports = await safeQuery(
            "REVENUE SUMMARY reports",
            `
            SELECT raw_json
            FROM revenue_insights
            WHERE insight_type = 'REPORT'
            ORDER BY id DESC
            LIMIT 3
            `,
            []
          );
          reports = (reports || []).map((r) => {
            try {
              return JSON.parse(String(r.raw_json));
            } catch {
              return null;
            }
          }).filter(Boolean);
        } else {
          const frows = await safeQuery(
            "REVENUE SUMMARY forecast legacy",
            `
            SELECT raw_json
            FROM revenue_insights
            ORDER BY id DESC
            LIMIT 1
            `,
            []
          );
          if (frows?.[0]?.raw_json) {
            try {
              const parsed = JSON.parse(String(frows[0].raw_json));
              forecast = parsed?.forecast || null;
            } catch { }
          }
        }
      }

      return res.json({
        range,
        startDate,
        endDate,
        totals: {
          totalBilled: Number(totals.total_billed || 0),
          totalPaid: Number(totals.total_paid || 0),
          totalPending: Number(totals.total_pending || 0),
          invoiceCount: Number(totals.invoice_count || 0),
          breakdown // Add categorization here
        },
        forecast,
        ar: { items: arRows || [] },
        topDoctors: topDoctors || [],
        topProcedures: topProcedures || [],
        inventory: inventoryMetrics,
        aiSummary: forecast?.ai_summary || null,
        reports,
      });
    } catch (err) {
      console.error("GET /api/admin/revenue/summary error:", err);
      return res.json({
        range: String(req.query.range || "30d"),
        startDate: null,
        endDate: null,
        totals: { totalBilled: 0, totalPaid: 0, totalPending: 0, invoiceCount: 0 },
        forecast: null,
        ar: { items: [] },
        topDoctors: [],
        topProcedures: [],
        reports: [],
        error: true,
      });
    }
  }
);

app.get(
  `${ADMIN_BASE}/revenue/analytics`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const days = Math.max(7, Math.min(365, Number(req.query.days || 30)));
      const endDate = formatDateYYYYMMDD(new Date());
      const startDate = addDaysYYYYMMDD(endDate, -(days - 1));

      const [doctorRows] = await pool.query(
        `
        SELECT a.doctor_id,
               u.full_name AS doctor_name,
               COUNT(DISTINCT a.id) AS appointments,
               COALESCE(SUM(i.amount),0) AS revenue
        FROM appointments a
        LEFT JOIN invoices i ON i.appointment_id = a.id
        LEFT JOIN users u ON u.id = a.doctor_id
        WHERE a.scheduled_date >= ? AND a.scheduled_date <= ?
        GROUP BY a.doctor_id, u.full_name
        ORDER BY revenue DESC
        LIMIT 20
        `,
        [startDate, endDate]
      );

      const [procedureRows] = await pool.query(
        `
        SELECT ii.code AS procedure_code,
               COUNT(*) AS line_count,
               COALESCE(SUM(ii.amount),0) AS revenue
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
        GROUP BY ii.code
        ORDER BY revenue DESC
        LIMIT 20
        `,
        [startDate, endDate]
      );

      const [chairRows] = await pool.query(
        `
        SELECT DATE_FORMAT(scheduled_date, '%Y-%m-%d') AS day,
               COUNT(*) AS booked_slots,
               COALESCE(SUM(predicted_duration_min),0) AS booked_minutes
        FROM appointments
        WHERE scheduled_date >= ? AND scheduled_date <= ?
        GROUP BY day
        ORDER BY day ASC
        `,
        [startDate, endDate]
      );

      return res.json({
        range: { startDate, endDate, days },
        byDoctor: doctorRows || [],
        byProcedure: procedureRows || [],
        chairUtilization: chairRows || [],
      });
    } catch (err) {
      console.error("ADMIN REVENUE ANALYTICS ERROR:", err);
      return res.status(500).json({ byDoctor: [], byProcedure: [], chairUtilization: [] });
    }
  }
);

app.get(
  `${ADMIN_BASE}/revenue/forecast`,
  authMiddleware,
  requireRole("Admin"),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT DATE_FORMAT(issue_date, '%Y-%m') AS ym,
               COALESCE(SUM(amount),0) AS billed,
               COALESCE(SUM(CASE WHEN status='Paid' THEN amount ELSE 0 END),0) AS paid
        FROM invoices
        WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY ym
        ORDER BY ym ASC
        `
      );
      const series = rows || [];
      const last3 = series.slice(-3);
      const avgPaid =
        last3.length > 0
          ? last3.reduce((sum, r) => sum + Number(r.paid || 0), 0) / last3.length
          : 0;
      const trend =
        last3.length >= 2 ? Number(last3[last3.length - 1].paid || 0) - Number(last3[last3.length - 2].paid || 0) : 0;
      const nextMonthForecast = Math.max(0, avgPaid + trend * 0.45);
      const confidence = Math.max(45, Math.min(92, Math.round(62 + Math.min(20, series.length * 3))));

      return res.json({
        horizon: "next_30_days",
        confidence,
        forecast: {
          expectedRevenue: Number(nextMonthForecast.toFixed(2)),
          trendDelta: Number(trend.toFixed(2)),
          historicalAverage: Number(avgPaid.toFixed(2)),
        },
        series,
      });
    } catch (err) {
      console.error("ADMIN REVENUE FORECAST ERROR:", err);
      return res.status(500).json({ message: "Failed to compute forecast" });
    }
  }
);

// CASE TRACKING SUMMARY (UNCHANGED)
app.get(
  `${ADMIN_BASE}/cases/tracking-summary`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    const todayStr = formatDateYYYYMMDD(new Date());

    try {
      const rowsTotal = await safeQuery("CASE TRACKING TOTAL", `SELECT COUNT(*) AS cnt FROM cases`, []);
      const totalCases = rowsTotal[0]?.cnt ?? 0;

      const rowsRisk = await safeQuery(
        "CASE TRACKING RISK",
        `SELECT
           SUM(CASE WHEN risk_score >= 80 THEN 1 ELSE 0 END) AS highRiskCount,
           SUM(
             CASE
               WHEN next_review_date IS NOT NULL
                AND next_review_date <= CURDATE()
                AND stage <> 'CLOSED'
               THEN 1 ELSE 0
             END
           ) AS needsFollowUpCount
         FROM cases`,
        []
      );
      const highRiskCount = rowsRisk[0]?.highRiskCount ?? 0;
      const needsFollowUpCount = rowsRisk[0]?.needsFollowUpCount ?? 0;

      const rowsStage = await safeQuery(
        "CASE TRACKING STAGES",
        `SELECT stage, COUNT(*) AS cnt
         FROM cases
         GROUP BY stage`,
        []
      );
      const byStage = {};
      for (const r of rowsStage) {
        if (!r.stage) continue;
        const key = String(r.stage).toUpperCase();
        byStage[key] = r.cnt;
      }

      res.json({
        totalCases,
        highRiskCount,
        needsFollowUpCount,
        byStage,
        updatedAt: todayStr,
      });
    } catch (err) {
      console.error("CASE TRACKING SUMMARY HANDLER ERROR:", err);
      res.json({
        totalCases: 0,
        highRiskCount: 0,
        needsFollowUpCount: 0,
        byStage: {},
        updatedAt: todayStr,
        error: true,
      });
    }
  }
);

// CASE TRACKING LIST (UNCHANGED)
app.get(
  `${ADMIN_BASE}/cases/tracking-list`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    const limit =
      typeof req.query.limit === "string" && req.query.limit.trim()
        ? parseInt(req.query.limit, 10) || 50
        : 50;

    try {
      const rows = await safeQuery(
        "CASE TRACKING LIST",
        `SELECT
           c.id,
           c.case_uid AS caseId,
           c.case_type AS type,
           c.stage,
           c.priority,
           c.risk_score,
           c.next_action,
           c.next_review_date,
           c.updated_at,
           c.agent_summary,
           c.agent_recommendation,
           p.full_name AS patient_name,
           p.uid AS patient_uid,
           d.full_name AS doctor_name,
           d.uid AS doctor_uid
         FROM cases c
         LEFT JOIN users p ON p.id = c.patient_id
         LEFT JOIN users d ON d.id = c.doctor_id
         ORDER BY c.updated_at DESC
         LIMIT ?`,
        [limit]
      );

      const cases = rows.map((r) => ({
        id: r.id,
        caseId: r.caseId || `CASE-${r.id}`,
        type: r.type || "General case",
        stage: (r.stage && String(r.stage).toUpperCase()) || "NEW",
        priority: (r.priority && String(r.priority).toUpperCase()) || "MEDIUM",
        riskScore: Number(r.risk_score ?? 0),
        nextAction: r.next_action || null,
        nextReviewDate: r.next_review_date || null,
        lastUpdated: r.updated_at || new Date().toISOString(),
        agentSummary: r.agent_summary || null,
        agentRecommendation: r.agent_recommendation || null,
        patientName: r.patient_name || "Unknown patient",
        patientUid: r.patient_uid || null,
        doctorName: r.doctor_name || "Unassigned",
        doctorUid: r.doctor_uid || null,
        flagged: Number(r.risk_score ?? 0) >= 80,
      }));

      res.json({ cases, items: cases });
    } catch (err) {
      console.error("CASE TRACKING LIST HANDLER ERROR:", err);
      res.json({ cases: [], error: true });
    }
  }
);

// UPDATE CASE STAGE (kept) ✅ + NEW emit CaseUpdated event for Python case agent
app.patch(
  `${ADMIN_BASE}/cases/:id`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    const caseId = Number(req.params.id);
    const { stage, priority } = req.body || {};

    if (!stage && !priority) {
      return res.status(400).json({ message: "Stage or priority required" });
    }

    try {
      const sets = [];
      const vals = [];
      if (stage) {
        sets.push("stage = ?");
        vals.push(stage);
      }
      if (priority) {
        sets.push("priority = ?");
        vals.push(priority);
      }
      sets.push("updated_at = NOW()");
      vals.push(caseId);

      await pool.query(`UPDATE cases SET ${sets.join(", ")} WHERE id = ?`, vals);

      await enqueueEventCompat({
        eventType: "CaseUpdated",
        payload: { caseDbId: caseId, stage: stage || null, priority: priority || null },
        createdByUserId: req.user?.id || null,
      });
      await enqueueEventCompat({
        eventType: "CaseGenerateSummary",
        payload: { caseDbId: caseId, caseId, source: "admin_stage_change" },
        createdByUserId: req.user?.id || null,
      });

      // Notify all role views about admin stage/priority update
      try {
        const [ctxRows] = await pool.query(
          `SELECT case_uid, patient_id, doctor_id FROM cases WHERE id = ? LIMIT 1`,
          [caseId]
        );
        const ctx = ctxRows?.[0] || {};
        const stageTxt = stage ? ` stage -> ${String(stage)}` : "";
        const priorityTxt = priority ? ` priority -> ${String(priority)}` : "";
        const summary = `${ctx.case_uid || `CASE-${caseId}`}${stageTxt}${priorityTxt}`;

        await insertNotificationInline({
          userRole: "Admin",
          title: "Case Updated",
          message: `Admin updated ${summary}.`,
          notifType: "CASE_UPDATED",
          relatedType: "cases",
          relatedId: caseId,
          meta: { caseId, caseUid: ctx.case_uid || null, stage: stage || null, priority: priority || null },
          priority: 145,
        });
        if (ctx.doctor_id) {
          await insertNotificationInline({
            userId: ctx.doctor_id,
            title: "Case Update",
            message: `${summary}.`,
            notifType: "CASE_UPDATED",
            relatedType: "cases",
            relatedId: caseId,
            meta: { caseId, caseUid: ctx.case_uid || null, stage: stage || null, priority: priority || null },
            priority: 140,
          });
        }
        if (ctx.patient_id) {
          await insertNotificationInline({
            userId: ctx.patient_id,
            title: "Treatment Case Update",
            message: `Your case ${ctx.case_uid || `CASE-${caseId}`} was updated.`,
            notifType: "CASE_UPDATED",
            relatedType: "cases",
            relatedId: caseId,
            meta: { caseId, caseUid: ctx.case_uid || null, stage: stage || null, priority: priority || null },
            priority: 135,
          });
        }
      } catch (notifyErr) {
        console.error("CASE UPDATE notification error:", notifyErr);
      }

      const [rows] = await pool.query("SELECT updated_at FROM cases WHERE id = ?", [caseId]);
      const row = rows[0];

      res.json({
        case: {
          id: caseId,
          stage,
          priority,
          lastUpdated: row?.updated_at || new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("CASE UPDATE HANDLER ERROR:", err);
      res.json({
        case: {
          id: caseId,
          stage,
          lastUpdated: new Date().toISOString(),
        },
        error: true,
        message: "Failed to update case stage in database",
      });
    }
  }
);

// Example secured endpoint (UNCHANGED)
app.get(`${ADMIN_BASE}/secure-kpis`, authMiddleware, requireRole("Admin"), (req, res) => {
  res.json({
    message: "Some secure admin-only data",
    user: req.user,
  });
});

// ===================================
// DOCTOR ROUTES
// ===================================


// Helper to convert DB stage → label
function mapStageDbToLabel(stageDb) {
  const s = String(stageDb || "").toUpperCase();
  if (s === "IN_TREATMENT") return "In treatment";
  if (s === "WAITING_ON_PATIENT") return "Waiting on patient";
  if (s === "CLOSED" || s === "COMPLETED") return "Completed";
  return "New";
}

// DOCTOR: dashboard summary (UNCHANGED)
app.get(
  `${DOCTOR_BASE}/dashboard-summary`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    const doctorId = req.user.id;
    const todayStr = formatDateYYYYMMDD(new Date());

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = formatDateYYYYMMDD(thirtyDaysAgo);

    try {
      const rowsToday = await safeQuery(
        "DOCTOR DASHBOARD TODAY APPOINTMENTS",
        `SELECT COUNT(*) AS cnt
         FROM appointments
         WHERE doctor_id = ?
           AND scheduled_date = ?
           AND (status IS NULL OR status <> 'Cancelled')`,
        [doctorId, todayStr]
      );
      const todayAppointments = rowsToday[0]?.cnt ?? 0;

      const rowsOpenCases = await safeQuery(
        "DOCTOR DASHBOARD OPEN CASES",
        `SELECT COUNT(*) AS cnt
         FROM cases
         WHERE doctor_id = ?
           AND (stage IS NULL OR stage <> 'CLOSED')`,
        [doctorId]
      );
      const openCases = rowsOpenCases[0]?.cnt ?? 0;

      const rowsNewPatients = await safeQuery(
        "DOCTOR DASHBOARD NEW PATIENTS 30D",
        `SELECT COUNT(DISTINCT a.patient_id) AS cnt
         FROM appointments a
         JOIN users u ON u.id = a.patient_id
         WHERE a.doctor_id = ?
           AND a.scheduled_date >= ?
           AND u.role = 'Patient'`,
        [doctorId, thirtyDaysAgoStr]
      );
      const newPatients30d = rowsNewPatients[0]?.cnt ?? 0;

      const rowsCompletion = await safeQuery(
        "DOCTOR DASHBOARD COMPLETION 30D",
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
         FROM appointments
         WHERE doctor_id = ?
           AND scheduled_date >= ?`,
        [doctorId, thirtyDaysAgoStr]
      );
      const total = rowsCompletion[0]?.total ?? 0;
      const completed = rowsCompletion[0]?.completed ?? 0;
      const completionRate = total > 0 ? Math.round((completed * 100) / total) : 0;

      res.json({
        todayAppointments,
        openCases,
        newPatients30d,
        completionRate,
        asOf: todayStr,
      });
    } catch (err) {
      console.error("DOCTOR DASHBOARD SUMMARY ERROR:", err);
      res.json({
        todayAppointments: 0,
        openCases: 0,
        newPatients30d: 0,
        completionRate: 0,
        asOf: todayStr,
        error: true,
      });
    }
  }
);

// DOCTOR: today’s appointments ✅ UPDATED (dbId + status mapping aligned)
app.get(
  `${DOCTOR_BASE}/appointments`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    const doctorId = req.user.id;
    const todayStr = formatDateYYYYMMDD(new Date());

    try {
      const rows = await safeQuery(
        "DOCTOR APPOINTMENTS",
        `SELECT
           a.id,
           a.appointment_uid,
           DATE_FORMAT(a.scheduled_date, '%Y-%m-%d') AS scheduled_date,
           TIME_FORMAT(a.scheduled_time, '%H:%i') AS time_display,
           a.type,
           a.status,
           p.full_name AS patient_name
         FROM appointments a
         LEFT JOIN users p ON p.id = a.patient_id
         WHERE a.doctor_id = ?
           AND a.scheduled_date = ?
         ORDER BY a.scheduled_time ASC`,
        [doctorId, todayStr]
      );

      const items = rows.map((r) => {
        const statusRaw = String(r.status || "").toUpperCase();

        let statusLabel = "Pending";
        if (statusRaw === "CONFIRMED") statusLabel = "Confirmed";
        else if (statusRaw === "CHECKED IN") statusLabel = "Checked in";
        else if (statusRaw === "IN PROGRESS") statusLabel = "In progress";
        else if (statusRaw === "COMPLETED") statusLabel = "Completed";
        else if (statusRaw === "CANCELLED") statusLabel = "Cancelled";

        return {
          dbId: Number(r.id),
          id: r.appointment_uid || String(r.id),
          date: r.scheduled_date || null,
          time: r.time_display || null,
          patient: r.patient_name || "—",
          reason: r.type || "General visit",
          room: "—",
          status: statusLabel,
        };
      });

      res.json({ items, date: todayStr });
    } catch (err) {
      console.error("DOCTOR APPOINTMENTS ERROR:", err);
      res.status(500).json({
        message: "Failed to load appointments",
        items: [],
        date: todayStr,
      });
    }
  }
);

app.get(
  `${DOCTOR_BASE}/insights-summary`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const doctorId = Number(req.user?.id || 0);
      if (!Number.isFinite(doctorId) || doctorId <= 0) {
        return res.status(400).json({ message: "Invalid doctor context" });
      }

      const [apptRows] = await pool.query(
        `
        SELECT status, scheduled_date
        FROM appointments
        WHERE doctor_id = ?
          AND scheduled_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
        `,
        [doctorId]
      );

      let totalAppts = 0;
      let completedAppts = 0;
      let cancelledAppts = 0;
      let noShowAppts = 0;
      for (const row of apptRows || []) {
        totalAppts += 1;
        const status = String(row.status || "").trim().toLowerCase();
        if (status === "completed") completedAppts += 1;
        if (status === "cancelled") cancelledAppts += 1;
        if (status === "no-show" || status === "no show") noShowAppts += 1;
      }

      const chairUtilization = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0;
      const cancellationRate =
        totalAppts > 0 ? Math.round(((cancelledAppts + noShowAppts) / totalAppts) * 100) : 0;

      const [caseRows] = await pool.query(
        `
        SELECT id, stage, next_review_date
        FROM cases
        WHERE doctor_id = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        `,
        [doctorId]
      );

      const totalCases = (caseRows || []).length;
      const inTreatment = (caseRows || []).filter((c) => String(c.stage || "") === "IN_TREATMENT").length;
      const waitingCases = (caseRows || []).filter((c) => String(c.stage || "") === "WAITING_ON_PATIENT").length;
      const followUpsSet = new Set(
        (caseRows || [])
          .filter((c) => c.next_review_date)
          .map((c) => Number(c.id))
          .filter((id) => Number.isFinite(id) && id > 0)
      );
      const followUpRate = totalCases > 0 ? Math.round((followUpsSet.size / totalCases) * 100) : 0;

      const [timelineRows] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM case_timeline ct
        JOIN cases c ON c.id = ct.case_id
        WHERE c.doctor_id = ?
          AND ct.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        `,
        [doctorId]
      );
      const caseVelocity = Number(timelineRows?.[0]?.total || 0);

      const hasData = totalAppts > 0 || totalCases > 0 || caseVelocity > 0;
      const positiveSignals = [];
      const watchList = [];

      if (!hasData) {
        positiveSignals.push("No activity yet for this doctor. Create appointments/cases to unlock insights.");
      } else {
        if (chairUtilization >= 70) positiveSignals.push("Chair utilization is healthy this month.");
        if (followUpRate >= 60) positiveSignals.push("Follow-up planning is on track for active cases.");
        if (inTreatment > 0) positiveSignals.push(`${inTreatment} active treatment case(s) are progressing.`);

        if (cancellationRate >= 20) watchList.push("Cancellation/no-show rate is high. Consider reminder workflow tuning.");
        if (waitingCases > 0) watchList.push(`${waitingCases} case(s) are waiting on patient follow-up.`);
        if (followUpRate < 40 && totalCases > 0) watchList.push("Review next follow-up dates for active cases.");
      }

      return res.json({
        hasData,
        metrics: {
          chairUtilization,
          followUpRate,
          cancellationRate,
          caseVelocity,
        },
        raw: {
          totalAppointments: totalAppts,
          completedAppointments: completedAppts,
          cancelledAppointments: cancelledAppts,
          noShowAppointments: noShowAppts,
          totalCases,
          inTreatmentCases: inTreatment,
          waitingCases,
        },
        positiveSignals,
        watchList,
      });
    } catch (err) {
      console.error("DOCTOR INSIGHTS SUMMARY ERROR:", err);
      return res.status(500).json({ message: "Failed to load insights" });
    }
  }
);

// ✅ NEW: DOCTOR mark appointment completed

app.get(
  `${DOCTOR_BASE}/appointments/:dbId`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const doctorId = req.user.id;
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }

      const [rows] = await pool.query(
        `
        SELECT
          a.id, a.appointment_uid, a.patient_id, a.doctor_id, a.linked_case_id,
          DATE_FORMAT(a.scheduled_date, '%Y-%m-%d') AS scheduled_date,
          TIME_FORMAT(a.scheduled_time, '%H:%i:%s') AS scheduled_time,
          a.type, a.status, NULL AS notes,
          p.full_name AS patient_name, d.full_name AS doctor_name, c.case_uid
        FROM appointments a
        LEFT JOIN users p ON p.id = a.patient_id
        LEFT JOIN users d ON d.id = a.doctor_id
        LEFT JOIN cases c ON c.id = a.linked_case_id
        WHERE a.id = ? AND a.doctor_id = ?
        LIMIT 1
        `,
        [dbId, doctorId]
      );
      if (!rows.length) return res.status(404).json({ message: "Appointment not found" });

      const [usageRows] = await pool.query(
        `
        SELECT
          l.id,
          l.appointment_id,
          l.visit_id,
          l.item_code,
          COALESCE(i.name, l.item_code) AS item_name,
          l.qty_used,
          l.created_at
        FROM inventory_usage_logs l
        LEFT JOIN inventory_items i ON i.id = l.item_id
        WHERE l.appointment_id = ?
        ORDER BY l.id DESC
        LIMIT 20
        `,
        [dbId]
      );
      const [invoiceRows] = await pool.query(
        `
        SELECT id, amount, status, issue_date, paid_date
        FROM invoices
        WHERE appointment_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [dbId]
      );

      return res.json({
        item: {
          ...rows[0],
          consumables: usageRows || [],
          invoice: invoiceRows?.[0] || null,
        },
      });
    } catch (err) {
      console.error("DOCTOR APPOINTMENT DETAILS ERROR:", err);
      return res.status(500).json({ message: "Failed to load appointment details" });
    }
  }
);


app.patch(
  `${DOCTOR_BASE}/appointments/:dbId`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const doctorId = req.user.id;
      const status = String(req.body?.status || "").trim();
      if (!Number.isFinite(dbId) || dbId <= 0) return res.status(400).json({ message: "Invalid appointment id" });
      if (!status) return res.status(400).json({ message: "Status is required" });
      const [existingRows] = await pool.query(
        `SELECT status FROM appointments WHERE id = ? AND doctor_id = ? LIMIT 1`,
        [dbId, doctorId]
      );
      if (!existingRows.length) return res.status(404).json({ message: "Appointment not found" });
      const currentStatus = String(existingRows[0].status || "").trim().toLowerCase();
      const nextStatus = status.toLowerCase();
      const isTerminalCurrent =
        currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "no-show";
      if (isTerminalCurrent && currentStatus !== nextStatus) {
        return res.status(409).json({
          message: "Appointment is in terminal state and cannot be changed",
          status: existingRows[0].status,
        });
      }
      if (nextStatus === "completed") {
        return res.status(403).json({ message: "Use doctor complete endpoint for completion workflow" });
      }
      if (nextStatus === "cancelled" || nextStatus === "no-show" || nextStatus === "no show") {
        return res.status(403).json({ message: "Only admin can cancel or override no-show statuses" });
      }
      await pool.query(`UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ? AND doctor_id = ?`, [status, dbId, doctorId]);
      return res.json({ ok: true, id: dbId, status });
    } catch (err) {
      console.error("DOCTOR APPOINTMENT STATUS UPDATE ERROR:", err);
      return res.status(500).json({ message: "Failed to update appointment status" });
    }
  }
);

app.patch(
  `${DOCTOR_BASE}/appointments/:dbId/complete`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const doctorId = req.user.id;

      const [rows] = await pool.query(
        `SELECT id, patient_id, doctor_id, type, linked_case_id
         FROM appointments
         WHERE id = ? AND doctor_id = ?
         LIMIT 1`,
        [dbId, doctorId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      const currentStatus = String(rows[0].status || "").trim().toLowerCase();
      if (currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "no-show" || currentStatus === "no show") {
        return res.status(409).json({ message: "Appointment is already in terminal state", status: rows[0].status });
      }

      await pool.query(
        `UPDATE appointments
         SET status = 'Completed',
             actual_end_at = COALESCE(actual_end_at, NOW())
         WHERE id = ?`,
        [dbId]
      );

      await enqueueEventCompat({
        eventType: "AppointmentCompleted",
        payload: {
          appointmentId: dbId,
          patientId: rows[0].patient_id,
          doctorId: rows[0].doctor_id,
          type: rows[0].type || "General",
          linkedCaseId: rows[0].linked_case_id || null,
        },
        createdByUserId: req.user?.id || null,
      });

      // ✅ Inline fallback to keep inventory in sync if agents aren't running
      try {
        await applyInventoryConsumptionFromVisit({
          appointmentId: dbId,
          doctorId: rows[0].doctor_id,
          userId: req.user?.id || null,
        });
      } catch (e) {
        console.error("Inline inventory consumption failed:", e?.message || e);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("DOCTOR COMPLETE APPOINTMENT ERROR:", err);
      return res.status(500).json({ ok: false, message: "Server error" });
    }
  }
);

// DOCTOR: patients (UNCHANGED)
app.get(
  `${DOCTOR_BASE}/patients`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    const doctorId = req.user.id;

    try {
      const rows = await safeQuery(
        "DOCTOR PATIENTS",
        `SELECT
           u.id,
           u.uid,
           u.full_name,
           MAX(a.scheduled_date) AS last_visit,
           COUNT(DISTINCT c.id) AS active_cases
         FROM users u
         JOIN appointments a ON a.patient_id = u.id
         LEFT JOIN cases c 
           ON c.patient_id = u.id
          AND c.doctor_id = ?
          AND c.stage <> 'CLOSED'
         WHERE u.role = 'Patient'
           AND a.doctor_id = ?
         GROUP BY u.id, u.uid, u.full_name
         ORDER BY u.full_name ASC`,
        [doctorId, doctorId]
      );

      const items = rows.map((r) => ({
        id: r.uid,
        name: r.full_name,
        lastVisit: r.last_visit ? toDateStr(r.last_visit) : null,
        activeCases: Number(r.active_cases || 0),
      }));

      res.json({ items });
    } catch (err) {
      console.error("DOCTOR PATIENTS ERROR:", err);
      res.status(500).json({
        message: "Failed to load patients",
        items: [],
      });
    }
  }
);

// DOCTOR: cases (UNCHANGED)
app.get(
  `${DOCTOR_BASE}/cases`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    const doctorId = req.user.id;

    try {
      const rows = await safeQuery(
        "DOCTOR CASES",
        `SELECT
           c.id AS dbId,
           c.case_uid AS caseId,
           c.stage,
           c.case_type AS diagnosis,
           c.next_action AS toothRegion,
           c.agent_summary AS agentSummary,
           c.agent_recommendation AS agentRecommendation,
           c.created_at AS createdAt,
           c.updated_at AS updatedAt,
           p.full_name AS patientName
         FROM cases c
         LEFT JOIN users p ON p.id = c.patient_id
         WHERE c.doctor_id = ?
         ORDER BY c.updated_at DESC`,
        [doctorId]
      );

      const cases = rows.map((r) => ({
        dbId: Number(r.dbId || r.id || 0),
        caseId: r.caseId || r.case_uid || `CASE-${r.dbId || r.id}`,
        id: r.caseId || r.case_uid || `CASE-${r.dbId || r.id}`,
        patientName: r.patientName || r.patient_name || "Unknown patient",
        toothRegion: r.toothRegion || "Not specified",
        diagnosis: r.diagnosis || "General case",
        stage: mapStageDbToLabel(r.stage),
        agentSummary: r.agentSummary || null,
        agentRecommendation: r.agentRecommendation || null,
        createdAt: r.createdAt || r.created_at || null,
        updatedAt: r.updatedAt || r.updated_at || null,
      }));

      res.json({ cases, items: cases });
    } catch (err) {
      console.error("DOCTOR CASES ERROR:", err);
      res.status(500).json({
        message: "Failed to load cases",
        cases: [],
      });
    }
  }
);

// DOCTOR: case details (numeric db id)
app.get(
  `${DOCTOR_BASE}/cases/:dbId`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }

      const doctorId = req.user.id;
      const cols = await getTableColumns("cases");
      const notesCol = pickCol(cols, ["notes", "doctor_notes", "case_notes"]);
      const toothCol = pickCol(cols, ["tooth_region", "tooth", "region"]);
      const nextReviewCol = pickCol(cols, ["next_review_date", "next_review"]);
      const insightsCol = pickCol(cols, ["agent_insights_json", "agent_insights"]);

      const rows = await safeQuery(
        "DOCTOR CASE DETAIL",
        `
        SELECT
          c.id AS dbId,
          c.case_uid AS caseId,
          c.case_type,
          c.stage,
          c.created_at,
          c.updated_at,
          ${notesCol ? `c.${notesCol} AS notes,` : "NULL AS notes,"}
          ${toothCol ? `c.${toothCol} AS tooth_region,` : "NULL AS tooth_region,"}
          ${nextReviewCol ? `c.${nextReviewCol} AS next_review_date,` : "NULL AS next_review_date,"}
          ${insightsCol ? `c.${insightsCol} AS agent_insights_json,` : "NULL AS agent_insights_json,"}
          p.full_name AS patient_name
        FROM cases c
        LEFT JOIN users p ON p.id = c.patient_id
        WHERE c.id = ? AND c.doctor_id = ?
        LIMIT 1
        `,
        [dbId, doctorId]
      );

      if (!rows.length) return res.status(404).json({ message: "Case not found" });
      const r = rows[0];

      const summaries = await safeQuery(
        "DOCTOR CASE SUMMARIES",
        `
        SELECT id, summary, recommendation, confidence, status, created_at
        FROM case_summaries
        WHERE case_id = ?
        ORDER BY created_at DESC
        LIMIT 10
        `,
        [dbId]
      );

      let aiSummaries = (summaries || []).map((s) => ({
        id: s.id,
        summary: s.summary,
        recommendation: s.recommendation,
        confidence: s.confidence,
        status: s.status,
        createdAt: s.created_at,
      }));

      if (!aiSummaries.length && r.agent_summary) {
        aiSummaries = [
          {
            id: r.dbId || r.id || null,
            summary: r.agent_summary,
            recommendation: r.agent_recommendation || null,
            confidence: null,
            status: "READY",
            createdAt: r.updated_at || r.created_at || null,
          },
        ];
      }

      return res.json({
        case: {
          dbId: Number(r.dbId || r.id || 0),
          caseId: r.caseId || r.case_uid || `CASE-${r.dbId || r.id}`,
          id: r.caseId || r.case_uid || `CASE-${r.dbId || r.id}`,
          patientName: r.patient_name || "Unknown patient",
          toothRegion: r.tooth_region || "Not specified",
          diagnosis: r.case_type || "General case",
          stage: mapStageDbToLabel(r.stage),
          notes: r.notes || "",
          nextReviewDate: r.next_review_date || null,
          createdAt: r.created_at || null,
          updatedAt: r.updated_at || null,
          aiSummaries,
          agentInsights: r.agent_insights_json ? safeJsonParse(r.agent_insights_json, {}) : null,
        },
      });
    } catch (err) {
      console.error("DOCTOR CASE DETAIL ERROR:", err);
      return res.status(500).json({ message: "Failed to load case" });
    }
  }
);

// DOCTOR: update case details
app.patch(
  `${DOCTOR_BASE}/cases/:dbId`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }

      const doctorId = req.user.id;
      const cols = await getTableColumns("cases");
      const notesCol = pickCol(cols, ["notes", "doctor_notes", "case_notes"]);
      const toothCol = pickCol(cols, ["tooth_region", "tooth", "region"]);
      const nextReviewCol = pickCol(cols, ["next_review_date", "next_review"]);

      const { diagnosis, notes, stage, next_review_date, nextReviewDate, toothRegion } = req.body || {};

      const sets = [];
      const vals = [];

      if (diagnosis != null) {
        sets.push("case_type = ?");
        vals.push(String(diagnosis).trim());
      }
      if (stage != null) {
        sets.push("stage = ?");
        vals.push(String(stage).trim());
      }
      if (notesCol && notes !== undefined) {
        sets.push(`${notesCol} = ?`);
        vals.push(notes ? String(notes) : null);
      }
      if (toothCol && toothRegion !== undefined) {
        sets.push(`${toothCol} = ?`);
        vals.push(toothRegion ? String(toothRegion) : null);
      }
      const nextReview = nextReviewDate ?? next_review_date;
      if (nextReviewCol && nextReview !== undefined) {
        sets.push(`${nextReviewCol} = ?`);
        vals.push(nextReview ? toDateStr(nextReview) : null);
      }

      if (cols.has("updated_at")) {
        sets.push("updated_at = NOW()");
      }

      if (!sets.length) return res.status(400).json({ message: "No fields to update" });

      vals.push(dbId, doctorId);
      const [result] = await pool.query(
        `UPDATE cases SET ${sets.join(", ")} WHERE id = ? AND doctor_id = ?`,
        vals
      );
      if (!result.affectedRows) return res.status(404).json({ message: "Case not found" });

      await enqueueEventCompat({
        eventType: "CaseUpdated",
        payload: { caseDbId: dbId, stage: stage || null, nextAction: "Case updated" },
        createdByUserId: req.user?.id || null,
      });

      try {
        const [ctxRows] = await pool.query(
          `SELECT case_uid, patient_id FROM cases WHERE id = ? LIMIT 1`,
          [dbId]
        );
        const ctx = ctxRows?.[0] || {};
        const stageLabel = stage ? String(stage) : "details";

        await insertNotificationInline({
          userRole: "Admin",
          title: "Doctor Updated Case",
          message: `Case ${ctx.case_uid || `CASE-${dbId}`} updated (${stageLabel}).`,
          notifType: "CASE_UPDATED",
          relatedType: "cases",
          relatedId: dbId,
          meta: { caseId: dbId, caseUid: ctx.case_uid || null, stage: stage || null },
          priority: 140,
        });

        if (ctx.patient_id) {
          await insertNotificationInline({
            userId: ctx.patient_id,
            title: "Case Progress Updated",
            message: `Your case ${ctx.case_uid || `CASE-${dbId}`} has new progress updates.`,
            notifType: "CASE_UPDATED",
            relatedType: "cases",
            relatedId: dbId,
            meta: { caseId: dbId, caseUid: ctx.case_uid || null, stage: stage || null },
            priority: 130,
          });
        }
      } catch (notifyErr) {
        console.error("DOCTOR CASE UPDATE notification error:", notifyErr);
      }

      const [rows] = await pool.query(
        `SELECT updated_at FROM cases WHERE id = ? LIMIT 1`,
        [dbId]
      );

      return res.json({
        case: {
          id: dbId,
          updatedAt: rows?.[0]?.updated_at || new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("DOCTOR CASE UPDATE ERROR:", err);
      return res.status(500).json({ message: "Failed to update case" });
    }
  }
);

// DOCTOR: request stage transition (approval workflow via agent)
app.post(
  `${DOCTOR_BASE}/cases/:dbId/stage/request`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const { toStage, requestedStage, reason } = req.body || {};
      const stage = (requestedStage || toStage || "").trim();
      if (!Number.isFinite(dbId) || dbId <= 0 || !stage) {
        return res.status(400).json({ message: "Invalid case id or stage" });
      }

      await enqueueEventCompat({
        eventType: "CaseStageTransitionRequested",
        payload: { caseDbId: dbId, requestedStage: stage, reason: reason || "Stage change requested" },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true, requested: true });
    } catch (err) {
      console.error("DOCTOR CASE STAGE REQUEST ERROR:", err);
      return res.status(500).json({ message: "Failed to request stage change" });
    }
  }
);

// DOCTOR: approve stage transition (direct approval path)
app.post(
  `${DOCTOR_BASE}/cases/:dbId/stage/approve`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      const { approvedStage, toStage } = req.body || {};
      const stage = (approvedStage || toStage || "").trim();
      if (!Number.isFinite(dbId) || dbId <= 0 || !stage) {
        return res.status(400).json({ message: "Invalid case id or stage" });
      }

      await enqueueEventCompat({
        eventType: "CaseStageTransitionApproved",
        payload: { caseDbId: dbId, approvedStage: stage },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true, approved: true });
    } catch (err) {
      console.error("DOCTOR CASE STAGE APPROVE ERROR:", err);
      return res.status(500).json({ message: "Failed to approve stage change" });
    }
  }
);

// DOCTOR: case timeline (optional)
app.get(
  `${DOCTOR_BASE}/cases/:dbId/timeline`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }

      const ok = await tableExists("case_timeline");
      if (!ok) return res.json({ timeline: [] });

      const cols = await getTableColumns("case_timeline");
      const caseCol = pickCol(cols, ["case_id", "case_db_id"]);
      const eventCol = pickCol(cols, ["event_type", "type"]);
      const titleCol = pickCol(cols, ["title"]);
      const bodyCol = pickCol(cols, ["body", "message", "details"]);
      const createdCol = pickCol(cols, ["created_at", "updated_at"]);
      const actorCol = pickCol(cols, ["actor", "actor_name", "actor_role", "created_by", "created_by_user_id"]);

      if (!caseCol) return res.json({ timeline: [] });

      const rows = await safeQuery(
        "DOCTOR CASE TIMELINE",
        `
        SELECT
          id,
          ${eventCol ? `${eventCol} AS event_type,` : "NULL AS event_type,"}
          ${titleCol ? `${titleCol} AS title,` : "NULL AS title,"}
          ${bodyCol ? `${bodyCol} AS body,` : "NULL AS body,"}
          ${actorCol ? `${actorCol} AS actor,` : "NULL AS actor,"}
          ${createdCol ? `${createdCol} AS created_at` : "NULL AS created_at"}
        FROM case_timeline
        WHERE ${caseCol} = ?
        ORDER BY ${createdCol ? createdCol : "id"} DESC
        LIMIT 200
        `,
        [dbId]
      );

      return res.json({ timeline: rows || [] });
    } catch (err) {
      console.error("DOCTOR CASE TIMELINE ERROR:", err);
      return res.json({ timeline: [], error: true });
    }
  }
);

// DOCTOR: case summaries (optional)
app.get(
  `${DOCTOR_BASE}/cases/:dbId/summaries`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }

      const includePending = String(req.query.includePending || "1") === "1";
      const ok = await tableExists("case_summaries");
      if (!ok) return res.json({ summaries: [] });

      const cols = await getTableColumns("case_summaries");
      const caseCol = pickCol(cols, ["case_id", "case_db_id"]);
      const summaryCol = pickCol(cols, ["summary", "summary_text"]);
      const recCol = pickCol(cols, ["recommendation", "recommendation_text"]);
      const confCol = pickCol(cols, ["confidence", "confidence_score"]);
      const statusCol = pickCol(cols, ["status"]);
      const createdCol = pickCol(cols, ["created_at", "updated_at"]);

      if (!caseCol) return res.json({ summaries: [] });

      const statusFilter = statusCol
        ? includePending
          ? ""
          : `AND ${statusCol} NOT IN ('DRAFT','PENDING')`
        : "";

      const rows = await safeQuery(
        "DOCTOR CASE SUMMARIES",
        `
        SELECT
          id,
          ${summaryCol ? `${summaryCol} AS summary,` : "NULL AS summary,"}
          ${recCol ? `${recCol} AS recommendation,` : "NULL AS recommendation,"}
          ${confCol ? `${confCol} AS confidence,` : "NULL AS confidence,"}
          ${statusCol ? `${statusCol} AS status,` : "NULL AS status,"}
          ${createdCol ? `${createdCol} AS created_at` : "NULL AS created_at"}
        FROM case_summaries
        WHERE ${caseCol} = ?
        ${statusFilter}
        ORDER BY ${createdCol ? createdCol : "id"} DESC
        LIMIT 50
        `,
        [dbId]
      );

      return res.json({ summaries: rows || [] });
    } catch (err) {
      console.error("DOCTOR CASE SUMMARIES ERROR:", err);
      return res.json({ summaries: [], error: true });
    }
  }
);

// DOCTOR: create new case (kept) ✅ + NEW CaseUpdated event
app.post(
  `${DOCTOR_BASE}/cases`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    const doctorId = req.user.id;
    const { patientName, patientUid, toothRegion, diagnosis, stage } = req.body || {};

    if ((!patientName && !patientUid) || !diagnosis) {
      return res.status(400).json({ message: "Patient and diagnosis are required" });
    }

    try {
      const nameTrimmed = String(patientName).trim();
      let patientId = null;
      let resolvedPatientName = nameTrimmed;

      if (patientUid) {
        const [patientByUid] = await pool.query(
          `SELECT id, full_name FROM users WHERE uid = ? AND role = 'Patient' LIMIT 1`,
          [String(patientUid).trim()]
        );
        if (!patientByUid.length) {
          return res.status(400).json({ message: "Selected patient not found" });
        }
        patientId = patientByUid[0].id;
        resolvedPatientName = patientByUid[0].full_name || nameTrimmed || "Patient";
      }

      if (!patientId) {
        const [existing] = await pool.query(
          `SELECT id FROM users WHERE full_name = ? AND role = 'Patient' LIMIT 1`,
          [nameTrimmed]
        );

        if (existing.length > 0) {
          patientId = existing[0].id;
        } else {
          const newUid = generateUid("Patient");
          const [insertPatient] = await pool.query(
            `INSERT INTO users (uid, full_name, role, created_at)
             VALUES (?, ?, 'Patient', NOW())`,
            [newUid, nameTrimmed]
          );
          patientId = insertPatient.insertId;
        }
      }

      const stageDb = String(stage || "NEW").toUpperCase();
      const caseUid = `CASE-${Date.now()}`;

      const [result] = await pool.query(
        `INSERT INTO cases
          (case_uid, patient_id, doctor_id, case_type, next_action, stage, priority, risk_score, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'MEDIUM', 0, NOW(), NOW())`,
        [caseUid, patientId, doctorId, diagnosis, toothRegion || null, stageDb]
      );

      const newId = result.insertId;

      await enqueueEventCompat({
        eventType: "CaseUpdated",
        payload: { caseDbId: newId, stage: stageDb, nextAction: "Case created" },
        createdByUserId: req.user?.id || null,
      });

      try {
        await insertNotificationInline({
          userRole: "Admin",
          title: "New Case Created",
          message: `Doctor created case ${caseUid} for ${resolvedPatientName}.`,
          notifType: "CASE_CREATED",
          relatedType: "cases",
          relatedId: newId,
          meta: { caseId: newId, caseUid, patientId, doctorId, diagnosis, stage: stageDb },
          priority: 145,
        });
        await insertNotificationInline({
          userId: doctorId,
          title: "Case Created",
          message: `Case ${caseUid} was created successfully.`,
          notifType: "CASE_CREATED",
          relatedType: "cases",
          relatedId: newId,
          meta: { caseId: newId, caseUid, patientId, doctorId, diagnosis, stage: stageDb },
          priority: 135,
        });
        if (patientId) {
          await insertNotificationInline({
            userId: patientId,
            title: "Treatment Case Opened",
            message: `A new treatment case (${caseUid}) has been opened for you.`,
            notifType: "CASE_CREATED",
            relatedType: "cases",
            relatedId: newId,
            meta: { caseId: newId, caseUid, patientId, doctorId, diagnosis, stage: stageDb },
            priority: 130,
          });
        }
      } catch (notifyErr) {
        console.error("DOCTOR CREATE CASE notification error:", notifyErr);
      }

      const [rows] = await pool.query(
        `SELECT case_uid AS caseId, case_type AS diagnosis, next_action AS toothRegion, stage, agent_summary AS agentSummary,
                agent_recommendation AS agentRecommendation, created_at AS createdAt, updated_at AS updatedAt
         FROM cases WHERE id = ?`,
        [newId]
      );
      const row = rows[0] || {};

      res.status(201).json({
        case: {
          dbId: newId,
          id: row.caseId || caseUid,
          caseId: row.caseId || caseUid,
          patientName: resolvedPatientName,
          toothRegion: row.toothRegion || toothRegion || "Not specified",
          diagnosis: row.diagnosis || diagnosis,
          stage: mapStageDbToLabel(row.stage || stageDb),
          agentSummary: row.agentSummary || null,
          agentRecommendation: row.agentRecommendation || null,
          createdAt: row.createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("DOCTOR CREATE CASE ERROR:", err);
      return res.status(500).json({ message: "Failed to create case. Please try again." });
    }
  }
);

// ✅ NEW: case attachments upload
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

app.use("/uploads", express.static(uploadDir));

app.post(
  `${DOCTOR_BASE}/cases/:caseDbId/attachments`,
  authMiddleware,
  requireRole("Doctor"),
  upload.single("file"),
  async (req, res) => {
    try {
      const caseId = Number(req.params.caseDbId);
      if (!req.file) return res.status(400).json({ message: "file required" });

      const safeOriginal = String(req.file.originalname || "file").replace(/[/\\]/g, "_");
      const destPath = path.join(uploadDir, `${Date.now()}-${safeOriginal}`);
      fs.renameSync(req.file.path, destPath);

      await pool.query(
        `INSERT INTO case_attachments (case_id, file_name, file_path, mime_type, uploaded_by_user_id)
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, safeOriginal, destPath, req.file.mimetype, req.user.id]
      );

      await enqueueEventCompat({
        eventType: "CaseUpdated",
        payload: { caseDbId: caseId, nextAction: "Attachment uploaded" },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error("CASE ATTACHMENT UPLOAD ERROR:", err);
      return res.status(500).json({ message: "Upload failed" });
    }
  }
);

// ========================================================================================
// DOCTOR: request AI summary for a case
//
// Doctors can trigger an AI-generated case summary via this endpoint.  The
// payload may include an optional array of visit database IDs to scope the
// summary; if omitted the agent will consider all visits for the case.  The
// request enqueues a CaseGenerateSummary event that will be handled by the
// Python CaseTrackingAgent and does not block the HTTP response.
app.post(
  `${DOCTOR_BASE}/cases/:caseDbId/summary`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const caseId = Number(req.params.caseDbId);
      if (!caseId) return res.status(400).json({ message: "Invalid case ID" });

      const { visitIds } = req.body || {};
      let visitList = [];
      if (Array.isArray(visitIds)) {
        visitList = visitIds
          .map((v) => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : null;
          })
          .filter((v) => v !== null);
      }

      const [existingRows] = await pool.query(
        `
        SELECT id, status, updated_at
        FROM agent_events
        WHERE event_type = 'CaseGenerateSummary'
          AND status IN ('NEW', 'PROCESSING')
          AND (
            (JSON_VALID(payload_json) AND (
              JSON_EXTRACT(payload_json, '$.caseDbId') = CAST(? AS JSON)
              OR JSON_EXTRACT(payload_json, '$.caseId') = CAST(? AS JSON)
            ))
            OR payload_json LIKE ?
            OR payload_json LIKE ?
          )
        ORDER BY id DESC
        LIMIT 1
        `,
        [caseId, caseId, `%"caseDbId":${caseId}%`, `%"caseId":${caseId}%`]
      );
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      if (existing) {
        return res.status(409).json({
          ok: true,
          queued: false,
          message: "Summary generation already in progress for this case",
          existing: {
            eventId: Number(existing.id || 0) || null,
            status: String(existing.status || ""),
            updatedAt: existing.updated_at || null,
          },
        });
      }

      await enqueueEventCompat({
        eventType: "CaseGenerateSummary",
        payload: {
          caseDbId: caseId,
          caseId,
          source: "doctor_ui",
          entityType: "cases",
          entityId: caseId,
        },
        createdByUserId: req.user?.id || null,
      });

      const [evRows] = await pool.query(
        `
        SELECT id
        FROM agent_events
        WHERE event_type = 'CaseGenerateSummary'
          AND status IN ('NEW', 'PROCESSING')
          AND (
            (JSON_VALID(payload_json) AND (
              JSON_EXTRACT(payload_json, '$.caseDbId') = CAST(? AS JSON)
              OR JSON_EXTRACT(payload_json, '$.caseId') = CAST(? AS JSON)
            ))
            OR payload_json LIKE ?
            OR payload_json LIKE ?
          )
        ORDER BY id DESC
        LIMIT 1
        `,
        [caseId, caseId, `%"caseDbId":${caseId}%`, `%"caseId":${caseId}%`]
      );
      const eventId = Number(evRows?.[0]?.id || 0) || null;

      return res.json({ ok: true, queued: true, eventId });
    } catch (err) {
      console.error("CASE SUMMARY REQUEST ERROR:", err);
      return res.status(500).json({ message: "Failed to request summary" });
    }
  }
);

// ✅ NEW: Generate immediate AI case summary with enhanced intelligence
app.post(
  `${DOCTOR_BASE}/cases/:caseDbId/ai-summary`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const caseId = Number(req.params.caseDbId);
      if (!Number.isFinite(caseId) || caseId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }

      // Get comprehensive case data
      const [caseRows] = await pool.query(`
        SELECT 
          c.case_uid,
          c.case_type,
          c.stage,
          c.risk_score,
          c.next_action,
          c.agent_summary,
          c.agent_recommendation,
          p.full_name as patient_name,
          p.id as patient_id
        FROM cases c
        JOIN users p ON c.patient_id = p.id
        WHERE c.id = ?
      `, [caseId]);

      if (!caseRows.length) {
        return res.status(404).json({ message: "Case not found" });
      }

      const caseData = caseRows[0];
      
      // Get patient medical history
      const [profileRows] = await pool.query(`
        SELECT medical_history, allergies, notes
        FROM patient_profiles
        WHERE user_id = ?
      `, [caseData.patient_id]);

      // Get recent procedures for this case
      const [procedureRows] = await pool.query(`
        SELECT DISTINCT vp.procedure_code
        FROM visit_procedures vp
        JOIN visits v ON vp.visit_id = v.id
        WHERE v.linked_case_id = ?
        ORDER BY vp.created_at DESC
        LIMIT 5
      `, [caseId]);

      const procedures = procedureRows.map(row => row.procedure_code);

      // Generate comprehensive AI summary
      const aiSummary = aiCaseAssistant.generateCaseSummary({
        patientName: caseData.patient_name,
        caseType: caseData.case_type || "General Treatment",
        procedures: procedures,
        findings: caseData.next_action || "Clinical assessment completed",
        stage: caseData.stage,
        riskScore: caseData.risk_score || 50,
        medicalHistory: profileRows[0]?.medical_history || "",
        lastVisitNotes: profileRows[0]?.notes || ""
      });

      // Update case with new AI summary
      await pool.query(`
        UPDATE cases 
        SET 
          agent_summary = ?,
          agent_recommendation = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        aiSummary.summary,
        aiSummary.recommendations.join('; '),
        caseId
      ]);

      return res.json({
        success: true,
        caseId: caseData.case_uid,
        aiSummary: aiSummary,
        updated: true
      });
    } catch (err) {
      console.error("AI CASE SUMMARY ERROR:", err);
      return res.status(500).json({ message: "Failed to generate AI summary" });
    }
  }
);

// DOCTOR: request patient auto-match for a case (enqueue CaseAutoMatchRequested)
app.post(
  `${DOCTOR_BASE}/cases/:caseDbId/auto-match`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const caseId = Number(req.params.caseDbId);
      if (!caseId) return res.status(400).json({ message: "Invalid case ID" });

      const { patientId, patientPhone, patientName } = req.body || {};

      await enqueueEventCompat({
        eventType: "CaseAutoMatchRequested",
        payload: {
          caseDbId: caseId,
          caseId,
          patientId: patientId || null,
          patientPhone: patientPhone || null,
          patientName: patientName || null,
        },
        createdByUserId: req.user?.id || null,
      });

      return res.json({ ok: true, queued: true });
    } catch (err) {
      console.error("CASE AUTO-MATCH REQUEST ERROR:", err);
      return res.status(500).json({ message: "Failed to request auto-match" });
    }
  }
);

// DOCTOR: case insights
app.get(
  `${DOCTOR_BASE}/cases/:dbId/insights`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }

      const doctorId = req.user.id;
      const cols = await getTableColumns("cases");
      const insightsCol = cols.has("agent_insights_json") ? "agent_insights_json" : null;

      const rows = await safeQuery(
        "DOCTOR CASE INSIGHTS",
        `SELECT risk_score, agent_summary, agent_recommendation, next_action
         ${insightsCol ? `, ${insightsCol} AS agent_insights_json` : ""}
         FROM cases
         WHERE id = ? AND doctor_id = ?
         LIMIT 1`,
        [dbId, doctorId]
      );

      if (!rows.length) return res.status(404).json({ message: "Case not found" });
      const r = rows[0];

      return res.json({
        risk_score: Number(r.risk_score || 0),
        compliance_score: 0, // placeholder, not implemented yet
        on_track: Number(r.risk_score || 0) < 50, // placeholder logic
        next_steps: r.next_action || r.agent_recommendation || "No next steps available",
        agent_insights: r.agent_insights_json ? safeJsonParse(r.agent_insights_json, {}) : null,
      });
    } catch (err) {
      console.error("DOCTOR CASE INSIGHTS ERROR:", err);
      return res.status(500).json({ message: "Failed to load insights" });
    }
  }
);

app.get(
  `${DOCTOR_BASE}/cases/:dbId/documents`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const dbId = Number(req.params.dbId);
      if (!Number.isFinite(dbId) || dbId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }
      const doctorId = req.user.id;
      const [caseRows] = await pool.query(
        `SELECT id, case_uid, stage, doctor_id FROM cases WHERE id = ? AND doctor_id = ? LIMIT 1`,
        [dbId, doctorId]
      );
      if (!caseRows.length) return res.status(404).json({ message: "Case not found" });

      let docs = [];
      if (await tableExists("case_documents")) {
        const [docRows] = await pool.query(
          `
          SELECT id, doc_type, content, status, created_by_agent_event_id, created_at, updated_at
          FROM case_documents
          WHERE case_id = ?
          ORDER BY updated_at DESC, id DESC
          `,
          [dbId]
        );
        docs = docRows || [];
      }

      if (!docs.length && (await tableExists("case_summaries"))) {
        const [sumRows] = await pool.query(
          `
          SELECT id, summary, recommendation, status, created_at
          FROM case_summaries
          WHERE case_id = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [dbId]
        );
        if (sumRows.length) {
          const s = sumRows[0];
          docs = [
            {
              id: `virtual-clinical-${s.id}`,
              doc_type: "clinical_summary",
              content: s.summary || "",
              status: s.status === "APPROVED" ? "APPROVED" : "READY",
              created_by_agent_event_id: null,
              created_at: s.created_at,
              updated_at: s.created_at,
            },
            {
              id: `virtual-patient-${s.id}`,
              doc_type: "patient_explanation",
              content: s.recommendation || "Follow the doctor-provided treatment plan and return for review.",
              status: s.status === "APPROVED" ? "APPROVED" : "DRAFT",
              created_by_agent_event_id: null,
              created_at: s.created_at,
              updated_at: s.created_at,
            },
          ];
        }
      }

      return res.json({ caseId: dbId, items: docs });
    } catch (err) {
      console.error("DOCTOR CASE DOCUMENTS ERROR:", err);
      return res.status(500).json({ message: "Failed to load case documents" });
    }
  }
);

app.get(
  `${DOCTOR_BASE}/appointments/:id/recommend-next-stage`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }
      const [rows] = await pool.query(
        `
        SELECT a.id, a.doctor_id, a.patient_id, a.linked_case_id,
               DATE_FORMAT(a.scheduled_date, '%Y-%m-%d') AS scheduled_date,
               TIME_FORMAT(a.scheduled_time, '%H:%i:%s') AS scheduled_time,
               a.predicted_duration_min, a.type,
               c.stage, c.next_review_date
        FROM appointments a
        LEFT JOIN cases c ON c.id = a.linked_case_id
        WHERE a.id = ? AND a.doctor_id = ?
        LIMIT 1
        `,
        [appointmentId, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
      const r = rows[0];

      const currentDate = new Date(`${r.scheduled_date}T${r.scheduled_time || "10:00:00"}`);
      const healingDays = r.stage === "IN_TREATMENT" ? 7 : r.stage === "WAITING_ON_PATIENT" ? 3 : 5;
      const recommendedStart = new Date(currentDate.getTime() + healingDays * 24 * 60 * 60 * 1000);
      recommendedStart.setHours(10, 0, 0, 0);
      const duration = Number(r.predicted_duration_min || 30) || 30;
      const recommendedEnd = new Date(recommendedStart.getTime() + duration * 60 * 1000);

      if (await tableExists("appointment_recommendations")) {
        await pool.query(
          `
          INSERT INTO appointment_recommendations
            (appointment_id, doctor_id, recommended_start, recommended_end, reason, confidence)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            appointmentId,
            req.user.id,
            formatDateTime(recommendedStart),
            formatDateTime(recommendedEnd),
            "Treatment-linked scheduling suggestion",
            72,
          ]
        );
      }

      return res.json({
        appointmentId,
        linkedCaseId: r.linked_case_id || null,
        recommendation: {
          recommendedStart: formatDateTime(recommendedStart),
          recommendedEnd: formatDateTime(recommendedEnd),
          predictedDurationMin: duration,
          confidence: 72,
          reason: "Based on current case stage and expected healing window.",
        },
      });
    } catch (err) {
      console.error("DOCTOR NEXT STAGE RECOMMENDATION ERROR:", err);
      return res.status(500).json({ message: "Failed to generate recommendation" });
    }
  }
);

// DOCTOR: approve case summary
app.post(
  `${DOCTOR_BASE}/cases/:caseDbId/summaries/:summaryId/approve`,
  authMiddleware,
  requireRole("Doctor"),
  async (req, res) => {
    try {
      const caseId = Number(req.params.caseDbId);
      const summaryId = Number(req.params.summaryId);
      if (!Number.isFinite(caseId) || caseId <= 0 || !Number.isFinite(summaryId) || summaryId <= 0) {
        return res.status(400).json({ message: "Invalid case or summary id" });
      }

      const doctorId = req.user.id;
      const ok = await tableExists("case_summaries");
      if (!ok) return res.status(501).json({ message: "case_summaries table not found" });

      const cols = await getTableColumns("case_summaries");
      const caseCol = pickCol(cols, ["case_id", "case_db_id"]);
      const statusCol = pickCol(cols, ["status"]);

      if (!caseCol || !statusCol) return res.status(500).json({ message: "case_summaries schema not supported" });

      // Check case ownership
      const [caseRows] = await pool.query(`SELECT id FROM cases WHERE id = ? AND doctor_id = ? LIMIT 1`, [caseId, doctorId]);
      if (!caseRows.length) return res.status(404).json({ message: "Case not found" });

      const approvedByCol = cols.has("approved_by_user_id") ? "approved_by_user_id" : null;
      const approvedAtCol = cols.has("approved_at") ? "approved_at" : null;

      const [beforeRows] = await pool.query(
        `SELECT id, ${statusCol} AS status, summary, recommendation, confidence, created_at
         FROM case_summaries
         WHERE id = ? AND ${caseCol} = ?
         LIMIT 1`,
        [summaryId, caseId]
      );
      if (!beforeRows.length) return res.status(404).json({ message: "Summary not found" });

      const setClauses = [`${statusCol} = 'APPROVED'`];
      const setVals = [];
      if (approvedByCol) {
        setClauses.push(`${approvedByCol} = ?`);
        setVals.push(doctorId);
      }
      if (approvedAtCol) {
        setClauses.push(`${approvedAtCol} = NOW()`);
      }

      const [result] = await pool.query(
        `UPDATE case_summaries SET ${setClauses.join(", ")} WHERE id = ? AND ${caseCol} = ?`,
        [...setVals, summaryId, caseId]
      );

      if (!result.affectedRows) return res.status(404).json({ message: "Summary not found" });

      try {
        await pool.query(
          `INSERT INTO audit_logs
             (actor_user_id, actor_role, entity_type, entity_id, action, before_json, after_json, meta_json)
           VALUES (?, ?, 'case_summary', ?, 'APPROVE', ?, ?, ?)`,
          [
            doctorId,
            "Doctor",
            summaryId,
            JSON.stringify(beforeRows[0] || {}),
            JSON.stringify({ id: summaryId, status: "APPROVED", approvedByUserId: doctorId }),
            JSON.stringify({ caseId, route: "doctor_summary_approve" }),
          ]
        );
      } catch (auditErr) {
        console.error("APPROVE SUMMARY audit insert failed:", auditErr?.message || auditErr);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("APPROVE SUMMARY ERROR:", err);
      return res.status(500).json({ message: "Failed to approve summary" });
    }
  }
);

// ✅ ADMIN: INVENTORY USAGE (traceability)
app.get(
  `${ADMIN_BASE}/inventory/analytics`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      if (!(await tableExists("inventory_usage_logs"))) {
        return res.json({ byDoctor: [], byProcedure: [], anomalies: [] });
      }

      const [byDoctor] = await pool.query(
        `
        SELECT COALESCE(u.full_name, 'Unknown') AS doctor_name,
               l.doctor_id,
               l.item_code,
               SUM(COALESCE(l.qty_used, 0)) AS qty_used,
               COUNT(*) AS usage_count
        FROM inventory_usage_logs l
        LEFT JOIN users u ON u.id = l.doctor_id
        GROUP BY l.doctor_id, l.item_code
        ORDER BY qty_used DESC
        LIMIT 30
        `
      );

      const [byProcedure] = await pool.query(
        `
        SELECT vp.procedure_code,
               l.item_code,
               SUM(COALESCE(l.qty_used,0)) AS qty_used
        FROM inventory_usage_logs l
        LEFT JOIN visits v ON v.id = l.visit_id
        LEFT JOIN visit_procedures vp ON vp.visit_id = v.id
        GROUP BY vp.procedure_code, l.item_code
        ORDER BY qty_used DESC
        LIMIT 30
        `
      );

      let anomalies = [];
      if (await tableExists("inventory_anomalies")) {
        const [anomalyRows] = await pool.query(
          `
          SELECT id, item_code, doctor_id, procedure_code, anomaly_type, severity, score, meta_json, created_at
          FROM inventory_anomalies
          ORDER BY id DESC
          LIMIT 25
          `
        );
        anomalies = anomalyRows || [];
      }

      if (!anomalies.length && Array.isArray(byDoctor) && byDoctor.length) {
        const top = byDoctor.slice(0, 5).filter((r) => Number(r.qty_used || 0) > 10);
        anomalies = top.map((r, idx) => ({
          id: `derived-${idx + 1}`,
          item_code: r.item_code,
          doctor_id: r.doctor_id,
          procedure_code: null,
          anomaly_type: "HIGH_USAGE_PATTERN",
          severity: Number(r.qty_used || 0) > 20 ? "HIGH" : "MEDIUM",
          score: Number(r.qty_used || 0),
          created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
          meta_json: JSON.stringify({ usageCount: Number(r.usage_count || 0), source: "derived_runtime" }),
        }));
      }

      return res.json({
        byDoctor: byDoctor || [],
        byProcedure: byProcedure || [],
        anomalies,
      });
    } catch (err) {
      console.error("ADMIN INVENTORY ANALYTICS ERROR:", err);
      return res.status(500).json({ byDoctor: [], byProcedure: [], anomalies: [] });
    }
  }
);

app.get(
  `${ADMIN_BASE}/inventory/usage`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      if (!(await tableExists("inventory_usage_logs"))) {
        return res.json({ items: [] });
      }
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
      const [rows] = await pool.query(
        `
        SELECT l.id,
               l.appointment_id,
               l.visit_id,
               l.item_id,
               l.item_code,
               l.qty_used,
               l.source,
               l.source_type,
               l.source_ref_id,
               l.event_id,
               l.created_at,
               i.name AS item_name
        FROM inventory_usage_logs l
        LEFT JOIN inventory_items i ON i.id = l.item_id
        ORDER BY l.id DESC
        LIMIT ?
        `,
        [limit]
      );
      return res.json({ items: rows || [] });
    } catch (err) {
      console.error("ADMIN INVENTORY USAGE ERROR:", err);
      return res.json({ items: [], error: true });
    }
  }
);

// CASE AGENT STATUS (minimal visibility endpoint)
app.get(
  `/api/cases/:id/agent-status`,
  authMiddleware,
  async (req, res) => {
    try {
      const caseId = Number(req.params.id);
      if (!Number.isFinite(caseId) || caseId <= 0) {
        return res.status(400).json({ message: "Invalid case id" });
      }

      const role = String(req.user?.role || "");
      if (role === "Doctor") {
        const [rows] = await pool.query(`SELECT id FROM cases WHERE id = ? AND doctor_id = ? LIMIT 1`, [caseId, req.user.id]);
        if (!rows.length) return res.status(404).json({ message: "Case not found" });
      } else if (role === "Patient") {
        const [rows] = await pool.query(`SELECT id FROM cases WHERE id = ? AND patient_id = ? LIMIT 1`, [caseId, req.user.id]);
        if (!rows.length) return res.status(404).json({ message: "Case not found" });
      } else if (role !== "Admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const recentRows = await safeQuery(
        "CASE AGENT STATUS",
        `SELECT id, event_type, status, last_error, created_at, updated_at, payload_json, created_by_user_id
         FROM agent_events
         WHERE event_type LIKE 'Case%' OR event_type IN ('AppointmentCompleted','AppointmentCreated')
         ORDER BY id DESC
         LIMIT 200`,
        []
      );

      const extractCaseId = (payloadJson) => {
        try {
          const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson || {};
          const v = Number(payload.caseDbId || payload.caseId || payload.linkedCaseId || 0);
          return Number.isFinite(v) ? v : 0;
        } catch {
          return 0;
        }
      };

      const related = (recentRows || []).filter((r) => extractCaseId(r.payload_json) === caseId);
      const latest = related[0] || null;

      return res.json({
        caseId,
        latest: latest
          ? {
              eventId: latest.id,
              eventType: latest.event_type,
              status: latest.status,
              updatedAt: latest.updated_at,
              lastError: latest.last_error || null,
              actor: latest.created_by_user_id ? `user:${latest.created_by_user_id}` : null,
            }
          : null,
        eventType: latest?.event_type || "",
        status: latest?.status || "",
        updatedAt: latest?.updated_at || null,
        eventId: latest?.id || null,
        lastError: latest?.last_error || null,
        recent: related.slice(0, 10).map((r) => ({
          eventId: r.id,
          eventType: r.event_type,
          status: r.status,
          updatedAt: r.updated_at,
          lastError: r.last_error || null,
          actor: r.created_by_user_id ? `user:${r.created_by_user_id}` : null,
        })),
      });
    } catch (err) {
      console.error("CASE AGENT STATUS ERROR:", err);
      return res.status(500).json({ message: "Failed to load case agent status" });
    }
  }
);

// APPOINTMENT AGENT STATUS (automation visibility for admin/doctor/patient)
app.get(
  `/api/appointments/:id/agent-status`,
  authMiddleware,
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }

      const role = String(req.user?.role || "");
      if (role === "Doctor") {
        const [rows] = await pool.query(
          `SELECT id FROM appointments WHERE id = ? AND doctor_id = ? LIMIT 1`,
          [appointmentId, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
      } else if (role === "Patient") {
        const [rows] = await pool.query(
          `SELECT id FROM appointments WHERE id = ? AND patient_id = ? LIMIT 1`,
          [appointmentId, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
      } else if (role !== "Admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const [rows] = await pool.query(
        `
        SELECT id, event_type, status, updated_at, created_at, last_error
        FROM agent_events
        WHERE (
          payload_json LIKE ?
          OR payload_json LIKE ?
          OR payload_json LIKE ?
          OR payload_json LIKE ?
        )
          AND (
            event_type LIKE 'Appointment%'
            OR event_type LIKE 'Inventory%'
            OR event_type LIKE 'Revenue%'
            OR event_type LIKE 'Case%'
          )
        ORDER BY id DESC
        LIMIT 20
        `,
        [
          `%\"appointmentId\":${appointmentId}%`,
          `%\"appointmentId\":\"${appointmentId}\"%`,
          `%\"appointment_id\":${appointmentId}%`,
          `%\"appointment_id\":\"${appointmentId}\"%`,
        ]
      );

      const latest = rows?.[0] || null;
      const status = String(latest?.status || "");
      const isRunning = status === "NEW" || status === "PROCESSING";
      return res.json({
        appointmentId,
        latest: latest
          ? {
              eventId: latest.id,
              eventType: latest.event_type,
              status: latest.status,
              updatedAt: latest.updated_at,
              lastError: latest.last_error || null,
            }
          : null,
        eventId: latest?.id || null,
        eventType: latest?.event_type || null,
        status: latest?.status || null,
        updatedAt: latest?.updated_at || null,
        lastError: latest?.last_error || null,
        isRunning,
        recent: (rows || []).map((r) => ({
          eventId: r.id,
          eventType: r.event_type,
          status: r.status,
          updatedAt: r.updated_at,
          lastError: r.last_error || null,
        })),
      });
    } catch (err) {
      console.error("APPOINTMENT AGENT STATUS ERROR:", err);
      return res.status(500).json({ message: "Failed to load appointment agent status" });
    }
  }
);

// ===================================
// PATIENT ROUTES
// ===================================
const PATIENT_BASE = "/api/patient";


// PATIENT: dashboard (UNCHANGED)
app.get(
  `${PATIENT_BASE}/dashboard`,
  authMiddleware,
  requireRole("Patient"),
  async (req, res) => {
    const patientId = req.user.id;
    const todayStr = formatDateYYYYMMDD(new Date());

    try {
      const rowsAppt = await safeQuery(
        "PATIENT DASHBOARD APPTS",
        `SELECT
           a.id,
           a.appointment_uid,
           DATE_FORMAT(a.scheduled_date, '%Y-%m-%d') AS scheduled_date,
           TIME_FORMAT(a.scheduled_time, '%h:%i %p') AS time_display,
           a.type,
           a.status,
           d.full_name AS doctor_name
         FROM appointments a
         LEFT JOIN users d ON d.id = a.doctor_id
         WHERE a.patient_id = ?
           AND a.scheduled_date >= ?
         ORDER BY a.scheduled_date, a.scheduled_time
         LIMIT 5`,
        [patientId, todayStr]
      );

      const upcomingAppointments = rowsAppt.map((r) => {
        const statusRaw = String(r.status || "").toUpperCase();
        let statusLabel = "Pending";
        if (statusRaw === "CONFIRMED") statusLabel = "Confirmed";
        else if (statusRaw === "COMPLETED") statusLabel = "Completed";
        else if (statusRaw === "CANCELLED") statusLabel = "Cancelled";

        return {
          id: r.appointment_uid || r.id,
          date: r.scheduled_date || null,
          time: r.time_display || null,
          doctorName: r.doctor_name || "Clinic doctor",
          reason: r.type || "Dental visit",
          status: statusLabel,
          location: "Main clinic",
        };
      });

      const rowsCases = await safeQuery(
        "PATIENT DASHBOARD CASES",
        `SELECT
           case_uid,
           case_type,
           stage,
           updated_at,
           agent_summary
         FROM cases
         WHERE patient_id = ?
         ORDER BY updated_at DESC
         LIMIT 5`,
        [patientId]
      );

      const treatmentSummaries = rowsCases.map((r) => ({
        id: r.case_uid,
        title: r.case_type || "Dental case",
        lastUpdated: r.updated_at || null,
        stage: mapStageDbToLabel(r.stage),
        snippet:
          r.agent_summary ||
          "Summary not yet available. Your dentist may still be preparing this note.",
      }));

      const rowsInvoices = await safeQuery(
        "PATIENT DASHBOARD INVOICES",
        `SELECT
           id,
           issue_date,
           amount,
           status
         FROM invoices
         WHERE patient_id = ?
         ORDER BY issue_date DESC
         LIMIT 5`,
        [patientId]
      );

      const payments = rowsInvoices.map((r) => ({
        id: r.id,
        date: r.issue_date || null,
        description: `Invoice #${r.id}`,
        amount: Number(r.amount || 0),
        currency: "INR",
        status: r.status || "Pending",
      }));

      res.json({
        upcomingAppointments,
        treatmentSummaries,
        payments,
      });
    } catch (err) {
      console.error("PATIENT DASHBOARD ERROR:", err);
      res.json({
        upcomingAppointments: [],
        treatmentSummaries: [],
        payments: [],
        error: true,
      });
    }
  }
);

// PATIENT: appointments (UNCHANGED)
app.get(
  `${PATIENT_BASE}/appointments`,
  authMiddleware,
  requireRole("Patient"),
  async (req, res) => {
    const patientId = req.user.id;

    try {
      const rows = await safeQuery(
        "PATIENT APPOINTMENTS LIST",
        `SELECT
           a.id,
           a.appointment_uid,
           DATE_FORMAT(a.scheduled_date, '%Y-%m-%d') AS scheduled_date,
           TIME_FORMAT(a.scheduled_time, '%h:%i %p') AS time_display,
           a.type,
           a.status,
           d.full_name AS doctor_name
         FROM appointments a
         LEFT JOIN users d ON d.id = a.doctor_id
         WHERE a.patient_id = ?
         ORDER BY a.scheduled_date DESC, a.scheduled_time DESC`,
        [patientId]
      );

      const items = rows.map((r) => {
        const statusRaw = String(r.status || "").toUpperCase();
        let statusLabel = "Pending";
        if (statusRaw === "CONFIRMED") statusLabel = "Confirmed";
        else if (statusRaw === "COMPLETED") statusLabel = "Completed";
        else if (statusRaw === "CANCELLED") statusLabel = "Cancelled";

        return {
          id: r.appointment_uid || r.id,
          date: r.scheduled_date || null,
          time: r.time_display || null,
          doctor: r.doctor_name || "Clinic doctor",
          reason: r.type || "Dental visit",
          status: statusLabel,
          location: "Main clinic",
          notes: null,
        };
      });

      res.json({ items });
    } catch (err) {
      console.error("PATIENT APPOINTMENTS ERROR:", err);
      res.json({ items: [], error: true });
    }
  }
);

// PATIENT: treatments (UNCHANGED)
app.get(
  `${PATIENT_BASE}/treatments`,
  authMiddleware,
  requireRole("Patient"),
  async (req, res) => {
    const patientId = req.user.id;

    try {
      const rows = await safeQuery(
        "PATIENT TREATMENTS",
        `SELECT
          case_uid,
          id AS case_db_id,
          case_type,
          stage,
          next_review_date,
          next_action,
          updated_at,
          agent_summary,
          agent_recommendation
        FROM cases
        WHERE patient_id = ?
        ORDER BY updated_at DESC`,
        [patientId]
      );

      const caseIds = rows.map((r) => r.case_db_id).filter(Boolean);
      let summaryMap = new Map();
      if (caseIds.length) {
        const placeholders = caseIds.map(() => "?").join(",");
        const srows = await safeQuery(
          "PATIENT TREATMENTS SUMMARIES",
          `SELECT case_id, summary, recommendation, created_at
           FROM case_summaries
           WHERE case_id IN (${placeholders})
           ORDER BY case_id, created_at DESC, id DESC`,
          caseIds
        );
        for (const sr of srows) {
          const cid = sr.case_id;
          if (!summaryMap.has(cid)) summaryMap.set(cid, []);
          summaryMap.get(cid).push({
            summary: sr.summary,
            recommendation: sr.recommendation,
            createdAt: sr.created_at,
          });
        }
      }

      const items = rows.map((r) => {
        const aiSummaries = summaryMap.get(r.case_db_id) || [];
        const fallbackParts = [];
        if (r.case_type) fallbackParts.push(`Case type: ${r.case_type}`);
        if (r.stage) fallbackParts.push(`Stage: ${mapStageDbToLabel(r.stage)}`);
        if (r.next_action) fallbackParts.push(`Next action: ${r.next_action}`);
        if (r.next_review_date) fallbackParts.push(`Next review: ${r.next_review_date}`);
        const fallbackSummary =
          fallbackParts.join(" • ") || "Summary not yet generated. Your dentist may still be preparing this.";

        return {
          id: r.case_uid,
          title: r.case_type || "Dental case",
          lastUpdated: r.updated_at || null,
          stage: mapStageDbToLabel(r.stage),
          summary:
            r.agent_summary ||
            aiSummaries[0]?.summary ||
            fallbackSummary,
          details: r.agent_recommendation || aiSummaries[0]?.recommendation || null,
          aiSummaries,
        };
      });

      // Fallback: if no cases found, surface recent appointments as lightweight treatments
      if (!items.length) {
        const appts = await safeQuery(
          "PATIENT TREATMENTS FALLBACK APPTS",
          `
          SELECT id, appointment_uid, scheduled_date, type, status, updated_at
          FROM appointments
          WHERE patient_id = ?
          ORDER BY scheduled_date DESC, id DESC
          LIMIT 10
          `,
          [patientId]
        );
        for (const a of appts) {
          items.push({
            id: a.appointment_uid || `APT-${a.id}`,
            title: a.type || "Appointment",
            lastUpdated: a.updated_at || a.scheduled_date || null,
            stage: a.status || "Scheduled",
            summary: "Your appointment record is available. A treatment summary will appear after your visit is reviewed.",
            details: null,
            aiSummaries: [],
          });
        }
      }

      res.json({ items });
    } catch (err) {
      console.error("PATIENT TREATMENTS ERROR:", err);
      res.json({ items: [], error: true });
    }
  }
);

// PATIENT: billing (UNCHANGED)
app.get(
  `${PATIENT_BASE}/billing`,
  authMiddleware,
  requireRole("Patient"),
  async (req, res) => {
    const patientId = req.user.id;
    const todayStr = formatDateYYYYMMDD(new Date());

    try {
      const rows = await safeQuery(
        "PATIENT BILLING",
        `SELECT
           id,
           issue_date,
           amount,
           status,
           paid_date
         FROM invoices
         WHERE patient_id = ?
         ORDER BY issue_date DESC, id DESC`,
        [patientId]
      );

      let totalDue = 0;

      const invoices = rows.map((r) => {
        const amountNum = Number(r.amount || 0);
        const statusRaw = String(r.status || "").toUpperCase();

        let statusLabel = "Pending";
        let isPaid = false;

        if (statusRaw === "PAID") {
          statusLabel = "Paid";
          isPaid = true;
        } else if (statusRaw === "OVERDUE") {
          statusLabel = "Overdue";
        }

        if (!isPaid) totalDue += amountNum;

        return {
          id: r.id,
          invoiceNumber: `INV-${r.id}`,
          date: r.issue_date || null,
          amount: amountNum,
          currency: "INR",
          status: statusLabel,
          paidDate: r.paid_date || null,
        };
      });

      res.json({
        summary: {
          totalDue,
          currency: "INR",
          lastUpdated: todayStr,
          invoiceCount: invoices.length,
        },
        invoices,
      });
    } catch (err) {
      console.error("PATIENT BILLING ERROR:", err);
      res.json({
        summary: {
          totalDue: 0,
          currency: "INR",
          lastUpdated: todayStr,
          invoiceCount: 0,
        },
        invoices: [],
        error: true,
      });
    }
  }
);


app.get(
  `${ADMIN_BASE}/invoices`,
  authMiddleware,
  requireRole("Admin"),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT i.id, i.patient_id, i.appointment_id, i.issue_date, i.amount, i.status, i.paid_date, i.created_at,
               u.full_name AS patient_name
        FROM invoices i
        LEFT JOIN users u ON u.id = i.patient_id
        ORDER BY i.created_at DESC
        LIMIT 200
        `
      );
      return res.json({ items: rows || [] });
    } catch (err) {
      console.error("ADMIN INVOICES LIST ERROR:", err);
      return res.status(500).json({ items: [], message: "Failed to load invoices" });
    }
  }
);

app.get(
  `${ADMIN_BASE}/invoices/:invoiceId`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const invoiceId = Number(req.params.invoiceId);
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ message: "Invalid invoice id" });
      }

      const [headRows] = await pool.query(
        `
        SELECT i.id, i.patient_id, i.appointment_id, i.issue_date, i.amount, i.status, i.paid_date, i.created_at,
               u.full_name AS patient_name, a.appointment_uid, c.case_uid
        FROM invoices i
        LEFT JOIN users u ON u.id = i.patient_id
        LEFT JOIN appointments a ON a.id = i.appointment_id
        LEFT JOIN cases c ON c.id = a.linked_case_id
        WHERE i.id = ?
        LIMIT 1
        `,
        [invoiceId]
      );
      if (!headRows.length) return res.status(404).json({ message: "Invoice not found" });

      const [itemRows] = await pool.query(
        `
        SELECT id, invoice_id, code, qty, unit_price, amount, item_type
        FROM invoice_items
        WHERE invoice_id = ?
        ORDER BY id ASC
        `,
        [invoiceId]
      );

      return res.json({ item: headRows[0], items: itemRows || [] });
    } catch (err) {
      console.error("ADMIN INVOICE DETAILS ERROR:", err);
      return res.status(500).json({ message: "Failed to load invoice details" });
    }
  }
);

// ADMIN: mark invoice paid (simple toggle)
app.post(
  `${ADMIN_BASE}/invoices/:invoiceId/pay`,
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const invoiceId = Number(req.params.invoiceId);
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ message: "Invalid invoice id" });
      }

      const paidDate = formatDateYYYYMMDD(new Date());
      await pool.query(
        `
        UPDATE invoices
        SET status='Paid', paid_date = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [paidDate, invoiceId]
      );

      return res.json({ ok: true, invoiceId, status: "Paid", paid_date: paidDate });
    } catch (err) {
      console.error("ADMIN PAY INVOICE ERROR:", err);
      return res.status(500).json({ message: "Failed to mark invoice paid" });
    }
  }
);
function detectAssistantIntent(message = "") {
  const q = String(message || "").toLowerCase().trim();
  if (!q) return "fallback";
  if (/^(hi|hello|hey|yo|good morning|good evening)\b/.test(q)) return "greeting";
  if (/\b(bye|goodbye|see you|cya)\b/.test(q)) return "farewell";
  if (/\b(thanks|thank you)\b/.test(q)) return "thanks";
  if (/\b(what is this|what is dentraos|explain|help|how to use)\b/.test(q)) return "explain";
  if (/(appointment|appointments|schedule|slot|today)/.test(q)) return "appointments";
  if (/(pending summaries|pending summary|summary pending|awaiting summary|awaiting approval)/.test(q))
    return "case_pending_summaries";
  if (q.includes("pending") && q.includes("summar"))
    return "case_pending_summaries";
  if (/(case stages|case stage|cases|case summary|timeline|treatment)/.test(q)) return "cases";
  if (/(inventory|low stock|stock|usage|purchase order|po\b)/.test(q)) return "inventory";
  if (/(revenue|invoice|invoices|billing|report|outstanding)/.test(q)) return "revenue";
  return "fallback";
}

function assistantSuggestionsByRole(role = "") {
  const base = [
    "Show today's appointments",
    "Show case stages",
    "Check inventory alerts",
    "View revenue report",
  ];
  if (isPatientRole(role)) {
    return ["My upcoming appointments", "My case stage", "My invoices", "What can you do?"];
  }
  if (isDoctorRole(role)) {
    return ["Show today's appointments", "Show case stages", "My inventory usage", "How do I generate case summary?"];
  }
  return base;
}

function nextSuggestionsByIntent(intent, role) {
  if (intent === "appointments") {
    return ["Show case stages", "Pending summaries", "Check inventory alerts"];
  }
  if (intent === "cases") {
    return ["Pending summaries", "Show timeline updates", "Show today's appointments"];
  }
  if (intent === "case_pending_summaries") {
    return ["Show case stages", "Show timeline updates", "How do I approve a summary?"];
  }
  if (intent === "inventory") {
    return ["My inventory usage", "Show case stages", "View revenue report"];
  }
  if (intent === "revenue") {
    return ["Outstanding invoices", "Show today's appointments", "Show case stages"];
  }
  return assistantSuggestionsByRole(role);
}

function isAdminRole(role) {
  return String(role || "").toLowerCase() === "admin";
}
function isDoctorRole(role) {
  return String(role || "").toLowerCase() === "doctor";
}
function isPatientRole(role) {
  return String(role || "").toLowerCase() === "patient";
}

app.post("/api/assistant/message", requireAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }
    if (message.length > 600) {
      return res.status(400).json({ message: "Message too long" });
    }

    const userId = Number(req.user?.id || 0);
    const role = String(req.user?.role || "");
    const clinicId = req.user?.clinic_id || req.user?.clinicId || null;
    if (!userId || !role) {
      return res.status(401).json({ message: "Invalid user context" });
    }

    const intent = detectAssistantIntent(message);
    const headersMeta = { intent, userId, role, clinicId };
    const suggestions = nextSuggestionsByIntent(intent, role);

    if (intent === "greeting") {
      return res.json({
        reply: "Hello. I can help with appointments, case stages, inventory status, and revenue snapshots.",
        cards: [],
        suggestions,
        meta: { intent, counts: {}, entityIds: [] },
      });
    }

    if (intent === "farewell") {
      return res.json({
        reply: "Got it. I am here whenever you need updates on appointments, cases, inventory, or revenue.",
        cards: [],
        suggestions,
        meta: { intent, counts: {}, entityIds: [] },
      });
    }

    if (intent === "thanks") {
      return res.json({
        reply: "You're welcome. You can ask for live clinic data anytime.",
        cards: [],
        suggestions,
        meta: { intent, counts: {}, entityIds: [] },
      });
    }

    if (intent === "explain") {
      return res.json({
        reply:
          "DentraOS Assistant is a role-scoped data assistant. It reads live clinic data and answers only within your access level. Try a quick action chip below.",
        cards: [],
        suggestions,
        meta: { intent, counts: {}, entityIds: [] },
      });
    }

    if (intent === "appointments") {
      let sql = `
        SELECT a.id, a.appointment_code, a.scheduled_date, a.scheduled_time, a.status,
               p.full_name AS patient_name, d.full_name AS doctor_name
        FROM appointments a
        LEFT JOIN users p ON p.id = a.patient_id
        LEFT JOIN users d ON d.id = a.doctor_id
        WHERE a.scheduled_date = CURDATE()
      `;
      const params = [];
      if (isDoctorRole(role)) {
        sql += " AND a.doctor_id = ? ";
        params.push(userId);
      } else if (isPatientRole(role)) {
        sql += " AND a.patient_id = ? ";
        params.push(userId);
      }
      sql += " ORDER BY a.scheduled_time ASC LIMIT 8";
      const [rows] = await pool.query(sql, params);
      const items = Array.isArray(rows) ? rows : [];
      const reply =
        items.length > 0
          ? `Found ${items.length} appointment(s) for today.`
          : "No appointments found for today.";

      if (process.env.NODE_ENV !== "production") {
        console.log("ASSISTANT DEBUG", { ...headersMeta, count: items.length });
      }
      return res.json({
        reply,
        cards: [
          {
            type: "appointments",
            title: "Today's appointments",
            rows: items,
          },
        ],
        meta: {
          intent,
          counts: { appointments: items.length },
          entityIds: items.map((r) => r.id),
        },
        suggestions,
      });
    }

    if (intent === "case_pending_summaries") {
      let sql = `
        SELECT cs.id, cs.case_id, cs.status, cs.created_at, c.case_uid, c.stage
        FROM case_summaries cs
        JOIN cases c ON c.id = cs.case_id
        WHERE cs.status = 'PENDING_REVIEW'
      `;
      const params = [];
      if (isDoctorRole(role)) {
        sql += " AND c.doctor_id = ? ";
        params.push(userId);
      } else if (isPatientRole(role)) {
        sql += " AND c.patient_id = ? ";
        params.push(userId);
      }
      sql += " ORDER BY cs.created_at DESC LIMIT 8";
      const [rows] = await pool.query(sql, params);
      const items = Array.isArray(rows) ? rows : [];
      return res.json({
        reply:
          items.length > 0
            ? `Found ${items.length} pending summary review item(s).`
            : "No pending summaries found right now.",
        cards: [
          {
            type: "cases_pending",
            title: "Pending summaries",
            rows: items,
          },
        ],
        meta: {
          intent,
          counts: { pendingSummaries: items.length },
          entityIds: items.map((r) => r.id),
        },
        suggestions: nextSuggestionsByIntent("case_pending_summaries", role),
      });
    }

    if (intent === "cases") {
      let sql = `
        SELECT c.id, c.case_uid, c.stage, c.updated_at, c.case_type,
               p.full_name AS patient_name, d.full_name AS doctor_name
        FROM cases c
        LEFT JOIN users p ON p.id = c.patient_id
        LEFT JOIN users d ON d.id = c.doctor_id
        WHERE 1=1
      `;
      const params = [];
      if (isDoctorRole(role)) {
        sql += " AND c.doctor_id = ? ";
        params.push(userId);
      } else if (isPatientRole(role)) {
        sql += " AND c.patient_id = ? ";
        params.push(userId);
      }
      sql += " ORDER BY c.updated_at DESC LIMIT 8";
      const [rows] = await pool.query(sql, params);
      const items = Array.isArray(rows) ? rows : [];
      const reply =
        items.length > 0
          ? `I found ${items.length} recent case(s) with current stages.`
          : "No cases found in your scope yet.";
      if (process.env.NODE_ENV !== "production") {
        console.log("ASSISTANT DEBUG", { ...headersMeta, count: items.length });
      }
      return res.json({
        reply,
        cards: [
          {
            type: "cases",
            title: "Case stages",
            rows: items,
          },
        ],
        meta: {
          intent,
          counts: { cases: items.length },
          entityIds: items.map((r) => r.id),
        },
        suggestions,
      });
    }

    if (intent === "inventory") {
      if (isPatientRole(role)) {
        return res.json({
          reply: "I can’t access clinic inventory from a patient account.",
          cards: [],
          suggestions,
          meta: { intent, counts: { items: 0 }, entityIds: [] },
        });
      }

      const [lowStockRows] = await pool.query(
        `
        SELECT id, item_code, name, stock, reorder_threshold, status, updated_at
        FROM inventory_items
        WHERE stock <= reorder_threshold
        ORDER BY (reorder_threshold - stock) DESC, updated_at DESC
        LIMIT 8
        `
      );
      let usageSql = `
        SELECT l.id, l.item_id, l.item_code, l.qty_used, l.created_at, i.name AS item_name
        FROM inventory_usage_logs l
        LEFT JOIN inventory_items i ON i.id = l.item_id
      `;
      const usageParams = [];
      if (isDoctorRole(role)) {
        usageSql += `
          LEFT JOIN appointments a ON a.id = l.appointment_id
          WHERE a.doctor_id = ?
        `;
        usageParams.push(userId);
      }
      usageSql += " ORDER BY l.created_at DESC LIMIT 8";
      const [usageRows] = await pool.query(usageSql, usageParams);
      const lowItems = Array.isArray(lowStockRows) ? lowStockRows : [];
      const usages = Array.isArray(usageRows) ? usageRows : [];
      const reply =
        lowItems.length > 0
          ? `There are ${lowItems.length} low-stock item(s). I also pulled recent usage logs.`
          : "No low-stock items right now. Recent usage is shown below.";
      if (process.env.NODE_ENV !== "production") {
        console.log("ASSISTANT DEBUG", {
          ...headersMeta,
          lowStockCount: lowItems.length,
          usageCount: usages.length,
        });
      }
      return res.json({
        reply,
        cards: [
          { type: "inventory", title: "Low stock", rows: lowItems },
          { type: "inventory_usage", title: "Recent usage", rows: usages },
        ],
        meta: {
          intent,
          counts: { lowStock: lowItems.length, usage: usages.length },
          entityIds: [...lowItems.map((r) => r.id), ...usages.map((r) => r.id)],
        },
        suggestions,
      });
    }

    if (intent === "revenue") {
      if (!isAdminRole(role) && !isPatientRole(role)) {
        return res.json({
          reply: "I can’t access clinic-wide revenue from this role.",
          cards: [],
          suggestions,
          meta: { intent, counts: { invoices: 0 }, entityIds: [] },
        });
      }

      let invoiceSql = `
        SELECT i.id, i.issue_date, i.amount, i.status, i.paid_date, u.full_name AS patient_name
        FROM invoices i
        LEFT JOIN users u ON u.id = i.patient_id
      `;
      const invParams = [];
      if (isPatientRole(role)) {
        invoiceSql += " WHERE i.patient_id = ? ";
        invParams.push(userId);
      }
      invoiceSql += " ORDER BY i.created_at DESC LIMIT 8";
      const [invoiceRows] = await pool.query(invoiceSql, invParams);
      const [summaryRows] = await pool.query(
        `
        SELECT 
          COUNT(*) AS total_count,
          SUM(CASE WHEN status <> 'Paid' THEN amount ELSE 0 END) AS outstanding_total
        FROM invoices
        ${isPatientRole(role) ? "WHERE patient_id = ?" : ""}
        `,
        isPatientRole(role) ? [userId] : []
      );
      const invoices = Array.isArray(invoiceRows) ? invoiceRows : [];
      const summary = Array.isArray(summaryRows) && summaryRows.length ? summaryRows[0] : { total_count: 0, outstanding_total: 0 };
      const reply =
        invoices.length > 0
          ? `Found ${invoices.length} invoice(s). Outstanding amount is ${Number(summary.outstanding_total || 0).toFixed(2)}.`
          : "No invoices found in your scope.";
      if (process.env.NODE_ENV !== "production") {
        console.log("ASSISTANT DEBUG", {
          ...headersMeta,
          invoiceCount: invoices.length,
          outstanding: Number(summary.outstanding_total || 0),
        });
      }
      return res.json({
        reply,
        cards: [
          {
            type: "revenue",
            title: "Revenue snapshot",
            rows: [
              {
                totalInvoices: Number(summary.total_count || 0),
                outstandingAmount: Number(summary.outstanding_total || 0),
              },
            ],
          },
          { type: "invoices", title: "Latest invoices", rows: invoices },
        ],
        meta: {
          intent,
          counts: { invoices: invoices.length },
          entityIds: invoices.map((r) => r.id),
        },
        suggestions,
      });
    }

    return res.json({
      reply:
        "I can help with appointments, case stages, inventory, and revenue reports. Try one of the quick actions.",
      cards: [],
      suggestions,
      meta: { intent: "fallback", counts: {}, entityIds: [] },
    });
  } catch (e) {
    console.error("ASSISTANT MESSAGE ERROR:", e);
    res.status(500).json({ message: "Assistant request failed" });
  }
});

// ===================================
// DEBUG ROUTE – see which routes exist (UNCHANGED)
// ===================================
app.get("/debug/routes", (req, res) => {
  const routes = [];

  app._router.stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      routes.push({ methods, path: layer.route.path });
    }
  });

  res.json({
    hasCaseSummary: routes.some((r) => r.path === "/api/admin/cases/tracking-summary" && r.methods.includes("GET")),
    routes,
  });
});

// ===================================
// PAYMENT GATEWAY ROUTES
// ===================================

// Get available payment gateways
app.get("/api/payments/gateways", authMiddleware, (req, res) => {
  res.json({
    gateways: Object.entries(paymentGateway.PAYMENT_GATEWAYS).map(([key, name]) => ({
      id: key,
      name,
      enabled: true
    }))
  });
});

// Generate payment link for invoice
app.post("/api/payments/generate-link", authMiddleware, async (req, res) => {
  try {
    const { invoiceId, amount, patientName, description } = req.body;
    
    if (!invoiceId || !amount) {
      return res.status(400).json({ message: "Invoice ID and amount are required" });
    }

    const paymentLink = paymentGateway.generatePaymentLink({
      invoiceId,
      amount: parseFloat(amount),
      patientName: patientName || "Patient",
      description
    });

    res.json(paymentLink);
  } catch (error) {
    console.error("Generate payment link error:", error);
    res.status(500).json({ message: "Failed to generate payment link" });
  }
});

// Process payment (simulate payment gateway callback)
app.post("/api/payments/process", authMiddleware, async (req, res) => {
  try {
    const { invoiceId, amount, gateway, patientId } = req.body;
    
    if (!invoiceId || !amount || !gateway) {
      return res.status(400).json({ message: "Invoice ID, amount, and gateway are required" });
    }

    // Process payment through fake gateway
    const paymentResult = await paymentGateway.processPayment({
      invoiceId,
      amount: parseFloat(amount),
      gateway,
      patientId
    });

    // If payment successful, update invoice status
    if (paymentResult.success) {
      await pool.query(
        "UPDATE invoices SET status = 'Paid', paid_date = CURDATE() WHERE id = ?",
        [invoiceId]
      );

      // Create payment record (if you have a payments table)
      try {
        await pool.query(`
          INSERT INTO payment_transactions 
          (invoice_id, patient_id, amount, gateway, transaction_id, status, payment_method, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          invoiceId,
          patientId,
          paymentResult.amount,
          paymentResult.gateway,
          paymentResult.transactionId,
          paymentResult.status,
          paymentResult.paymentMethod
        ]);
      } catch (tableError) {
        // Table might not exist, that's okay for demo
        console.log("Payment transactions table not found, skipping record creation");
      }
    }

    res.json(paymentResult);
  } catch (error) {
    console.error("Process payment error:", error);
    res.status(500).json({ message: "Payment processing failed" });
  }
});

// Get payment history for patient
app.get("/api/payments/history/:patientId", authMiddleware, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    
    // Get invoices with payment status
    const [invoices] = await pool.query(`
      SELECT 
        i.id,
        i.issue_date,
        i.amount,
        i.status,
        i.paid_date,
        a.appointment_code,
        a.type as appointment_type
      FROM invoices i
      LEFT JOIN appointments a ON i.appointment_id = a.id
      WHERE i.patient_id = ?
      ORDER BY i.issue_date DESC
      LIMIT 50
    `, [patientId]);

    res.json({ payments: invoices || [] });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
});

// ===================================
// START SERVER
// ===================================
const port = process.env.PORT || 4000;
// Railway/containers expect binding on 0.0.0.0 and a quick root response
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Auth + Admin + Doctor + Patient server running on http://0.0.0.0:${port}`);
});
