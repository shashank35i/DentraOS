# dental_agents/agents/inventory_agent.py
from __future__ import annotations

from datetime import datetime, timedelta, date, timezone
from typing import Any, Dict, Optional, List, Tuple
import os
import json

from .. import config as _config  # loads .env for INVENTORY_PO_AUTO and DB settings
from ..db import get_conn
from ..notifications import create_notification

# --- timezone safe (Windows-friendly) ---
try:
    from zoneinfo import ZoneInfo  # py3.9+
    try:
        IST = ZoneInfo("Asia/Kolkata")
    except Exception:
        IST = timezone(timedelta(hours=5, minutes=30), name="IST")
except Exception:
    IST = timezone(timedelta(hours=5, minutes=30), name="IST")


LOW_STOCK_DEFAULT_THRESHOLD = 5
EXPIRY_ALERT_DAYS = 30
ANOMALY_MULTIPLIER = 3
ANOMALY_MIN_QTY = 3


def _env_flag(name: str) -> bool:
    v = os.environ.get(name)
    if v is None:
        return False
    return str(v).strip().lower() in ("1", "true", "yes", "y", "on")

# Minimal safe defaults: only deduct if matching inventory items exist
DEFAULT_PROCEDURE_CONSUMABLES = [
    # procedure keywords, item keyword, qty
    (["new patient consultation", "consultation", "follow-up", "follow up", "routine checkup", "checkup", "check-up", "post-op review", "post op review"], [("gauze", 1)]),
    (["cleaning", "scaling"], [("scaler", 1), ("gauze", 1)]),
    (["emergency"], [("anesthetic", 1), ("gauze", 2)]),
    (["procedure visit"], [("gauze", 1)]),
    (["extraction"], [("suture", 1), ("gauze", 2), ("anesthetic", 1)]),
    (["root canal", "rct"], [("anesthetic", 1), ("gauze", 1)]),
    (["filling", "composite"], [("composite", 1), ("etchant", 1), ("bond", 1)]),
    (["implant"], [("implant", 1), ("suture", 1), ("anesthetic", 1)]),
]


# ----------------------------
# cursor / row helpers (dict-safe)
# ----------------------------
def _cursor(conn):
    """
    mysql-connector: conn.cursor(dictionary=True)
    pymysql (DictCursor set in db.get_conn): conn.cursor()
    """
    try:
        return conn.cursor(dictionary=True)  # mysql-connector
    except TypeError:
        return conn.cursor()  # pymysql
    except Exception:
        return conn.cursor()


def _row_to_dict(cur, row):
    if row is None:
        return None
    if isinstance(row, dict):
        return row

    cols = []
    if hasattr(cur, "column_names") and cur.column_names:
        cols = list(cur.column_names)
    elif getattr(cur, "description", None):
        cols = [d[0] for d in cur.description]
    if not cols:
        return {}
    return {cols[i]: row[i] for i in range(min(len(cols), len(row)))}


def _rows_to_dicts(cur, rows):
    if not rows:
        return []
    if isinstance(rows[0], dict):
        return rows
    return [_row_to_dict(cur, r) for r in rows]


def _today() -> date:
    return datetime.now(tz=IST).date()


def _table_exists(cur, name: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s
        LIMIT 1
        """,
        (name,),
    )
    return cur.fetchone() is not None


def _column_exists(cur, table: str, col: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s
        LIMIT 1
        """,
        (table, col),
    )
    return cur.fetchone() is not None


def _get_enum_values(cur, table: str, col: str) -> List[str]:
    """
    Reads enum('A','B',...) values from information_schema if column is ENUM.
    Returns [] if not enum or cannot parse.
    """
    try:
        cur.execute(
            """
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s
            LIMIT 1
            """,
            (table, col),
        )
        row = cur.fetchone()
        if not row:
            return []
        if isinstance(row, dict):
            ct = row.get("COLUMN_TYPE") or ""
        else:
            # single column
            ct = row[0] if len(row) else ""
        ct = str(ct or "")
        if not ct.lower().startswith("enum("):
            return []
        inside = ct[5:-1]  # strip enum( ... )
        # split by ',' but keep quoted strings
        vals: List[str] = []
        curv = ""
        inq = False
        for ch in inside:
            if ch == "'" and not inq:
                inq = True
                curv = ""
                continue
            if ch == "'" and inq:
                inq = False
                vals.append(curv)
                curv = ""
                continue
            if inq:
                curv += ch
        return vals
    except Exception:
        return []


def _normalize_user_role(conn, desired: str) -> str:
    """
    Normalize roles to your DB reality.
    Your schema often uses users.role ENUM('Admin','Doctor','Patient') (case-sensitive).
    We map 'ADMIN'->'Admin', 'DOCTOR'->'Doctor', 'PATIENT'->'Patient' if enum supports it.
    If not, we return desired as given.
    """
    desired_u = str(desired or "").strip()
    if not desired_u:
        return desired_u
    desired_upper = desired_u.upper()

    # default mapping
    mapped = {
        "ADMIN": "Admin",
        "DOCTOR": "Doctor",
        "PATIENT": "Patient",
    }.get(desired_upper, desired_u)

    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "users") or not _column_exists(cur, "users", "role"):
            return mapped
        enums = _get_enum_values(cur, "users", "role")
        if not enums:
            return mapped

        # find best case-insensitive match in enum list
        for e in enums:
            if str(e).upper() == mapped.upper():
                return e
        for e in enums:
            if str(e).upper() == desired_upper:
                return e
        return mapped
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _list_admin_user_ids(conn) -> List[int]:
    """
    Returns all user IDs with role Admin/ADMIN etc (case-safe).
    """
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "users") or not _column_exists(cur, "users", "role"):
            return []
        admin_role = _normalize_user_role(conn, "ADMIN")
        # also accept uppercase if stored that way
        cur.execute(
            "SELECT id FROM users WHERE role=%s OR UPPER(role)='ADMIN'",
            (admin_role,),
        )
        rows = _rows_to_dicts(cur, cur.fetchall() or [])
        out: List[int] = []
        for r in rows:
            try:
                out.append(int(r.get("id") or 0))
            except Exception:
                pass
        return [x for x in out if x > 0]
    finally:
        try:
            cur.close()
        except Exception:
            pass


