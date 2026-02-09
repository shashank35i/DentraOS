# dental_agents/db.py
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import mysql.connector
from mysql.connector import Error as MySQLError


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.environ.get(name)
    if v is None or str(v).strip() == "":
        return default
    return v


def _int_env(name: str, default: int) -> int:
    v = _env(name)
    try:
        return int(v) if v is not None else default
    except Exception:
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    v = _env(name)
    if v is None:
        return default
    s = str(v).strip().lower()
    return s in ("1", "true", "yes", "y", "on")


@dataclass
class DbConfig:
    host: str
    port: int
    user: str
    password: str
    database: str

    connect_timeout: int = 10
    autocommit: bool = False


def get_db_config() -> DbConfig:
    # Defaults are safe for local XAMPP/MariaDB
    return DbConfig(
        host=_env("DB_HOST", "127.0.0.1"),
        port=_int_env("DB_PORT", 3306),
        user=_env("DB_USER", "root") or "root",
        password=_env("DB_PASSWORD", "") or "",
        database=_env("DB_NAME", "dental_clinic") or "dental_clinic",
        connect_timeout=_int_env("DB_CONNECT_TIMEOUT", 10),
        autocommit=_bool_env("DB_AUTOCOMMIT", False),
    )


class _ConnWrapper:
    """
    Wrap mysql-connector connection to ensure:
    - conn.cursor() defaults to dictionary=True
    - existing code using "with conn.cursor() as cur" gets dict rows
    """
    def __init__(self, conn):
        self._conn = conn

    def __getattr__(self, item):
        return getattr(self._conn, item)

    def cursor(self, *args, **kwargs):
        if "dictionary" not in kwargs:
            kwargs["dictionary"] = True
        # buffered avoids "Unread result" surprises in some flows
        if "buffered" not in kwargs:
            kwargs["buffered"] = True
        return self._conn.cursor(*args, **kwargs)


def get_conn():
    cfg = get_db_config()
    conn = mysql.connector.connect(
        host=cfg.host,
        port=cfg.port,
        user=cfg.user,
        password=cfg.password,
        database=cfg.database,
        connection_timeout=cfg.connect_timeout,
        autocommit=cfg.autocommit,
    )
    return _ConnWrapper(conn)


def safe_rollback(conn) -> None:
    try:
        if getattr(conn, "in_transaction", False):
            conn.rollback()
    except Exception:
        pass


def safe_commit(conn) -> None:
    try:
        conn.commit()
    except Exception:
        pass


def _table_exists(cur, name: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s
        LIMIT 1
        """,
        (name,),
    )
    return cur.fetchone() is not None


def _column_exists(cur, table: str, col: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s
        LIMIT 1
        """,
        (table, col),
    )
    return cur.fetchone() is not None


def _get_column_type(cur, table: str, col: str) -> Optional[str]:
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
        return None
    if isinstance(row, dict):
        return row.get("COLUMN_TYPE")
    return row[0]


def _parse_enum_vals(coltype: Optional[str]) -> List[str]:
    if not coltype:
        return []
    s = str(coltype)
    if "enum(" not in s.lower():
        return []
    inside = s[s.find("(") + 1 : s.rfind(")")]
    vals: List[str] = []
    for part in inside.split(","):
        p = part.strip().strip("'").strip('"')
        if p:
            vals.append(p)
    return vals


def _pick_from_enum(enum_vals: List[str], desired: str) -> Optional[str]:
    if not desired:
        return None
    if not enum_vals:
        return desired
    want = desired.strip().lower().replace("_", " ")
    for v in enum_vals:
        vv = v.strip().lower().replace("_", " ")
        if vv == want:
            return v
    want2 = want.replace(" ", "")
    for v in enum_vals:
        vv2 = v.strip().lower().replace("_", " ").replace(" ", "")
        if vv2 == want2:
            return v
    return None


