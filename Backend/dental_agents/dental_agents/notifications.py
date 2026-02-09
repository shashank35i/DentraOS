from __future__ import annotations

from typing import Any, Dict, Optional
import json
import logging
from datetime import datetime, timedelta, date
from decimal import Decimal

from .db import get_conn

log = logging.getLogger(__name__)

# Keep compatibility across schema versions:
# Your DB shows notifications.status includes NEW too, but Node commonly uses PENDING/SENT/FAILED/READ.
_ALLOWED_STATUS = {"NEW", "PENDING", "SENT", "FAILED", "READ"}
_ALLOWED_CHANNEL = {"IN_APP", "EMAIL", "SMS", "WHATSAPP", "CALL"}


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8", errors="replace")
        except Exception:
            return str(obj)
    if isinstance(obj, set):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    return obj


def _json_dumps_safe(payload: Dict[str, Any]) -> str:
    safe_payload = _json_safe(payload)
    return json.dumps(safe_payload, ensure_ascii=False, default=str)


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


def _get_enum_values(cur, table: str, col: str) -> list[str]:
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
        coltype = row["COLUMN_TYPE"] if isinstance(row, dict) else row[0]
        if not coltype or "enum(" not in str(coltype).lower():
            return []
        inside = str(coltype)[str(coltype).find("(") + 1 : str(coltype).rfind(")")]
        vals = []
        for part in inside.split(","):
            p = part.strip().strip("'").strip('"')
            if p:
                vals.append(p)
        return vals
    except Exception:
        return []


def _pick_status_value(enum_vals: list[str], desired: str) -> str:
    if not enum_vals:
        return desired
    upper = desired.upper()
    for v in enum_vals:
        if v.upper() == upper:
            return v
    for fallback in ("PENDING", "NEW"):
        for v in enum_vals:
            if v.upper() == fallback:
                return v
    return enum_vals[0]