# ----------------------------
# notifications (schema-aligned)
# ----------------------------
def _create_notification(
    conn,
    *,
    user_id: Optional[int],
    title: str,
    message: str,
    notif_type: str,
    related_table: Optional[str] = None,
    related_id: Optional[int] = None,
    scheduled_at: Optional[datetime] = None,
    meta: Optional[dict] = None,
    channel: str = "IN_APP",
    user_role: Optional[str] = None,
    status: str = "PENDING",  # NEW/PENDING/SENT/FAILED/READ supported in your schema
) -> None:
    """
    Inserts into notifications table.
    Safe if table doesn't exist.
    """
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "notifications"):
            return

        meta_payload = dict(meta or {})
        if related_table:
            meta_payload["related_table"] = related_table
        if related_id is not None:
            meta_payload["related_id"] = related_id

        sched = None
        if scheduled_at:
            sched = scheduled_at.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S")

        # normalize roles to your schema (Admin/Doctor/Patient)
        norm_role = _normalize_user_role(conn, user_role) if user_role else None

        cur.execute(
            """
            INSERT INTO notifications
              (user_id, user_role, channel, type, title, message, status, scheduled_at, meta_json, created_at)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                int(user_id) if user_id else None,
                norm_role,
                channel,
                notif_type,
                (title or "")[:200],
                message or "",
                (status or "PENDING").upper(),
                sched,
                json.dumps(meta_payload, ensure_ascii=False) if meta_payload else None,
            ),
        )
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _notify_admins(
    conn,
    *,
    title: str,
    message: str,
    notif_type: str,
    related_table: Optional[str] = None,
    related_id: Optional[int] = None,
    meta: Optional[dict] = None,
    status: str = "PENDING",
) -> None:
    """
    Workflow-aligned:
      - broadcast notification for Admin role (user_id NULL, user_role Admin)
      - also notify all Admin users in users table
      - keep legacy fallback user_id=1 so nothing breaks
    """
    # broadcast (admins see it via (user_id IS NULL AND user_role='Admin') query logic)
    _create_notification(
        conn,
        user_id=None,
        user_role="ADMIN",
        title=title,
        message=message,
        notif_type=notif_type,
        related_table=related_table,
        related_id=related_id,
        meta=meta,
        status=status,
    )

    # direct to admin users (if any)
    admin_ids = _list_admin_user_ids(conn)
    for aid in admin_ids:
        _create_notification(
            conn,
            user_id=aid,
            user_role="ADMIN",
            title=title,
            message=message,
            notif_type=notif_type,
            related_table=related_table,
            related_id=related_id,
            meta=meta,
            status=status,
        )

    # legacy fallback (preserve your existing behavior)
    _create_notification(
        conn,
        user_id=1,
        user_role="ADMIN",
        title=title,
        message=message,
        notif_type=notif_type,
        related_table=related_table,
        related_id=related_id,
        meta=meta,
        status=status,
    )


def _upsert_inventory_alert_if_table_exists(
    conn,
    *,
    item_id: int,
    alert_type: str,
    message: str,
    severity: int = 100,
    meta: Optional[dict] = None,
) -> None:
    """
    If inventory_alerts table exists, record an alert row.
    Does NOT require any fixed schema — inserts only if columns exist.
    """
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_alerts"):
            return

        cols: List[str] = []
        vals: List[Any] = []

        # common columns (best-effort)
        if _column_exists(cur, "inventory_alerts", "item_id"):
            cols.append("item_id")
            vals.append(int(item_id))
        if _column_exists(cur, "inventory_alerts", "alert_type"):
            cols.append("alert_type")
            vals.append(str(alert_type)[:64])
        if _column_exists(cur, "inventory_alerts", "type") and "alert_type" not in cols:
            cols.append("type")
            vals.append(str(alert_type)[:64])

        if _column_exists(cur, "inventory_alerts", "message"):
            cols.append("message")
            vals.append(message)
        if _column_exists(cur, "inventory_alerts", "severity"):
            cols.append("severity")
            vals.append(int(severity))

        if _column_exists(cur, "inventory_alerts", "meta_json"):
            cols.append("meta_json")
            vals.append(json.dumps(meta or {}, ensure_ascii=False) if meta else None)

        if _column_exists(cur, "inventory_alerts", "status"):
            cols.append("status")
            vals.append("OPEN")

        if _column_exists(cur, "inventory_alerts", "created_at"):
            cols.append("created_at")
            vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))

        if not cols:
            return

        cur.execute(
            f"INSERT INTO inventory_alerts ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
            tuple(vals),
        )
    except Exception:
        # never fail the agent
        pass
    finally:
        try:
            cur.close()
        except Exception:
            pass


# ----------------------------
# consumption source: visits + visit_consumables (+ procedure_consumables fallback)
# ----------------------------
def _get_visit_for_appointment(conn, appointment_id: int) -> Optional[Dict[str, Any]]:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "visits"):
            return None
        cur.execute(
            """
            SELECT id, appointment_id, patient_id, doctor_id
            FROM visits
            WHERE appointment_id=%s
            ORDER BY id DESC
            LIMIT 1
            """,
            (appointment_id,),
        )
        return _row_to_dict(cur, cur.fetchone())
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _consume_items_from_visit(conn, visit_id: int) -> List[Dict[str, Any]]:
    """
    Primary: visit_consumables(visit_id, item_code, qty_used)
    Returns: [{ item_code: str, qty: int }]
    """
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "visit_consumables"):
            return []

        item_col = None
        for c in ("item_code", "inventory_item_code", "inventory_item_id", "item_id"):
            if _column_exists(cur, "visit_consumables", c):
                item_col = c
                break
        if not item_col:
            return []

        qty_col = "qty_used" if _column_exists(cur, "visit_consumables", "qty_used") else (
            "qty" if _column_exists(cur, "visit_consumables", "qty") else (
                "quantity" if _column_exists(cur, "visit_consumables", "quantity") else "qty_used"
            )
        )
        item_is_id = item_col in ("inventory_item_id", "item_id")
        if item_is_id and _table_exists(cur, "inventory_items") and _column_exists(cur, "inventory_items", "item_code"):
            cur.execute(
                f"""
                SELECT ii.item_code AS item_code, vc.{qty_col} AS qty_used
                FROM visit_consumables vc
                JOIN inventory_items ii ON ii.id = vc.{item_col}
                WHERE vc.visit_id=%s
                """,
                (visit_id,),
            )
        else:
            cur.execute(
                f"SELECT {item_col} AS item_code, {qty_col} AS qty_used FROM visit_consumables WHERE visit_id=%s",
                (visit_id,),
            )
        rows = _rows_to_dicts(cur, cur.fetchall() or [])
        out: List[Dict[str, Any]] = []
        for r in rows:
            code = str(r.get("item_code") or "").strip()
            qty = r.get("qty_used")
            try:
                qty_i = int(float(qty or 0))
            except Exception:
                qty_i = 0
            if code and qty_i > 0:
                out.append({"item_code": code, "qty": qty_i})
        return out
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _consume_items_from_procedures_if_needed(conn, visit_id: int) -> List[Dict[str, Any]]:
    """
    Fallback consumption derived from:
      visit_procedures + procedure_consumables
    This matches the workflow where consumables are tied to procedures.
    Returns: [{ item_code, qty }]
    """
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "visit_procedures"):
            return []
        if not _table_exists(cur, "procedure_consumables"):
            return []

        # Columns vary; we handle common names:
        # visit_procedures: (id, visit_id, procedure_code/procedure_id)
        # procedure_consumables: (procedure_code/procedure_id, item_code, qty_used/qty)
        vp_proc_col = None
        for c in ("procedure_code", "procedure_id", "code"):
            if _column_exists(cur, "visit_procedures", c):
                vp_proc_col = c
                break
        pc_proc_col = None
        for c in ("procedure_code", "procedure_id", "procedure_type", "code"):
            if _column_exists(cur, "procedure_consumables", c):
                pc_proc_col = c
                break
        if not vp_proc_col or not pc_proc_col:
            return []

        pc_item_col = None
        for c in ("item_code", "inventory_item_code", "inventory_item_id", "item_id"):
            if _column_exists(cur, "procedure_consumables", c):
                pc_item_col = c
                break
        if not pc_item_col:
            return []

        qty_col = "qty_used" if _column_exists(cur, "procedure_consumables", "qty_used") else (
            "qty" if _column_exists(cur, "procedure_consumables", "qty") else None
        )
        if not qty_col:
            return []

        item_expr = f"pc.{pc_item_col}"
        item_join = ""
        if pc_item_col in ("inventory_item_id", "item_id") and _table_exists(cur, "inventory_items") and _column_exists(cur, "inventory_items", "item_code"):
            item_expr = "ii.item_code"
            item_join = f" LEFT JOIN inventory_items ii ON ii.id = pc.{pc_item_col}"

        cur.execute(
            f"""
            SELECT
              vp.{vp_proc_col} AS procedure_code,
              vp.id AS procedure_id,
              {item_expr} AS item_code,
              SUM(pc.{qty_col}) AS qty
            FROM visit_procedures vp
            JOIN procedure_consumables pc
              ON pc.{pc_proc_col} = vp.{vp_proc_col}
            {item_join}
            WHERE vp.visit_id=%s
            GROUP BY vp.{vp_proc_col}, vp.id, {item_expr}
            """,
            (visit_id,),
        )
        rows = _rows_to_dicts(cur, cur.fetchall() or [])
        out: List[Dict[str, Any]] = []
        for r in rows:
            code = str(r.get("item_code") or "").strip()
            try:
                qty_i = int(float(r.get("qty") or 0))
            except Exception:
                qty_i = 0
            if code and qty_i > 0:
                out.append(
                    {
                        "item_code": code,
                        "qty": qty_i,
                        "procedure_code": r.get("procedure_code"),
                        "procedure_id": r.get("procedure_id"),
                    }
                )
        return out
    except Exception:
        return []
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _get_inventory_stock_cols(cur) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Your schema uses:
      inventory_items.stock
      inventory_items.reorder_threshold
      inventory_items.expiry_date
    Keep safe fallbacks.
    """
    stock_col = None
    for c in ("stock", "quantity_on_hand", "current_stock", "qty_on_hand"):
        if _column_exists(cur, "inventory_items", c):
            stock_col = c
            break

    for c in ("low_stock_threshold", "reorder_threshold", "reorder_level"):
        if _column_exists(cur, "inventory_items", c):
            th_col = c
            break
    else:
        th_col = None
    exp_col = "expiry_date" if _column_exists(cur, "inventory_items", "expiry_date") else None
    return stock_col, th_col, exp_col


def _pick_usage_source(cur) -> str:
    if not _column_exists(cur, "inventory_usage_logs", "source"):
        return "AUTO"
    enums = _get_enum_values(cur, "inventory_usage_logs", "source")
    for v in enums:
        if v.upper() == "AUTO_DEDUCT":
            return v
    for v in enums:
        if v.upper() == "AUTO":
            return v
    return "AUTO"


def _find_item_code_by_keywords(conn, keywords: List[str]) -> Optional[str]:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_items"):
            return None
        if not _column_exists(cur, "inventory_items", "item_code"):
            return None

        has_name = _column_exists(cur, "inventory_items", "name")
        conds = []
        params: List[Any] = []
        for kw in keywords:
            k = str(kw or "").strip().lower()
            if not k:
                continue
            if has_name:
                conds.append("(LOWER(item_code) LIKE %s OR LOWER(name) LIKE %s)")
                params.extend([f"%{k}%", f"%{k}%"])
            else:
                conds.append("LOWER(item_code) LIKE %s")
                params.append(f"%{k}%")

        if not conds:
            return None

        cur.execute(
            f"""
            SELECT item_code
            FROM inventory_items
            WHERE {" OR ".join(conds)}
            ORDER BY item_code ASC
            LIMIT 1
            """,
            tuple(params),
        )
        row = _row_to_dict(cur, cur.fetchone())
        return row.get("item_code") if row else None
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _get_appointment_info(conn, appointment_id: int) -> Optional[Dict[str, Any]]:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "appointments"):
            return None

        cols = []
        for c in ("id", "doctor_id", "patient_id", "type", "reason", "appointment_type"):
            if _column_exists(cur, "appointments", c):
                cols.append(c)
        if not cols:
            return None

        cur.execute(
            f"SELECT {', '.join(cols)} FROM appointments WHERE id=%s LIMIT 1",
            (appointment_id,),
        )
        return _row_to_dict(cur, cur.fetchone())
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _consume_items_from_default_mapping(conn, visit_id: int) -> List[Dict[str, Any]]:
    """
    Final fallback: map procedure keywords to default consumables.
    Only deducts if matching inventory item_code exists.
    """
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "visit_procedures"):
            return []

        has_catalog = _table_exists(cur, "procedure_catalog") and _column_exists(cur, "procedure_catalog", "code")
        name_col = "name" if has_catalog and _column_exists(cur, "procedure_catalog", "name") else None

        if has_catalog and name_col:
            cur.execute(
                f"""
                SELECT vp.id AS procedure_id, vp.procedure_code AS procedure_code, pc.{name_col} AS procedure_name
                FROM visit_procedures vp
                LEFT JOIN procedure_catalog pc ON pc.code = vp.procedure_code
                WHERE vp.visit_id=%s
                """,
                (visit_id,),
            )
        else:
            cur.execute(
                """
                SELECT id AS procedure_id, procedure_code AS procedure_code, procedure_code AS procedure_name
                FROM visit_procedures
                WHERE visit_id=%s
                """,
                (visit_id,),
            )

        rows = _rows_to_dicts(cur, cur.fetchall() or [])
        totals: Dict[Tuple[str, Optional[str], Optional[int]], int] = {}

        for r in rows:
            proc_text = f"{r.get('procedure_code') or ''} {r.get('procedure_name') or ''}"
            defaults = _match_procedure_defaults(proc_text)
            if not defaults:
                continue
            for kw, qty in defaults:
                code = _find_item_code_by_keywords(conn, [kw])
                if not code:
                    continue
                key = (code, r.get("procedure_code"), r.get("procedure_id"))
                totals[key] = totals.get(key, 0) + int(qty)

        out: List[Dict[str, Any]] = []
        for (item_code, procedure_code, procedure_id), qty in totals.items():
            if qty > 0:
                out.append(
                    {
                        "item_code": item_code,
                        "qty": qty,
                        "procedure_code": procedure_code,
                        "procedure_id": procedure_id,
                    }
                )
        return out
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _consume_items_from_appointment_type(conn, appointment_id: int) -> List[Dict[str, Any]]:
    """
    Fallback: map appointment type/reason to default consumables.
    Only deducts if matching inventory item_code exists.
    Returns: [{ item_code, qty, procedure_code }]
    """
    info = _get_appointment_info(conn, appointment_id)
    if not info:
        return []

    appt_type = str(info.get("type") or info.get("appointment_type") or "").strip()
    appt_reason = str(info.get("reason") or "").strip()
    hay = f"{appt_type} {appt_reason}".lower().strip()
    if not hay:
        return []

    out: List[Dict[str, Any]] = []
    for proc_keywords, items in DEFAULT_PROCEDURE_CONSUMABLES:
        if not any(k in hay for k in proc_keywords):
            continue
        for (item_kw, qty) in items:
            code = _find_item_code_by_keywords(conn, [item_kw])
            if not code:
                continue
            out.append(
                {
                    "item_code": code,
                    "qty": int(qty),
                    "procedure_code": appt_type or appt_reason or None,
                }
            )

    return out