def _insert_idempotency_lock(cur, key: str, ttl_hours: int = 24, locked_by: str = "worker") -> bool:
    if not _table_exists(cur, "idempotency_locks"):
        return True
    if not _column_exists(cur, "idempotency_locks", "lock_key"):
        return True

    cols: List[str] = ["lock_key"]
    vals: List[Any] = [key[:190]]

    if _column_exists(cur, "idempotency_locks", "locked_by"):
        cols.append("locked_by")
        vals.append(locked_by)
    if _column_exists(cur, "idempotency_locks", "expires_at"):
        exp = datetime.now() + timedelta(hours=int(ttl_hours or 24))
        cols.append("expires_at")
        vals.append(exp.strftime("%Y-%m-%d %H:%M:%S"))
    if _column_exists(cur, "idempotency_locks", "created_at"):
        cols.append("created_at")
        vals.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

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


def _event_status_values(cur) -> List[str]:
    ct = _get_column_type(cur, "agent_events", "status")
    return _parse_enum_vals(ct)


def _event_status_pending(cur) -> str:
    vals = _event_status_values(cur)
    # Your schema uses NEW; older branches might use PENDING
    if "NEW" in vals:
        return "NEW"
    if "PENDING" in vals:
        return "PENDING"
    # fallback if not enum
    return "NEW"


def _event_status_processing(cur) -> str:
    vals = _event_status_values(cur)
    if "PROCESSING" in vals:
        return "PROCESSING"
    return "PROCESSING"


def _event_status_done(cur) -> str:
    vals = _event_status_values(cur)
    if "DONE" in vals:
        return "DONE"
    return "DONE"


def _event_status_failed(cur) -> str:
    vals = _event_status_values(cur)
    if "FAILED" in vals:
        return "FAILED"
    return "FAILED"


def _event_status_dead(cur) -> Optional[str]:
    vals = _event_status_values(cur)
    return "DEAD" if "DEAD" in vals else None