def _insert_idempotency_lock(cur, key: str, ttl_hours: int = 24) -> bool:
    if not _table_exists(cur, "idempotency_locks"):
        return True

    cols: list[str] = []
    vals: list[Any] = []

    def add(col: str, value: Any) -> None:
        cols.append(col)
        vals.append(value)

    if _column_exists(cur, "idempotency_locks", "lock_key"):
        add("lock_key", key[:190])
    else:
        return True

    if _column_exists(cur, "idempotency_locks", "locked_by"):
        add("locked_by", "notifications")
    if _column_exists(cur, "idempotency_locks", "expires_at"):
        exp = datetime.now() + timedelta(hours=int(ttl_hours or 24))
        add("expires_at", exp.strftime("%Y-%m-%d %H:%M:%S"))
    if _column_exists(cur, "idempotency_locks", "created_at"):
        add("created_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    placeholders = ", ".join(["%s"] * len(cols))
    col_sql = ", ".join([f"`{c}`" for c in cols])
    try:
        cur.execute(
            f"INSERT INTO idempotency_locks ({col_sql}) VALUES ({placeholders})",
            tuple(vals),
        )
        return True
    except Exception:
        return False


def create_notification(
    *,
    user_id: Optional[int] = None,  # ✅ allow NULL for role-broadcast notifications
    user_role: Optional[str] = None,
    title: str,
    message: str,
    notif_type: str = "INFO",
    related_table: Optional[str] = None,
    related_id: Optional[int] = None,
    channel: str = "IN_APP",
    status: str = "PENDING",
    meta: Optional[Dict[str, Any]] = None,
    scheduled_at: Optional[datetime] = None,
    dedupe_key: Optional[str] = None,
    priority: Optional[int] = None,
    conn=None,
) -> None:
    """
    Insert a notification row (schema-adaptive).

    ✅ Supports:
    - direct user notification (user_id)
    - role broadcast (user_id NULL + user_role set)
    - schema versions with either:
        (related_table, related_id) OR (related_entity_type, related_entity_id)
    - dedupe_key via idempotency_locks if table exists
    """
    if (not user_id or int(user_id) <= 0) and not user_role:
        # nothing to target
        return

    # Normalize channel/status
    ch = (channel or "IN_APP").strip().upper()
    if ch not in _ALLOWED_CHANNEL:
        ch = "IN_APP"

    st = (status or "PENDING").strip().upper()
    if st not in _ALLOWED_STATUS:
        st = "PENDING"
    # For in-app notifications, mark as SENT immediately (no external delivery step)
    if ch == "IN_APP" and st in ("PENDING", "NEW"):
        st = "SENT"

    owns_conn = conn is None
    if owns_conn:
        conn = get_conn()

    try:
        with conn.cursor() as cur:
            if not _table_exists(cur, "notifications"):
                return

            # Optional idempotency guard
            if dedupe_key:
                ok = _insert_idempotency_lock(cur, dedupe_key, ttl_hours=24)
                if not ok:
                    return

            cols: list[str] = []
            vals: list[Any] = []

            def add(col: str, value: Any) -> None:
                cols.append(col)
                vals.append(value)

            # Targets
            if user_id and int(user_id) > 0 and _column_exists(cur, "notifications", "user_id"):
                add("user_id", int(user_id))

            if user_role and _column_exists(cur, "notifications", "user_role"):
                add("user_role", str(user_role)[:30])

            # Core fields
            if _column_exists(cur, "notifications", "channel"):
                add("channel", ch)

            if _column_exists(cur, "notifications", "status"):
                enum_vals = _get_enum_values(cur, "notifications", "status")
                add("status", _pick_status_value(enum_vals, st))

            if _column_exists(cur, "notifications", "title"):
                add("title", (title or "")[:200])

            if _column_exists(cur, "notifications", "message"):
                add("message", (message or "")[:5000])

            if _column_exists(cur, "notifications", "type"):
                add("type", (notif_type or "INFO")[:64])

            if priority is not None and _column_exists(cur, "notifications", "priority"):
                add("priority", int(priority))

            # Related entity (support both schema styles)
            if related_table:
                if _column_exists(cur, "notifications", "related_entity_type"):
                    add("related_entity_type", str(related_table)[:40])
                elif _column_exists(cur, "notifications", "related_table"):
                    add("related_table", str(related_table)[:80])

            if related_id:
                if _column_exists(cur, "notifications", "related_entity_id"):
                    add("related_entity_id", int(related_id))
                elif _column_exists(cur, "notifications", "related_id"):
                    add("related_id", int(related_id))

            # meta_json
            meta_payload = dict(meta or {})
            meta_payload.setdefault("notif_type", notif_type)
            if related_table:
                meta_payload.setdefault("related_table", related_table)
            if related_id:
                meta_payload.setdefault("related_id", related_id)

            # scheduled_at handling
            if scheduled_at:
                if _column_exists(cur, "notifications", "scheduled_at"):
                    add("scheduled_at", scheduled_at.strftime("%Y-%m-%d %H:%M:%S"))
                else:
                    meta_payload["scheduled_at"] = scheduled_at.isoformat()

            safe_meta = _json_safe(meta_payload)
            if _column_exists(cur, "notifications", "meta_json"):
                add("meta_json", _json_dumps_safe(safe_meta))
            elif _column_exists(cur, "notifications", "meta"):
                add("meta", _json_dumps_safe(safe_meta))

            # timestamps
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            if _column_exists(cur, "notifications", "created_at"):
                add("created_at", now_str)
            if _column_exists(cur, "notifications", "updated_at"):
                add("updated_at", now_str)

            if not cols:
                return

            placeholders = ", ".join(["%s"] * len(cols))
            col_sql = ", ".join([f"`{c}`" for c in cols])

            try:
                cur.execute(
                    f"INSERT INTO notifications ({col_sql}) VALUES ({placeholders})",
                    tuple(vals),
                )
            except Exception as e:
                log.exception("create_notification INSERT failed: %s", e)
                raise

        if owns_conn:
            conn.commit()
    finally:
        if owns_conn:
            try:
                conn.close()
            except Exception:
                pass