def _match_procedure_defaults(proc_text: str) -> List[Tuple[str, int]]:
    s = str(proc_text or "").lower()
    out: List[Tuple[str, int]] = []
    for keys, items in DEFAULT_PROCEDURE_CONSUMABLES:
        if any(k in s for k in keys):
            out.extend(items)
    return out


def _record_usage_daily(
    conn,
    *,
    usage_date: date,
    doctor_id: Optional[int],
    procedure_code: Optional[str],
    item_code: str,
    qty: int,
) -> None:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_usage_daily"):
            return

        cols = ["usage_date", "item_code", "qty_used"]
        vals: List[Any] = [usage_date.strftime("%Y-%m-%d"), item_code, int(qty)]

        if doctor_id and _column_exists(cur, "inventory_usage_daily", "doctor_id"):
            cols.append("doctor_id")
            vals.append(int(doctor_id))
        if procedure_code and _column_exists(cur, "inventory_usage_daily", "procedure_code"):
            cols.append("procedure_code")
            vals.append(str(procedure_code)[:64])

        if _column_exists(cur, "inventory_usage_daily", "updated_at"):
            cols.append("updated_at")
            vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))

        placeholders = ", ".join(["%s"] * len(cols))
        col_sql = ", ".join(cols)

        # upsert by unique key
        cur.execute(
            f"""
            INSERT INTO inventory_usage_daily ({col_sql})
            VALUES ({placeholders})
            ON DUPLICATE KEY UPDATE qty_used = qty_used + VALUES(qty_used)
            """,
            tuple(vals),
        )
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _check_usage_anomaly(
    conn,
    *,
    doctor_id: Optional[int],
    item_code: str,
    qty: int,
    procedure_code: Optional[str],
    appointment_id: int,
    visit_id: int,
) -> None:
    if qty < ANOMALY_MIN_QTY:
        return
    if not doctor_id:
        return

    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_usage_logs"):
            return
        if not _column_exists(cur, "inventory_usage_logs", "doctor_id"):
            return
        if not _column_exists(cur, "inventory_usage_logs", "item_code"):
            return

        cur.execute(
            """
            SELECT AVG(qty_used) AS avg_qty
            FROM inventory_usage_logs
            WHERE doctor_id=%s
              AND item_code=%s
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            """,
            (int(doctor_id), str(item_code)),
        )
        row = _row_to_dict(cur, cur.fetchone())
        avg_qty = float(row.get("avg_qty") or 0) if row else 0
        if avg_qty <= 0:
            return

        if qty > avg_qty * ANOMALY_MULTIPLIER:
            msg = (
                f"Usage anomaly: doctor {doctor_id} used {qty}x {item_code} "
                f"(avg {avg_qty:.2f} over 30d)."
            )
            create_notification(
                user_id=None,
                user_role="Admin",
                title="Inventory anomaly",
                message=msg,
                notif_type="INVENTORY_ANOMALY",
                related_table="inventory_usage_logs",
                related_id=None,
                status="PENDING",
                priority=200,
                dedupe_key=f"inventory_anomaly:{doctor_id}:{item_code}:{appointment_id}:{qty}",
                meta={
                    "doctor_id": doctor_id,
                    "item_code": item_code,
                    "qty": qty,
                    "avg_30d": avg_qty,
                    "procedure_code": procedure_code,
                    "appointment_id": appointment_id,
                    "visit_id": visit_id,
                },
                conn=conn,
            )

            if _table_exists(cur, "inventory_anomaly_logs"):
                cur.execute(
                    """
                    INSERT INTO inventory_anomaly_logs (doctor_id, item_code, qty, avg_30d, appointment_id, visit_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (int(doctor_id), item_code, int(qty), float(avg_qty), int(appointment_id), int(visit_id)),
                )
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _set_item_status(conn, item_id: int, status: str) -> None:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_items"):
            return
        if not _column_exists(cur, "inventory_items", "status"):
            return
        cur.execute("UPDATE inventory_items SET status=%s, updated_at=NOW() WHERE id=%s", (status, int(item_id)))
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _emit_low_stock_notification(
    conn,
    *,
    item_id: int,
    item_name: str,
    stock: int,
    threshold: int,
    doctor_id: Optional[int] = None,
) -> None:
    dedupe_key = f"low_stock:{int(item_id)}:{int(threshold)}"
    msg = f"{item_name} is low (stock {stock}, threshold {threshold})."
    meta = {"stock": stock, "threshold": threshold, "item_id": item_id}

    create_notification(
        user_id=None,
        user_role="Admin",
        title=f"Low stock: {item_name}",
        message=msg,
        notif_type="INVENTORY_LOW_STOCK",
        related_table="inventory_items",
        related_id=item_id,
        status="PENDING",
        priority=120,
        dedupe_key=dedupe_key,
        meta=meta,
        conn=conn,
    )

    if doctor_id:
        create_notification(
            user_id=int(doctor_id),
            title=f"Low stock: {item_name}",
            message=msg,
            notif_type="INVENTORY_LOW_STOCK",
            related_table="inventory_items",
            related_id=item_id,
            status="PENDING",
            priority=110,
            dedupe_key=f"{dedupe_key}:doctor:{int(doctor_id)}",
            meta=meta,
            conn=conn,
        )


def _emit_expiry_notification(
    conn,
    *,
    item_id: int,
    item_name: str,
    expiry: Optional[str],
    notif_type: str,
    title: str,
    message: str,
    dedupe_key: str,
) -> None:
    create_notification(
        user_id=None,
        user_role="Admin",
        title=title,
        message=message,
        notif_type=notif_type,
        related_table="inventory_items",
        related_id=item_id,
        status="PENDING",
        priority=130,
        dedupe_key=dedupe_key,
        meta={"item_id": item_id, "expiry": expiry},
        conn=conn,
    )


def _try_lock(conn, lock_key: str) -> bool:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "idempotency_locks"):
            return True
        if not _column_exists(cur, "idempotency_locks", "lock_key"):
            return True

        cols = ["lock_key"]
        vals = [lock_key[:190]]

        if _column_exists(cur, "idempotency_locks", "locked_by"):
            cols.append("locked_by")
            vals.append("inventory_agent")
        if _column_exists(cur, "idempotency_locks", "expires_at"):
            cols.append("expires_at")
            vals.append((datetime.now(tz=IST) + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S"))
        if _column_exists(cur, "idempotency_locks", "created_at"):
            cols.append("created_at")
            vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))

        cur.execute(
            f"INSERT INTO idempotency_locks ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
            tuple(vals),
        )
        return True
    except Exception as e:
        # Don't block PO drafts if the lock insert fails for any reason.
        try:
            print(f"[inventory_agent] lock insert failed for {lock_key}: {e}", flush=True)
        except Exception:
            pass
        return True
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _maybe_create_po_draft(
    conn,
    *,
    item_id: int,
    item_code: Optional[str],
    vendor_id: Optional[int],
    threshold: int,
) -> None:
    if not _env_flag("INVENTORY_PO_AUTO"):
        try:
            print(f"[inventory_agent] PO auto disabled (item_id={item_id})", flush=True)
        except Exception:
            pass
        return
    if not vendor_id or not item_code:
        try:
            print(
                f"[inventory_agent] PO skipped: vendor_id/item_code missing (item_id={item_id}, vendor_id={vendor_id}, item_code={item_code})",
                flush=True,
            )
        except Exception:
            pass
        return

    if not _try_lock(conn, f"po_draft:{item_id}:{threshold}"):
        return

    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "purchase_orders") or not _table_exists(cur, "purchase_order_items"):
            try:
                print(
                    f"[inventory_agent] PO skipped: tables missing (purchase_orders={_table_exists(cur, 'purchase_orders')}, purchase_order_items={_table_exists(cur, 'purchase_order_items')})",
                    flush=True,
                )
            except Exception:
                pass
            return

        cols = []
        vals = []

        if _column_exists(cur, "purchase_orders", "vendor_id"):
            cols.append("vendor_id")
            vals.append(int(vendor_id))
        if _column_exists(cur, "purchase_orders", "status"):
            enums = _get_enum_values(cur, "purchase_orders", "status")
            status_val = "DRAFT"
            for v in enums:
                if v.upper() in ("DRAFT", "REQUESTED"):
                    status_val = v
                    break
            cols.append("status")
            vals.append(status_val)
        if _column_exists(cur, "purchase_orders", "notes"):
            cols.append("notes")
            vals.append("Auto-draft from low stock")
        if _column_exists(cur, "purchase_orders", "created_at"):
            cols.append("created_at")
            vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))
        if _column_exists(cur, "purchase_orders", "updated_at"):
            cols.append("updated_at")
            vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))

        if not cols:
            try:
                print("[inventory_agent] PO skipped: no writable columns on purchase_orders", flush=True)
            except Exception:
                pass
            return

        cur.execute(
            f"INSERT INTO purchase_orders ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
            tuple(vals),
        )
        po_id = int(cur.lastrowid or 0)
        if po_id <= 0:
            try:
                print("[inventory_agent] PO skipped: insert returned no id", flush=True)
            except Exception:
                pass
            return

        item_cols = []
        item_vals = []
        if _column_exists(cur, "purchase_order_items", "purchase_order_id"):
            item_cols.append("purchase_order_id")
            item_vals.append(po_id)
        if _column_exists(cur, "purchase_order_items", "item_code"):
            item_cols.append("item_code")
            item_vals.append(item_code)
        if _column_exists(cur, "purchase_order_items", "qty"):
            item_cols.append("qty")
            item_vals.append(int(max(1, threshold * 2)))
        if _column_exists(cur, "purchase_order_items", "created_at"):
            item_cols.append("created_at")
            item_vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))

        if item_cols:
            cur.execute(
                f"INSERT INTO purchase_order_items ({', '.join(item_cols)}) VALUES ({', '.join(['%s'] * len(item_cols))})",
                tuple(item_vals),
            )
        else:
            try:
                print("[inventory_agent] PO item insert skipped: no compatible columns on purchase_order_items", flush=True)
            except Exception:
                pass

        vendor_email = None
        vendor_phone = None
        if _table_exists(cur, "vendors") and vendor_id:
            try:
                cur.execute("SELECT email, phone FROM vendors WHERE id=%s LIMIT 1", (int(vendor_id),))
                vr = _row_to_dict(cur, cur.fetchone())
                if vr:
                    vendor_email = vr.get("email")
                    vendor_phone = vr.get("phone")
            except Exception:
                pass

        create_notification(
            user_id=None,
            user_role="Admin",
            title="PO draft created",
            message=f"Auto-draft PO #{po_id} for {item_code} (vendor {vendor_id}).",
            notif_type="INVENTORY_PO_DRAFT",
            related_table="purchase_orders",
            related_id=int(po_id),
            status="PENDING",
            priority=120,
            dedupe_key=f"po_draft:{po_id}",
            meta={
                "item_code": item_code,
                "vendor_id": vendor_id,
                "vendor_email": vendor_email,
                "vendor_phone": vendor_phone,
            },
            conn=conn,
        )
        try:
            print(f"[inventory_agent] PO draft created id={po_id} item_code={item_code} vendor_id={vendor_id}", flush=True)
        except Exception:
            pass
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _already_consumed(conn, appointment_id: int) -> bool:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "appointment_audit_logs"):
            return False
        if not _column_exists(cur, "appointment_audit_logs", "appointment_id"):
            return False
        if not _column_exists(cur, "appointment_audit_logs", "action"):
            return False
        cur.execute(
            """
            SELECT 1
            FROM appointment_audit_logs
            WHERE appointment_id=%s AND action='INVENTORY_CONSUMED'
            LIMIT 1
            """,
            (appointment_id,),
        )
        return cur.fetchone() is not None
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _apply_consumption_by_code(
    conn,
    *,
    item_code: str,
    qty: int,
    visit_id: int,
    doctor_id: int,
    appointment_id: int,
    procedure_code: Optional[str] = None,
    procedure_id: Optional[int] = None,
) -> Tuple[int, int, Optional[int], Optional[str], Optional[str], Optional[int], bool]:
    """
    Decrement inventory_items stock by item_code.
    Returns (before, after, item_id, item_name).
    """
    if qty <= 0 or not item_code:
        return (0, 0, None, None, None, None, False)

    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_items"):
            return (0, 0, None, None, None, None, False)

        stock_col, _, _ = _get_inventory_stock_cols(cur)
        if not stock_col:
            return (0, 0, None, None, None, None, False)

        # lock row for safe decrement
        cur.execute(
            f"""
            SELECT id, item_code, name, {stock_col} AS stock
            {', expiry_date AS expiry' if _column_exists(cur, "inventory_items", "expiry_date") else ''}
            {', vendor_id AS vendor_id' if _column_exists(cur, "inventory_items", "vendor_id") else ''}
            FROM inventory_items
            WHERE item_code=%s
            FOR UPDATE
            """,
            (item_code,),
        )
        row = _row_to_dict(cur, cur.fetchone())
        if not row:
            return (0, 0, None, None, None, None, False)

        item_id = int(row.get("id") or 0)
        name = row.get("name") or item_code
        code = row.get("item_code") or item_code
        vendor_id = row.get("vendor_id")

        before = int(float(row.get("stock") or 0))
        after = before - int(qty)

        exp = row.get("expiry")
        if exp:
            try:
                exp_date = exp if isinstance(exp, date) else datetime.strptime(str(exp)[:10], "%Y-%m-%d").date()
                if exp_date < _today():
                    _emit_expiry_notification(
                        conn,
                        item_id=item_id,
                        item_name=name,
                        expiry=str(exp_date),
                        notif_type="INVENTORY_EXPIRED",
                        title=f"Expired item blocked: {name}",
                        message=f"Attempted to use expired item {name} (expired {exp_date}). Deduction blocked.",
                        dedupe_key=f"inventory_expired_blocked:{item_id}:{exp_date}",
                    )
                    return (before, before, item_id, name, code, vendor_id, True)
            except Exception:
                pass

        # your schema has updated_at
        has_updated_at = _column_exists(cur, "inventory_items", "updated_at")
        if has_updated_at:
            cur.execute(
                f"UPDATE inventory_items SET {stock_col}=%s, updated_at=NOW() WHERE id=%s",
                (after, item_id),
            )
        else:
            cur.execute(
                f"UPDATE inventory_items SET {stock_col}=%s WHERE id=%s",
                (after, item_id),
            )

        if after != before - int(qty):
            create_notification(
                user_id=None,
                user_role="Admin",
                title="Inventory mismatch",
                message=f"{name} stock mismatch: before {before}, after {after}, expected {before - int(qty)}.",
                notif_type="INVENTORY_ANOMALY",
                related_table="inventory_items",
                related_id=item_id,
                status="PENDING",
                priority=210,
                dedupe_key=f"inventory_mismatch:{item_id}:{appointment_id}:{visit_id}",
                meta={
                    "before": before,
                    "after": after,
                    "expected": before - int(qty),
                    "appointment_id": appointment_id,
                    "visit_id": visit_id,
                },
                conn=conn,
            )

            if _table_exists(cur, "inventory_anomaly_logs"):
                cur.execute(
                    """
                    INSERT INTO inventory_anomaly_logs (doctor_id, item_code, qty, avg_30d, appointment_id, visit_id, created_at, note)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s)
                    """,
                    (int(doctor_id), code, int(qty), None, int(appointment_id), int(visit_id), "stock_mismatch"),
                )

        # optional audit: inventory_usage_logs if present
        if _table_exists(cur, "inventory_usage_logs"):
            try:
                source_col_ok = _column_exists(cur, "inventory_usage_logs", "source")
                meta_col_ok = _column_exists(cur, "inventory_usage_logs", "meta_json")
                visit_col_ok = _column_exists(cur, "inventory_usage_logs", "visit_id")
                doctor_col_ok = _column_exists(cur, "inventory_usage_logs", "doctor_id")
                appt_col_ok = _column_exists(cur, "inventory_usage_logs", "appointment_id")
                item_code_ok = _column_exists(cur, "inventory_usage_logs", "item_code")
                item_id_ok = _column_exists(cur, "inventory_usage_logs", "item_id")
                qty_used_ok = _column_exists(cur, "inventory_usage_logs", "qty_used")
                qty_ok = _column_exists(cur, "inventory_usage_logs", "qty")
                used_at_ok = _column_exists(cur, "inventory_usage_logs", "used_at")
                created_at_ok = _column_exists(cur, "inventory_usage_logs", "created_at")
                reason_ok = _column_exists(cur, "inventory_usage_logs", "reason")

                cols = []
                vals = []

                if item_code_ok:
                    cols.append("item_code")
                    vals.append(item_code)
                elif item_id_ok:
                    cols.append("item_id")
                    vals.append(item_id)

                if qty_used_ok:
                    cols.append("qty_used")
                    vals.append(int(qty))
                elif qty_ok:
                    cols.append("qty")
                    vals.append(int(qty))

                if used_at_ok:
                    cols.append("used_at")
                    vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))
                elif created_at_ok:
                    cols.append("created_at")
                    vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))

                if reason_ok:
                    cols.append("reason")
                    vals.append("APPOINTMENT_COMPLETED")

                if appt_col_ok:
                    cols.append("appointment_id")
                    vals.append(int(appointment_id))
                if visit_col_ok and int(visit_id or 0) > 0:
                    cols.append("visit_id")
                    vals.append(int(visit_id))
                if doctor_col_ok:
                    cols.append("doctor_id")
                    vals.append(int(doctor_id) if doctor_id else None)
                if source_col_ok:
                    cols.append("source")
                    vals.append(_pick_usage_source(cur))
                if meta_col_ok:
                    cols.append("meta_json")
                    vals.append(
                        json.dumps(
                            {
                                "appointment_id": appointment_id,
                                "item_code": item_code,
                                "procedure_code": procedure_code,
                                "procedure_id": procedure_id,
                                "qty_before": before,
                                "qty_after": after,
                            },
                            ensure_ascii=False,
                        )
                    )

                if cols:
                    cur.execute(
                        f"INSERT INTO inventory_usage_logs ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
                        tuple(vals),
                    )
            except Exception:
                pass

        return (before, after, item_id, name, code, vendor_id, False)
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _mark_inventory_consumed(conn, appointment_id: int) -> None:
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "appointment_audit_logs"):
            return
        if not _column_exists(cur, "appointment_audit_logs", "appointment_id"):
            return
        if not _column_exists(cur, "appointment_audit_logs", "action"):
            return

        cols = ["appointment_id", "action"]
        vals = [int(appointment_id), "INVENTORY_CONSUMED"]

        if _column_exists(cur, "appointment_audit_logs", "created_at"):
            cols.append("created_at")
            vals.append(datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S"))
        if _column_exists(cur, "appointment_audit_logs", "meta_json"):
            cols.append("meta_json")
            vals.append(json.dumps({"source": "inventory_agent"}, ensure_ascii=False))

        cur.execute(
            f"INSERT INTO appointment_audit_logs ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
            tuple(vals),
        )
    finally:
        try:
            cur.close()
        except Exception:
            pass


def on_appointment_completed(conn, payload: Dict[str, Any]) -> None:
    """
    Triggered by event_type = AppointmentCompleted
    Payload: { appointmentId }
    Workflow:
      - find visit for appointment
      - read visit_consumables by item_code
      - (fallback) derive from visit_procedures + procedure_consumables
      - decrement inventory_items.stock
      - notify low stock + negative stock anomalies
      - (optional) write inventory_alerts record if table exists
    """
    appt_id = int(payload.get("appointmentId") or payload.get("appointment_id") or 0)
    if not appt_id:
        return
    if _already_consumed(conn, appt_id):
        return

    try:
        conn.start_transaction()
    except Exception:
        try:
            conn.begin()
        except Exception:
            pass

    appt_info = _get_appointment_info(conn, appt_id) or {}

    vr = _get_visit_for_appointment(conn, appt_id)
    visit_id = int(vr.get("id") or 0) if vr else 0
    patient_id = int(vr.get("patient_id") or 0) if vr else int(appt_info.get("patient_id") or 0)
    doctor_id = int(vr.get("doctor_id") or 0) if vr else int(appt_info.get("doctor_id") or 0)

    items: List[Dict[str, Any]] = []
    if visit_id > 0:
        items = _consume_items_from_visit(conn, visit_id)

    # ✅ Workflow fallback: derive consumables from procedures if visit_consumables empty
    if not items and visit_id > 0:
        items = _consume_items_from_procedures_if_needed(conn, visit_id)

    # ✅ Fallback: use appointment type/reason when visit/procedures are missing
    if not items:
        items = _consume_items_from_appointment_type(conn, appt_id)

    # Final fallback if visit exists but no procedures matched
    if not items and visit_id > 0:
        items = _consume_items_from_default_mapping(conn, visit_id)

    if not items:
        return

    touched: List[Tuple[int, int, int, str, str, Optional[int]]] = []  # (item_id, before, after, name, code, vendor_id)

    for it in items:
        code = str(it.get("item_code") or "").strip()
        qty = int(it.get("qty") or 0)
        procedure_code = it.get("procedure_code")
        procedure_id = it.get("procedure_id")
        before, after, item_id, name, code, vendor_id, blocked = _apply_consumption_by_code(
            conn,
            item_code=code,
            qty=qty,
            visit_id=visit_id,
            doctor_id=doctor_id,
            appointment_id=appt_id,
            procedure_code=procedure_code,
            procedure_id=procedure_id,
        )
        if item_id and name and not blocked:
            touched.append((item_id, before, after, name, code, vendor_id))

            _record_usage_daily(
                conn,
                usage_date=_today(),
                doctor_id=doctor_id,
                procedure_code=procedure_code,
                item_code=code,
                qty=qty,
            )

            _check_usage_anomaly(
                conn,
                doctor_id=doctor_id,
                item_code=code,
                qty=qty,
                procedure_code=procedure_code,
                appointment_id=appt_id,
                visit_id=visit_id,
            )

    if not touched:
        return

    _mark_inventory_consumed(conn, appt_id)

    # low-stock + anomalies
    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_items"):
            return

        stock_col, th_col, _ = _get_inventory_stock_cols(cur)
        if not stock_col:
            return

        for (item_id, before, after, name, code, vendor_id) in touched:
            cur.execute(
                f"""
                SELECT id, name, {stock_col} AS stock
                {', ' + th_col + ' AS th' if th_col else ''}
                {', item_code AS code' if _column_exists(cur, "inventory_items", "item_code") else ''}
                {', vendor_id AS vendor_id' if _column_exists(cur, "inventory_items", "vendor_id") else ''}
                FROM inventory_items
                WHERE id=%s
                """,
                (item_id,),
            )
            r = _row_to_dict(cur, cur.fetchone())
            if not r:
                continue

            stock = int(float(r.get("stock") or 0))
            th = int(float(r.get("th") or LOW_STOCK_DEFAULT_THRESHOLD)) if th_col else int(LOW_STOCK_DEFAULT_THRESHOLD)
            item_name = r.get("name") or name or f"Item #{item_id}"

            if stock <= th:
                _emit_low_stock_notification(
                    conn,
                    item_id=item_id,
                    item_name=item_name,
                    stock=stock,
                    threshold=th,
                    doctor_id=doctor_id or None,
                )
                _maybe_create_po_draft(
                    conn,
                    item_id=item_id,
                    item_code=r.get("code") or code,
                    vendor_id=r.get("vendor_id") or vendor_id,
                    threshold=th,
                )

                _upsert_inventory_alert_if_table_exists(
                    conn,
                    item_id=item_id,
                    alert_type="LOW_STOCK",
                    message=f"{item_name} low: stock {stock}, threshold {th}",
                    severity=200,
                    meta={"stock": stock, "threshold": th},
                )

            if stock < 0:
                _create_notification(
                    conn,
                    user_id=doctor_id or 1,
                    user_role="DOCTOR",
                    title="Inventory Anomaly",
                    message=f"{item_name} stock became negative ({stock}). Please reconcile.",
                    notif_type="INVENTORY_ANOMALY",
                    related_table="inventory_items",
                    related_id=item_id,
                    meta={"before": before, "after": stock, "appointment_id": appt_id, "visit_id": visit_id},
                    status="PENDING",
                )
                _notify_admins(
                    conn,
                    title="Inventory Anomaly",
                    message=f"{item_name} has negative stock ({stock}). Please reconcile.",
                    notif_type="INVENTORY_ANOMALY",
                    related_table="inventory_items",
                    related_id=item_id,
                    meta={"before": before, "after": stock, "appointment_id": appt_id, "visit_id": visit_id},
                    status="PENDING",
                )
                _upsert_inventory_alert_if_table_exists(
                    conn,
                    item_id=item_id,
                    alert_type="ANOMALY",
                    message=f"{item_name} negative stock: {stock}",
                    severity=300,
                    meta={"before": before, "after": stock},
                )
    finally:
        try:
            cur.close()
        except Exception:
            pass


def daily_inventory_checks(conn, *, horizon_days: int = EXPIRY_ALERT_DAYS) -> None:
    """
    Daily checks (workflow-aligned):
      - low stock alerts
      - expiring soon within horizon_days
      - expired alerts (expiry < today)
      - negative stock anomalies
      - purchase draft suggestion (notification meta)
      - optional record into inventory_alerts if table exists
    """
    horizon_days = int(horizon_days or EXPIRY_ALERT_DAYS)

    cur = _cursor(conn)
    try:
        if not _table_exists(cur, "inventory_items"):
            return

        stock_col, th_col, exp_col = _get_inventory_stock_cols(cur)
        if not stock_col:
            return

        # low stock rows
        if th_col:
            cur.execute(
                f"""
                SELECT id, item_code, name, {stock_col} AS stock,
                       COALESCE({th_col}, %s) AS th
                       {', vendor_id AS vendor_id' if _column_exists(cur, "inventory_items", "vendor_id") else ''}
                FROM inventory_items
                WHERE {stock_col} <= COALESCE({th_col}, %s)
                ORDER BY {stock_col} ASC
                LIMIT 200
                """,
                (LOW_STOCK_DEFAULT_THRESHOLD, LOW_STOCK_DEFAULT_THRESHOLD),
            )
        else:
            cur.execute(
                f"""
                SELECT id, item_code, name, {stock_col} AS stock,
                       %s AS th
                       {', vendor_id AS vendor_id' if _column_exists(cur, "inventory_items", "vendor_id") else ''}
                FROM inventory_items
                WHERE {stock_col} <= %s
                ORDER BY {stock_col} ASC
                LIMIT 200
                """,
                (LOW_STOCK_DEFAULT_THRESHOLD, LOW_STOCK_DEFAULT_THRESHOLD),
            )
        low_rows = _rows_to_dicts(cur, cur.fetchall() or [])

        # expiring & expired rows
        expiring_rows: List[dict] = []
        expired_rows: List[dict] = []
        if exp_col:
            cutoff = _today() + timedelta(days=horizon_days)
            today = _today()

            # expiring soon (includes today..cutoff)
            cur.execute(
                f"""
                SELECT id, item_code, name, {exp_col} AS expiry
                FROM inventory_items
                WHERE {exp_col} IS NOT NULL AND {exp_col} >= %s AND {exp_col} <= %s
                ORDER BY {exp_col} ASC
                LIMIT 200
                """,
                (today, cutoff),
            )
            expiring_rows = _rows_to_dicts(cur, cur.fetchall() or [])

            # expired (expiry < today)
            cur.execute(
                f"""
                SELECT id, item_code, name, {exp_col} AS expiry
                FROM inventory_items
                WHERE {exp_col} IS NOT NULL AND {exp_col} < %s
                ORDER BY {exp_col} ASC
                LIMIT 200
                """,
                (today,),
            )
            expired_rows = _rows_to_dicts(cur, cur.fetchall() or [])

        # negative stock
        cur.execute(
            f"""
            SELECT id, item_code, name, {stock_col} AS stock
            FROM inventory_items
            WHERE {stock_col} < 0
            ORDER BY {stock_col} ASC
            LIMIT 50
            """
        )
        neg_rows = _rows_to_dicts(cur, cur.fetchall() or [])
    finally:
        try:
            cur.close()
        except Exception:
            pass

    # Admin notifications (broadcast)
    for r in low_rows:
        stock = int(float(r.get("stock") or 0))
        th = int(float(r.get("th") or LOW_STOCK_DEFAULT_THRESHOLD))
        name = r.get("name") or r.get("item_code") or f"Item #{r.get('id')}"
        item_id = int(r.get("id") or 0)

        _emit_low_stock_notification(
            conn,
            item_id=item_id,
            item_name=name,
            stock=stock,
            threshold=th,
        )
        _maybe_create_po_draft(
            conn,
            item_id=item_id,
            item_code=r.get("item_code"),
            vendor_id=r.get("vendor_id"),
            threshold=th,
        )
        _upsert_inventory_alert_if_table_exists(
            conn,
            item_id=item_id,
            alert_type="LOW_STOCK",
            message=f"{name} low: stock {stock}, threshold {th}",
            severity=200,
            meta={"stock": stock, "threshold": th, "item_code": r.get("item_code")},
        )

    for r in expiring_rows:
        name = r.get("name") or r.get("item_code") or f"Item #{r.get('id')}"
        item_id = int(r.get("id") or 0)
        exp = r.get("expiry")

        _set_item_status(conn, item_id, "Expiring soon")

        _emit_expiry_notification(
            conn,
            item_id=item_id,
            item_name=name,
            expiry=str(exp),
            notif_type="INVENTORY_EXPIRING_SOON",
            title=f"Expiring soon: {name}",
            message=f"{name} is expiring on {exp}.",
            dedupe_key=f"inventory_expiring:{item_id}:{str(exp)}",
        )
        _upsert_inventory_alert_if_table_exists(
            conn,
            item_id=item_id,
            alert_type="EXPIRING",
            message=f"{name} expiring on {exp}",
            severity=150,
            meta={"expiry": str(exp), "item_code": r.get("item_code")},
        )

    for r in expired_rows:
        name = r.get("name") or r.get("item_code") or f"Item #{r.get('id')}"
        item_id = int(r.get("id") or 0)
        exp = r.get("expiry")

        _set_item_status(conn, item_id, "Expired")

        _emit_expiry_notification(
            conn,
            item_id=item_id,
            item_name=name,
            expiry=str(exp),
            notif_type="INVENTORY_EXPIRED",
            title=f"Expired: {name}",
            message=f"{name} expired on {exp}. Please remove or reconcile stock.",
            dedupe_key=f"inventory_expired:{item_id}:{str(exp)}",
        )
        _upsert_inventory_alert_if_table_exists(
            conn,
            item_id=item_id,
            alert_type="EXPIRED",
            message=f"{name} expired on {exp}",
            severity=250,
            meta={"expiry": str(exp), "item_code": r.get("item_code")},
        )

    for r in neg_rows:
        stock = int(float(r.get("stock") or 0))
        name = r.get("name") or r.get("item_code") or f"Item #{r.get('id')}"
        item_id = int(r.get("id") or 0)

        _notify_admins(
            conn,
            title="Inventory Anomaly",
            message=f"{name} has negative stock ({stock}). Please reconcile.",
            notif_type="INVENTORY_ANOMALY",
            related_table="inventory_items",
            related_id=item_id,
            meta={"stock": stock, "item_code": r.get("item_code")},
            status="PENDING",
        )
        _upsert_inventory_alert_if_table_exists(
            conn,
            item_id=item_id,
            alert_type="ANOMALY",
            message=f"{name} negative stock: {stock}",
            severity=300,
            meta={"stock": stock, "item_code": r.get("item_code")},
        )

    # manual edit spike detection (last 24h)
    cur = _cursor(conn)
    try:
        if _table_exists(cur, "inventory_usage_logs") and _column_exists(cur, "inventory_usage_logs", "source"):
            cur.execute(
                """
                SELECT item_code, COUNT(*) AS cnt
                FROM inventory_usage_logs
                WHERE source IN ('MANUAL','ADJUSTMENT')
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                GROUP BY item_code
                HAVING cnt >= 3
                """,
            )
            rows = _rows_to_dicts(cur, cur.fetchall() or [])
            for r in rows:
                code = r.get("item_code") or "unknown"
                cnt = int(r.get("cnt") or 0)
                create_notification(
                    user_id=None,
                    user_role="Admin",
                    title="Manual stock edits detected",
                    message=f"{code} has {cnt} manual adjustments in the last 24h.",
                    notif_type="INVENTORY_ANOMALY",
                    related_table="inventory_usage_logs",
                    related_id=None,
                    status="PENDING",
                    priority=190,
                    dedupe_key=f"manual_edits:{code}:{_today()}",
                    meta={"item_code": code, "count": cnt},
                    conn=conn,
                )
    finally:
        try:
            cur.close()
        except Exception:
            pass

    # purchase order drafts (optional, guarded)
    for r in low_rows[:20]:
        item_id = int(r.get("id") or 0)
        item_code = r.get("item_code")
        th = int(float(r.get("th") or LOW_STOCK_DEFAULT_THRESHOLD))
        vendor_id = r.get("vendor_id") if r.get("vendor_id") is not None else None
        _maybe_create_po_draft(
            conn,
            item_id=item_id,
            item_code=item_code,
            vendor_id=vendor_id,
            threshold=th,
        )


# ----------------------------
# Worker-facing wrapper
# ----------------------------
class InventoryAgent:
    def handle(self, conn, event_type: str, event_id: int, payload: Dict[str, Any]) -> None:
        if event_type == "AppointmentCompleted":
            on_appointment_completed(conn, payload or {})
            try:
                conn.commit()
            except Exception:
                pass
            return

        if event_type == "VisitConsumablesUpdated":
            # Treat consumables update as a signal to record usage if not yet consumed.
            on_appointment_completed(conn, payload or {})
            try:
                conn.commit()
            except Exception:
                pass
            return

        if event_type in ("InventoryDailyTick", "InventoryDailyCheck", "InventoryMonitorTick", "DailyInventoryChecks"):
            horizon = int((payload or {}).get("horizon_days") or EXPIRY_ALERT_DAYS)
            daily_inventory_checks(conn, horizon_days=horizon)
            try:
                conn.commit()
            except Exception:
                pass
            return

        if event_type == "InventoryRulesUpdated":
            # Re-run checks after rule changes.
            daily_inventory_checks(conn, horizon_days=EXPIRY_ALERT_DAYS)
            try:
                conn.commit()
            except Exception:
                pass
            return

        return