def _json_load_maybe(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    s = str(v).strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None


def count_pending_events(conn, now_sql: str = "NOW()") -> int:
    try:
        with conn.cursor() as cur:
            if not _table_exists(cur, "agent_events"):
                return 0
            pending = _event_status_pending(cur)
            # include PENDING if present, for mixed DBs
            vals = _event_status_values(cur)
            pending_states = [pending]
            if "PENDING" in vals and "PENDING" not in pending_states:
                pending_states.append("PENDING")

            where = f"status IN ({','.join(['%s'] * len(pending_states))})"
            params: List[Any] = list(pending_states)

            if _column_exists(cur, "agent_events", "available_at"):
                where += f" AND (available_at IS NULL OR available_at <= {now_sql})"
            if _column_exists(cur, "agent_events", "locked_until"):
                where += f" AND (locked_until IS NULL OR locked_until <= {now_sql})"
            elif _column_exists(cur, "agent_events", "locked_at"):
                # fallback: treat locked_at older than now as unlockable
                where += f" AND (locked_at IS NULL OR locked_at <= {now_sql})"

            cur.execute(f"SELECT COUNT(*) AS c FROM agent_events WHERE {where}", tuple(params))
            row = cur.fetchone()
            if not row:
                return 0
            return int(row.get("c") if isinstance(row, dict) else row[0])
    except Exception:
        return 0


def claim_next_event(
    conn,
    worker_id: str,
    lock_seconds: int = 60,
) -> Optional[Dict[str, Any]]:
    """
    Claims one event (status NEW/PENDING) safely in a fresh transaction.
    Fixes: Transaction already in progress -> rollback before starting.
    """
    safe_rollback(conn)

    with conn.cursor() as cur:
        if not _table_exists(cur, "agent_events"):
            return None

        pending = _event_status_pending(cur)
        processing = _event_status_processing(cur)

        vals = _event_status_values(cur)
        pending_states = [pending]
        if "PENDING" in vals and "PENDING" not in pending_states:
            pending_states.append("PENDING")

        # optional columns
        has_available = _column_exists(cur, "agent_events", "available_at")
        has_locked_until = _column_exists(cur, "agent_events", "locked_until")
        has_locked_by = _column_exists(cur, "agent_events", "locked_by")
        has_priority = _column_exists(cur, "agent_events", "priority")
        has_attempts = _column_exists(cur, "agent_events", "attempts")
        has_max_attempts = _column_exists(cur, "agent_events", "max_attempts")

        where = f"status IN ({','.join(['%s'] * len(pending_states))})"
        params: List[Any] = list(pending_states)

        if has_available:
            where += " AND (available_at IS NULL OR available_at <= NOW())"
        if has_locked_until:
            where += " AND (locked_until IS NULL OR locked_until <= NOW())"

        order = []
        if has_priority:
            order.append("priority DESC")
        order.append("id ASC")
        order_by = " ORDER BY " + ", ".join(order)

        # SELECT one candidate
        cur.execute(
            f"""
            SELECT id, event_type, payload_json
            {", attempts" if has_attempts else ""}
            {", max_attempts" if has_max_attempts else ""}
            FROM agent_events
            WHERE {where}
            {order_by}
            LIMIT 1
            """,
            tuple(params),
        )
        row = cur.fetchone()
        if not row:
            safe_commit(conn)
            return None

        event_id = int(row.get("id") if isinstance(row, dict) else row[0])

        # Update claim fields
        sets = ["status=%s"]
        up_params: List[Any] = [processing]

        if has_locked_by:
            sets.append("locked_by=%s")
            up_params.append(worker_id)

        if has_locked_until:
            sets.append("locked_until=DATE_ADD(NOW(), INTERVAL %s SECOND)")
            up_params.append(int(lock_seconds))

        if has_attempts:
            sets.append("attempts=COALESCE(attempts,0)+1")

        # clear error at claim-time if exists
        if _column_exists(cur, "agent_events", "last_error"):
            sets.append("last_error=NULL")

        if _column_exists(cur, "agent_events", "locked_at"):
            sets.append("locked_at=NOW()")

        up_params.append(event_id)

        cur.execute(
            f"UPDATE agent_events SET {', '.join(sets)} WHERE id=%s",
            tuple(up_params),
        )
        safe_commit(conn)

        payload = _json_load_maybe(row.get("payload_json") if isinstance(row, dict) else row[2]) or {}
        if not isinstance(payload, dict):
            payload = {"payload": payload}

        return {
            "id": event_id,
            "event_type": row.get("event_type") if isinstance(row, dict) else row[1],
            "payload": payload,
        }


def mark_done(conn, event_id: int) -> None:
    safe_rollback(conn)
    with conn.cursor() as cur:
        done = _event_status_done(cur)

        sets = ["status=%s", "locked_by=NULL"]
        params: List[Any] = [done]

        if _column_exists(cur, "agent_events", "locked_until"):
            sets.append("locked_until=NULL")
        if _column_exists(cur, "agent_events", "locked_at"):
            sets.append("locked_at=NULL")
        if _column_exists(cur, "agent_events", "processed_at"):
            sets.append("processed_at=NOW()")
        if _column_exists(cur, "agent_events", "last_error"):
            sets.append("last_error=NULL")

        params.append(int(event_id))

        cur.execute(f"UPDATE agent_events SET {', '.join(sets)} WHERE id=%s", tuple(params))
        safe_commit(conn)


def mark_failed(conn, event_id: int, err_text: str, retry_delay_sec: int = 20) -> None:
    """
    If attempts < max_attempts -> requeue as NEW/PENDING with available_at delayed.
    Else -> DEAD (if enum supports) else FAILED.
    """
    safe_rollback(conn)

    with conn.cursor() as cur:
        failed = _event_status_failed(cur)
        pending = _event_status_pending(cur)
        dead = _event_status_dead(cur)

        has_attempts = _column_exists(cur, "agent_events", "attempts")
        has_max_attempts = _column_exists(cur, "agent_events", "max_attempts")
        has_available = _column_exists(cur, "agent_events", "available_at")
        has_last_error = _column_exists(cur, "agent_events", "last_error")

        attempts = None
        max_attempts = None
        if has_attempts or has_max_attempts:
            cur.execute(
                f"""
                SELECT
                  {"attempts" if has_attempts else "NULL AS attempts"},
                  {"max_attempts" if has_max_attempts else "NULL AS max_attempts"}
                FROM agent_events
                WHERE id=%s
                LIMIT 1
                """,
                (int(event_id),),
            )
            r = cur.fetchone()
            if r:
                attempts = int(r.get("attempts") or 0) if isinstance(r, dict) else int(r[0] or 0)
                if has_max_attempts:
                    max_attempts = int(r.get("max_attempts") or 0) if isinstance(r, dict) else int(r[1] or 0)

        # decide requeue or dead
        should_dead = False
        if max_attempts and attempts is not None and attempts >= max_attempts:
            should_dead = True

        status_to_set = dead if (should_dead and dead) else (failed if should_dead else pending)

        sets = ["status=%s", "locked_by=NULL"]
        params: List[Any] = [status_to_set]

        if _column_exists(cur, "agent_events", "locked_until"):
            sets.append("locked_until=NULL")
        if _column_exists(cur, "agent_events", "locked_at"):
            sets.append("locked_at=NULL")

        if has_last_error:
            sets.append("last_error=%s")
            params.append((err_text or "")[:2000])

        if not should_dead and has_available:
            sets.append("available_at=DATE_ADD(NOW(), INTERVAL %s SECOND)")
            params.append(int(retry_delay_sec))

        params.append(int(event_id))

        cur.execute(f"UPDATE agent_events SET {', '.join(sets)} WHERE id=%s", tuple(params))
        safe_commit(conn)


def enqueue_event(
    conn,
    event_type: str,
    payload: Dict[str, Any],
    *,
    status: str = "NEW",
    priority: int = 50,
    run_at: Optional[str] = None,
    dedupe_key: Optional[str] = None,
    created_by_user_id: Optional[int] = None,
    correlation_id: Optional[str] = None,
    max_attempts: Optional[int] = None,
) -> int:
    """
    Insert an event into agent_events (schema-adaptive).
    Returns inserted id or 0 if deduped/failed.
    """
    safe_rollback(conn)
    with conn.cursor() as cur:
        if not _table_exists(cur, "agent_events"):
            return 0

        if dedupe_key:
            ok = _insert_idempotency_lock(cur, dedupe_key, ttl_hours=24, locked_by="enqueue_event")
            if not ok:
                safe_commit(conn)
                return 0

        cols: List[str] = []
        vals: List[Any] = []

        def add(col: str, value: Any) -> None:
            cols.append(col)
            vals.append(value)

        add("event_type", str(event_type)[:64])
        if _column_exists(cur, "agent_events", "payload_json"):
            add("payload_json", json.dumps(payload or {}, ensure_ascii=False))

        if _column_exists(cur, "agent_events", "status"):
            enum_vals = _event_status_values(cur)
            add("status", _pick_from_enum(enum_vals, status) or status)

        if _column_exists(cur, "agent_events", "priority"):
            add("priority", int(priority))
        if max_attempts is not None and _column_exists(cur, "agent_events", "max_attempts"):
            add("max_attempts", int(max_attempts))
        if created_by_user_id is not None and _column_exists(cur, "agent_events", "created_by_user_id"):
            add("created_by_user_id", int(created_by_user_id))
        if correlation_id and _column_exists(cur, "agent_events", "correlation_id"):
            add("correlation_id", str(correlation_id)[:64])

        if _column_exists(cur, "agent_events", "available_at"):
            add("available_at", run_at if run_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        if _column_exists(cur, "agent_events", "created_at"):
            add("created_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        if not cols:
            return 0

        placeholders = ", ".join(["%s"] * len(cols))
        col_sql = ", ".join([f"`{c}`" for c in cols])
        cur.execute(f"INSERT INTO agent_events ({col_sql}) VALUES ({placeholders})", tuple(vals))
        safe_commit(conn)
        return int(cur.lastrowid or 0)
