# dental_agents/agents/revenue_agent.py
from __future__ import annotations

from datetime import datetime, timedelta, date, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
import json

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None  # type: ignore

from ..notifications import create_notification


def _ist_tz():
    try:
        if ZoneInfo is not None:
            return ZoneInfo("Asia/Kolkata")
    except Exception:
        pass
    return timezone(timedelta(hours=5, minutes=30))


IST = _ist_tz()

AR_REMINDER_1_DAYS = 7
AR_REMINDER_2_DAYS = 14
AR_ESCALATION_DAYS = 30
CLAIM_DELAY_DAYS = 30
UNDERCODE_FACTOR = 0.7


def _today() -> date:
    return datetime.now(tz=IST).date()


def _now_str() -> str:
    return datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S")


def _norm(s: Any) -> str:
    return (str(s or "").strip().upper().replace("-", "_").replace(" ", "_"))[:80] or "CONSULTATION"

def _json_safe(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (date, datetime)):
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
    # Normalize non-JSON types (Decimal, dates) to avoid crashes in worker.
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


def _insert_idempotency_lock(cur, key: str, ttl_hours: int = 24, locked_by: str = "revenue-agent") -> bool:
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
        exp = datetime.now(tz=IST) + timedelta(hours=int(ttl_hours or 24))
        cols.append("expires_at")
        vals.append(exp.strftime("%Y-%m-%d %H:%M:%S"))
    if _column_exists(cur, "idempotency_locks", "created_at"):
        cols.append("created_at")
        vals.append(_now_str())

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


def _notify_admin(
    conn,
    *,
    notif_type: str,
    title: str,
    message: str,
    related_table: Optional[str] = None,
    related_id: Optional[int] = None,
    meta: Optional[Dict[str, Any]] = None,
    dedupe_key: Optional[str] = None,
    priority: Optional[int] = None,
) -> None:
    safe_meta = _json_safe(meta or {})
    create_notification(
        user_role="Admin",
        title=title,
        message=message,
        notif_type=notif_type,
        related_table=related_table,
        related_id=related_id,
        meta=safe_meta,
        dedupe_key=dedupe_key,
        priority=priority,
        conn=conn,
    )


def _notify_patient(
    conn,
    *,
    patient_id: int,
    notif_type: str,
    title: str,
    message: str,
    related_table: Optional[str] = None,
    related_id: Optional[int] = None,
    meta: Optional[Dict[str, Any]] = None,
    dedupe_key: Optional[str] = None,
) -> None:
    if not patient_id:
        return
    create_notification(
        user_id=patient_id,
        title=title,
        message=message,
        notif_type=notif_type,
        related_table=related_table,
        related_id=related_id,
        meta=meta,
        dedupe_key=dedupe_key,
        conn=conn,
    )

def _get_catalog_price(conn, procedure_type: str) -> Optional[float]:
    pt = _norm(procedure_type)
    with conn.cursor() as cur:
        if not _table_exists(cur, "procedure_catalog"):
            return None

        key_col = None
        if _column_exists(cur, "procedure_catalog", "procedure_type"):
            key_col = "procedure_type"
        elif _column_exists(cur, "procedure_catalog", "code"):
            key_col = "code"

        price_col = None
        for col in ("default_price", "price", "amount"):
            if _column_exists(cur, "procedure_catalog", col):
                price_col = col
                break

        if not key_col or not price_col:
            return None

        cur.execute(f"SELECT {price_col} AS p FROM procedure_catalog WHERE {key_col}=%s LIMIT 1", (pt,))
        r = cur.fetchone()
        if r and (r.get("p") if isinstance(r, dict) else r[0]) is not None:
            return float(r.get("p") if isinstance(r, dict) else r[0])
    return None


def _sum_visit_items(conn, *, visit_id: int) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        if not _table_exists(cur, "visit_procedures"):
            return []

        proc_col = None
        if _column_exists(cur, "visit_procedures", "procedure_type"):
            proc_col = "procedure_type"
        elif _column_exists(cur, "visit_procedures", "procedure_code"):
            proc_col = "procedure_code"

        qty_col = "qty" if _column_exists(cur, "visit_procedures", "qty") else (
            "quantity" if _column_exists(cur, "visit_procedures", "quantity") else None
        )
        unit_col = "unit_price" if _column_exists(cur, "visit_procedures", "unit_price") else None
        amount_col = "amount" if _column_exists(cur, "visit_procedures", "amount") else None

        if not proc_col or not qty_col:
            return []

        sel_unit = f"{unit_col} AS unit_price" if unit_col else "NULL AS unit_price"
        sel_amt = f"{amount_col} AS amount" if amount_col else "NULL AS amount"
        cur.execute(
            f"""
            SELECT {proc_col} AS proc, {qty_col} AS qty, {sel_unit}, {sel_amt}
            FROM visit_procedures
            WHERE visit_id=%s
            """,
            (visit_id,),
        )
        rows = list(cur.fetchall() or [])

    items: List[Dict[str, Any]] = []
    for r in rows:
        pt = r.get("proc") if isinstance(r, dict) else r[0]
        qty = float(r.get("qty") if isinstance(r, dict) else r[1] or 1)
        unit = r.get("unit_price") if isinstance(r, dict) else r[2]
        amt = r.get("amount") if isinstance(r, dict) else r[3]
        if unit is None:
            unit = _get_catalog_price(conn, pt) or 0.0
        unit = float(unit or 0)
        if amt is None:
            amt = unit * qty
        items.append(
            {"procedure_type": _norm(pt), "qty": qty, "unit_price": unit, "amount": float(amt or 0)}
        )
    return items


def _ensure_provisional_invoice(conn, *, appointment_id: int, patient_id: int, procedure_type: str) -> int:
    pt = _norm(procedure_type)
    with conn.cursor() as cur:
        if not _table_exists(cur, "invoices"):
            return 0

        if _column_exists(cur, "invoices", "appointment_id") and _column_exists(cur, "invoices", "invoice_type"):
            cur.execute(
                """
                SELECT id FROM invoices
                WHERE appointment_id=%s AND invoice_type='PROVISIONAL'
                ORDER BY id DESC LIMIT 1
                """,
                (appointment_id,),
            )
            r = cur.fetchone()
            if r:
                return int(r["id"] if isinstance(r, dict) else r[0])

        est = float(_get_catalog_price(conn, pt) or 0.0)

        cols = ["appointment_id", "patient_id", "invoice_type", "status", "amount"]
        vals = [appointment_id, patient_id, "PROVISIONAL", "Pending", est]

        if _column_exists(cur, "invoices", "issue_date"):
            cols.append("issue_date")
            vals.append(_today().strftime("%Y-%m-%d"))
        if _column_exists(cur, "invoices", "created_at"):
            cols.append("created_at")
            vals.append(_now_str())
        if _column_exists(cur, "invoices", "updated_at"):
            cols.append("updated_at")
            vals.append(_now_str())

        placeholders = ",".join(["%s"] * len(vals))
        cur.execute(f"INSERT INTO invoices ({','.join(cols)}) VALUES ({placeholders})", tuple(vals))
        inv_id = int(cur.lastrowid)

        if _table_exists(cur, "invoice_items") and _column_exists(cur, "invoice_items", "invoice_id"):
            try:
                cols2 = ["invoice_id"]
                vals2: List[Any] = [inv_id]
                if _column_exists(cur, "invoice_items", "item_type"):
                    cols2.append("item_type"); vals2.append("PROCEDURE")
                if _column_exists(cur, "invoice_items", "code"):
                    cols2.append("code"); vals2.append(pt)
                if _column_exists(cur, "invoice_items", "description"):
                    cols2.append("description"); vals2.append(f"Estimated: {pt}")
                if _column_exists(cur, "invoice_items", "qty"):
                    cols2.append("qty"); vals2.append(1)
                if _column_exists(cur, "invoice_items", "unit_price"):
                    cols2.append("unit_price"); vals2.append(est)
                if _column_exists(cur, "invoice_items", "amount"):
                    cols2.append("amount"); vals2.append(est)
                if _column_exists(cur, "invoice_items", "created_at"):
                    cols2.append("created_at"); vals2.append(_now_str())

                cur.execute(
                    f"INSERT INTO invoice_items ({','.join(cols2)}) VALUES ({','.join(['%s'] * len(vals2))})",
                    tuple(vals2),
                )
            except Exception:
                pass

        return inv_id

def _calc_chair_minutes(appt: Dict[str, Any]) -> Optional[int]:
    def _parse_time(t: Any) -> Optional[int]:
        if not t:
            return None
        s = str(t)
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.hour * 60 + dt.minute
            except Exception:
                continue
        return None

    if appt.get("actual_start_at") and appt.get("actual_end_at"):
        try:
            s = datetime.fromisoformat(str(appt["actual_start_at"]).replace(" ", "T"))
            e = datetime.fromisoformat(str(appt["actual_end_at"]).replace(" ", "T"))
            return max(1, int((e - s).total_seconds() // 60))
        except Exception:
            pass

    if appt.get("predicted_duration_min"):
        try:
            return int(appt["predicted_duration_min"])
        except Exception:
            pass

    st = _parse_time(appt.get("scheduled_time"))
    et = _parse_time(appt.get("scheduled_end_time"))
    if st is not None and et is not None:
        return max(1, et - st)

    return None


def _update_daily_analytics(
    conn,
    *,
    usage_date: str,
    doctor_id: Optional[int],
    procedure_code: str,
    amount: float,
    qty: float,
    chair_minutes: Optional[int],
) -> None:
    with conn.cursor() as cur:
        if not _table_exists(cur, "revenue_analytics_daily"):
            return

        cur.execute(
            """
            INSERT INTO revenue_analytics_daily
              (usage_date, doctor_id, procedure_code, total_revenue, total_qty, appointment_count, chair_minutes, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              total_revenue = total_revenue + VALUES(total_revenue),
              total_qty = total_qty + VALUES(total_qty),
              appointment_count = appointment_count + VALUES(appointment_count),
              chair_minutes = chair_minutes + VALUES(chair_minutes),
              updated_at = NOW()
            """,
            (
                usage_date,
                int(doctor_id) if doctor_id else None,
                procedure_code[:64],
                float(amount),
                float(qty),
                1,
                int(chair_minutes or 0),
            ),
        )


def _detect_leakage(conn, *, appointment_id: int, visit_id: int, invoice_id: int) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []
    with conn.cursor() as cur:
        if not (_table_exists(cur, "visit_procedures") and _table_exists(cur, "invoices")):
            return findings

        cur.execute("SELECT COUNT(*) AS c FROM visit_procedures WHERE visit_id=%s", (visit_id,))
        vp = int((cur.fetchone() or {}).get("c") or 0)

        ii = 0
        if _table_exists(cur, "invoice_items"):
            cur.execute("SELECT COUNT(*) AS c FROM invoice_items WHERE invoice_id=%s", (invoice_id,))
            ii = int((cur.fetchone() or {}).get("c") or 0)

        cur.execute("SELECT amount FROM invoices WHERE id=%s", (invoice_id,))
        amt = float((cur.fetchone() or {}).get("amount") or 0)

        if vp > 0 and ii == 0:
            findings.append({"type": "REVENUE_LEAK_UNBILLED", "meta": {"visit_procedure_count": vp}})

        if vp > 0 and amt <= 0:
            findings.append({"type": "REVENUE_LEAK_MISSING_CHARGES", "meta": {"invoice_amount": amt}})

        expected_total = 0.0
        if vp > 0 and _table_exists(cur, "procedure_catalog"):
            proc_col = "procedure_code" if _column_exists(cur, "visit_procedures", "procedure_code") else (
                "procedure_type" if _column_exists(cur, "visit_procedures", "procedure_type") else None
            )
            qty_col = "qty" if _column_exists(cur, "visit_procedures", "qty") else (
                "quantity" if _column_exists(cur, "visit_procedures", "quantity") else None
            )
            if proc_col and qty_col:
                cur.execute(
                    f"SELECT {proc_col} AS p, {qty_col} AS q FROM visit_procedures WHERE visit_id=%s",
                    (visit_id,),
                )
                rows = list(cur.fetchall() or [])
                for r in rows:
                    code = r.get("p") if isinstance(r, dict) else r[0]
                    qty = float(r.get("q") if isinstance(r, dict) else r[1] or 1)
                    price = _get_catalog_price(conn, code) or 0.0
                    expected_total += price * qty

        if expected_total > 0 and amt > 0 and amt < expected_total * UNDERCODE_FACTOR:
            findings.append(
                {
                    "type": "REVENUE_LEAK_UNDER_CODED",
                    "meta": {"expected_total": expected_total, "invoice_amount": amt, "factor": UNDERCODE_FACTOR},
                }
            )

        if _column_exists(cur, "appointments", "follow_up_required") and _column_exists(cur, "appointments", "follow_up_date"):
            cur.execute(
                "SELECT follow_up_required, follow_up_date FROM appointments WHERE id=%s LIMIT 1",
                (appointment_id,),
            )
            row = cur.fetchone() or {}
            required = int(row.get("follow_up_required") or 0)
            if required and not row.get("follow_up_date"):
                findings.append({"type": "REVENUE_LEAK_FOLLOW_UP", "meta": {"follow_up_required": True}})

    return findings


def _detect_claim_issues(conn, *, invoice_id: int) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []
    with conn.cursor() as cur:
        if not _table_exists(cur, "invoices"):
            return issues

        cols = {c: _column_exists(cur, "invoices", c) for c in (
            "claim_status",
            "insurance_status",
            "claim_submitted_at",
            "claim_rejected_at",
            "claim_denied_at",
            "paid_date",
        )}

        if cols.get("claim_status") or cols.get("insurance_status"):
            cur.execute(
                """
                SELECT
                  {claim_status} AS claim_status,
                  {insurance_status} AS insurance_status,
                  {claim_submitted_at} AS claim_submitted_at,
                  {claim_rejected_at} AS claim_rejected_at,
                  {claim_denied_at} AS claim_denied_at,
                  {paid_date} AS paid_date
                FROM invoices
                WHERE id=%s
                LIMIT 1
                """.format(
                    claim_status="claim_status" if cols.get("claim_status") else "NULL",
                    insurance_status="insurance_status" if cols.get("insurance_status") else "NULL",
                    claim_submitted_at="claim_submitted_at" if cols.get("claim_submitted_at") else "NULL",
                    claim_rejected_at="claim_rejected_at" if cols.get("claim_rejected_at") else "NULL",
                    claim_denied_at="claim_denied_at" if cols.get("claim_denied_at") else "NULL",
                    paid_date="paid_date" if cols.get("paid_date") else "NULL",
                ),
                (invoice_id,),
            )
            row = cur.fetchone() or {}

            status = str(row.get("claim_status") or row.get("insurance_status") or "").upper()
            if status in ("REJECTED", "DENIED"):
                issues.append({"type": "REVENUE_LEAK_CLAIM_REJECTED", "meta": {"status": status}})

            submitted = row.get("claim_submitted_at")
            paid = row.get("paid_date")
            if submitted and not paid:
                try:
                    s = datetime.fromisoformat(str(submitted).replace(" ", "T"))
                    if (datetime.now(tz=IST) - s).days >= CLAIM_DELAY_DAYS:
                        issues.append({"type": "REVENUE_LEAK_CLAIM_DELAYED", "meta": {"submitted_at": str(submitted)}})
                except Exception:
                    pass

    return issues

def _write_revenue_insight(
    conn,
    *,
    as_of: date,
    insight_type: str,
    payload: Dict[str, Any],
    range_label: Optional[str] = None,
) -> None:
    with conn.cursor() as cur:
        if not _table_exists(cur, "revenue_insights"):
            return

        safe_payload = _json_safe(payload)
        cols = ["as_of_date", "raw_json"]
        vals: List[Any] = [as_of.strftime("%Y-%m-%d"), _json_dumps_safe(payload)]

        if _column_exists(cur, "revenue_insights", "insight_type"):
            cols.append("insight_type"); vals.append(str(insight_type)[:64])
        if range_label and _column_exists(cur, "revenue_insights", "range_label"):
            cols.append("range_label"); vals.append(str(range_label)[:16])
        if _column_exists(cur, "revenue_insights", "forecast_json") and safe_payload.get("forecast"):
            cols.append("forecast_json"); vals.append(_json_dumps_safe({"forecast": safe_payload.get("forecast")}))
        if _column_exists(cur, "revenue_insights", "kpi_json") and safe_payload.get("kpis"):
            cols.append("kpi_json"); vals.append(_json_dumps_safe({"kpis": safe_payload.get("kpis")}))

        placeholders = ",".join(["%s"] * len(vals))
        col_sql = ",".join(cols)

        cur.execute(
            f"""
            INSERT INTO revenue_insights ({col_sql}, created_at, updated_at)
            VALUES ({placeholders}, NOW(), NOW())
            ON DUPLICATE KEY UPDATE raw_json=VALUES(raw_json), updated_at=NOW()
            """,
            tuple(vals),
        )


def _compute_forecast(conn, *, days: int = 60) -> Dict[str, Any]:
    from ..ai import ai_text

    with conn.cursor() as cur:
        if not _table_exists(cur, "invoices"):
            return {}

        date_col = "issue_date" if _column_exists(cur, "invoices", "issue_date") else "created_at"
        paid_col = "paid_date" if _column_exists(cur, "invoices", "paid_date") else None

        cur.execute(
            f"""
            SELECT {date_col} AS d, SUM(amount) AS total
            FROM invoices
            WHERE {date_col} >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
              AND (status IN ('Paid','PAID','paid') { "OR " + paid_col + " IS NOT NULL" if paid_col else "" })
            GROUP BY {date_col}
            ORDER BY {date_col} ASC
            """,
            (int(days),),
        )
        rows = list(cur.fetchall() or [])

    series: List[Tuple[date, float]] = []
    for r in rows:
        d = r.get("d") if isinstance(r, dict) else r[0]
        total = float(r.get("total") if isinstance(r, dict) else r[1] or 0)
        try:
            dd = d if isinstance(d, date) else datetime.fromisoformat(str(d)).date()
        except Exception:
            continue
        series.append((dd, total))

    series.sort(key=lambda x: x[0])
    if not series:
        return {
            "series_days": 0,
            "forecast_7d": 0,
            "forecast_30d": 0,
            "confidence": 0.2,
            "drivers": [],
            "ai_summary": "Not enough data to generate summary.",
        }

    totals = [v for _, v in series]
    avg7 = sum(totals[-7:]) / max(1, min(7, len(totals)))
    avg30 = sum(totals[-30:]) / max(1, min(30, len(totals)))

    trend = 0.0
    if len(totals) >= 14:
        prev7 = sum(totals[-14:-7]) / 7.0
        trend = avg7 - prev7

    pay_prob = _payment_probability_summary(conn)
    claim_prob = _claim_approval_likelihood_summary(conn)

    # Generate AI Summary
    ai_summary = ""
    try:
        drivers_text = f"7-day Avg: {avg7:.2f}, 30-day Avg: {avg30:.2f}, Trend: {trend:.2f}"
        if pay_prob: drivers_text += f", Payment Prob: {pay_prob:.2f}"
        
        prompt = (
            f"Analyze these dental clinic revenue metrics:\n{drivers_text}\n"
            "Write a 4-5 line simple, direct management summary suggesting actions. "
            "Focus on cash flow and trends."
        )
        ai_summary = ai_text("You are a financial analyst.", prompt, max_tokens=200)
    except Exception:
        ai_summary = "AI summary temporarily unavailable."

    forecast = {
        "series_days": len(totals),
        "forecast_7d": round(avg7 * 7, 2),
        "forecast_30d": round(avg30 * 30, 2),
        "confidence": round(min(1.0, max(0.2, len(totals) / 30.0)), 2),
        "payment_probability_avg": pay_prob,
        "claim_approval_likelihood": claim_prob,
        "drivers": [
            {"name": "Trailing 7-day average", "value": round(avg7, 2)},
            {"name": "Trailing 30-day average", "value": round(avg30, 2)},
            {"name": "Recent 7-day trend", "value": round(trend, 2)},
        ],
        "ai_summary": ai_summary,
    }
    return forecast


def _payment_probability_summary(conn) -> Optional[float]:
    with conn.cursor() as cur:
        if not _table_exists(cur, "invoices"):
            return None
        if not _column_exists(cur, "invoices", "patient_id"):
            return None
        if not _column_exists(cur, "invoices", "status"):
            return None
        date_col = "issue_date" if _column_exists(cur, "invoices", "issue_date") else "created_at"
        cur.execute(
            f"""
            SELECT patient_id,
                   SUM(CASE WHEN status IN ('Paid','PAID','paid') THEN 1 ELSE 0 END) AS paid_cnt,
                   COUNT(*) AS total_cnt
            FROM invoices
            WHERE {date_col} >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
            GROUP BY patient_id
            """
        )
        rows = list(cur.fetchall() or [])

    if not rows:
        return None

    probs = []
    for r in rows:
        paid = float(r.get("paid_cnt") if isinstance(r, dict) else r[1] or 0)
        total = float(r.get("total_cnt") if isinstance(r, dict) else r[2] or 0)
        if total > 0:
            probs.append(paid / total)
    if not probs:
        return None
    return round(sum(probs) / len(probs), 2)


def _claim_approval_likelihood_summary(conn) -> Optional[float]:
    with conn.cursor() as cur:
        if not _table_exists(cur, "invoices"):
            return None
        has_claim = _column_exists(cur, "invoices", "claim_status")
        has_ins = _column_exists(cur, "invoices", "insurance_status")
        if not (has_claim or has_ins):
            return None
        status_col = "claim_status" if has_claim else "insurance_status"
        date_col = "issue_date" if _column_exists(cur, "invoices", "issue_date") else "created_at"

        cur.execute(
            f"""
            SELECT
              SUM(CASE WHEN {status_col} IN ('APPROVED','Approved','PAID','Paid') THEN 1 ELSE 0 END) AS ok_cnt,
              SUM(CASE WHEN {status_col} IN ('REJECTED','Rejected','DENIED','Denied') THEN 1 ELSE 0 END) AS bad_cnt
            FROM invoices
            WHERE {date_col} >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
            """
        )
        row = cur.fetchone() or {}

    ok_cnt = float(row.get("ok_cnt") if isinstance(row, dict) else row[0] or 0)
    bad_cnt = float(row.get("bad_cnt") if isinstance(row, dict) else row[1] or 0)
    total = ok_cnt + bad_cnt
    if total <= 0:
        return None
    return round(ok_cnt / total, 2)


def _write_reports(conn) -> None:
    today = _today()

    def _range_kpi(days: int) -> Dict[str, Any]:
        with conn.cursor() as cur:
            if not _table_exists(cur, "invoices"):
                return {}

            date_col = "issue_date" if _column_exists(cur, "invoices", "issue_date") else "created_at"
            cur.execute(
                f"""
                SELECT
                  COUNT(*) AS invoice_count,
                  COALESCE(SUM(amount),0) AS total_billed,
                  COALESCE(SUM(CASE WHEN status IN ('Paid','PAID','paid') THEN amount ELSE 0 END),0) AS total_paid,
                  COALESCE(SUM(CASE WHEN status IN ('Pending','PENDING','Overdue','OVERDUE') THEN amount ELSE 0 END),0) AS total_pending
                FROM invoices
                WHERE {date_col} >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                """,
                (int(days),),
            )
            return cur.fetchone() or {}

    for label, days in (("7d", 7), ("30d", 30), ("90d", 90)):
        kpis = _range_kpi(days)
        payload = {"kpis": kpis, "range": label, "as_of_date": str(today)}
        _write_revenue_insight(conn, as_of=today, insight_type="REPORT", payload=payload, range_label=label)

        dedupe = f"revenue_report:{label}:{today.strftime('%Y-%m-%d')}"
        _notify_admin(
            conn,
            notif_type="REVENUE_REPORT_READY",
            title=f"Revenue report ready ({label})",
            message=f"Revenue KPIs for {label} are ready.",
            related_table="revenue_insights",
            related_id=None,
            meta=payload,
            dedupe_key=dedupe,
        )


def _ar_reminders_sweep(conn) -> None:
    with conn.cursor() as cur:
        if not _table_exists(cur, "invoices"):
            return

        if not _column_exists(cur, "invoices", "issue_date"):
            return

        cur.execute(
            """
            SELECT id, patient_id, amount, status, issue_date
            FROM invoices
            WHERE status IN ('Pending','PENDING','Overdue','OVERDUE')
              AND issue_date IS NOT NULL
            ORDER BY issue_date ASC
            LIMIT 500
            """
        )
        rows = list(cur.fetchall() or [])

    for r in rows:
        inv_id = int(r.get("id") if isinstance(r, dict) else r[0])
        patient_id = int(r.get("patient_id") if isinstance(r, dict) else r[1] or 0)
        amount = float(r.get("amount") if isinstance(r, dict) else r[2] or 0)
        issue_date = r.get("issue_date") if isinstance(r, dict) else r[4]

        try:
            issued = issue_date if isinstance(issue_date, date) else datetime.fromisoformat(str(issue_date)).date()
        except Exception:
            continue

        days_overdue = (_today() - issued).days
        if days_overdue < AR_REMINDER_1_DAYS:
            continue

        if days_overdue >= AR_ESCALATION_DAYS:
            level = "AR_ESCALATION_CALL"
        elif days_overdue >= AR_REMINDER_2_DAYS:
            level = "AR_REMINDER_2"
        else:
            level = "AR_REMINDER_1"

        dedupe = f"ar_reminder:{level}:{inv_id}:{_today().strftime('%Y-%m-%d')}"
        with conn.cursor() as cur:
            if not _insert_idempotency_lock(cur, dedupe, ttl_hours=24):
                continue

        msg = f"Invoice #{inv_id} is overdue by {days_overdue} days. Amount due: INR {amount:.2f}."

        _notify_patient(
            conn,
            patient_id=patient_id,
            notif_type=level,
            title="Payment reminder",
            message=msg,
            related_table="invoices",
            related_id=inv_id,
            dedupe_key=None,
        )

        _notify_admin(
            conn,
            notif_type=level,
            title="Accounts receivable reminder",
            message=msg,
            related_table="invoices",
            related_id=inv_id,
            dedupe_key=None,
        )


def on_appointment_created(conn, payload: Dict[str, Any]) -> None:
    appt_id = int(payload.get("appointmentId") or 0)
    if not appt_id:
        return

    with conn.cursor() as cur:
        try:
            cur.execute("SET time_zone = '+05:30'")
        except Exception:
            pass

        if not _table_exists(cur, "appointments"):
            return

        cur.execute("SELECT id, patient_id, type FROM appointments WHERE id=%s", (appt_id,))
        appt = cur.fetchone()
        if not appt:
            return

        patient_id = int(appt.get("patient_id") if isinstance(appt, dict) else appt[1] or 0)
        appt_type = (appt.get("type") if isinstance(appt, dict) else appt[2]) or payload.get("type") or "CONSULTATION"

    inv_id = _ensure_provisional_invoice(conn, appointment_id=appt_id, patient_id=patient_id, procedure_type=appt_type)

    if inv_id and patient_id:
        _notify_patient(
            conn,
            patient_id=patient_id,
            notif_type="BILLING_PROVISIONAL",
            title="Provisional bill created",
            message="A provisional estimate has been created for your appointment. Final bill will be generated after completion.",
            related_table="invoices",
            related_id=inv_id,
        )

    conn.commit()


def on_appointment_completed(conn, payload: Dict[str, Any]) -> None:
    appt_id = int(payload.get("appointmentId") or 0)
    if not appt_id:
        return

    visit_id = 0
    inv_id = 0
    appt: Dict[str, Any] = {}

    with conn.cursor() as cur:
        try:
            cur.execute("SET time_zone = '+05:30'")
        except Exception:
            pass

        if not _table_exists(cur, "appointments"):
            return

        cur.execute("SELECT * FROM appointments WHERE id=%s", (appt_id,))
        appt = cur.fetchone() or {}
        if not appt:
            return

        if _table_exists(cur, "visits") and _column_exists(cur, "visits", "appointment_id"):
            cur.execute("SELECT id FROM visits WHERE appointment_id=%s ORDER BY id DESC LIMIT 1", (appt_id,))
            vr = cur.fetchone()
            if vr:
                visit_id = int(vr["id"] if isinstance(vr, dict) else vr[0])

        if _table_exists(cur, "invoices") and _column_exists(cur, "invoices", "appointment_id"):
            cur.execute(
                """
                SELECT id, invoice_type
                FROM invoices
                WHERE appointment_id=%s
                ORDER BY (invoice_type='PROVISIONAL') DESC, id DESC
                LIMIT 1
                """,
                (appt_id,),
            )
            ir = cur.fetchone()
            if ir:
                inv_id = int(ir["id"] if isinstance(ir, dict) else ir[0])
            else:
                cols = ["appointment_id", "patient_id", "invoice_type", "status", "amount"]
                vals = [appt_id, appt.get("patient_id"), "FINAL", "Pending", 0.0]
                if _column_exists(cur, "invoices", "issue_date"):
                    cols.append("issue_date"); vals.append(_today().strftime("%Y-%m-%d"))
                if _column_exists(cur, "invoices", "created_at"):
                    cols.append("created_at"); vals.append(_now_str())
                if _column_exists(cur, "invoices", "updated_at"):
                    cols.append("updated_at"); vals.append(_now_str())
                cur.execute(
                    f"INSERT INTO invoices ({','.join(cols)}) VALUES ({','.join(['%s']*len(vals))})",
                    tuple(vals),
                )
                inv_id = int(cur.lastrowid)

    items: List[Dict[str, Any]] = []
    if visit_id:
        items = _sum_visit_items(conn, visit_id=visit_id)

    appt_type = appt.get("type") or "CONSULTATION"
    if not items:
        est = float(_get_catalog_price(conn, appt_type) or 0.0)
        items = [{"procedure_type": _norm(appt_type), "qty": 1.0, "unit_price": est, "amount": est}]

    total = float(sum(float(x["amount"]) for x in items))

    with conn.cursor() as cur:
        if inv_id and _table_exists(cur, "invoice_items"):
            try:
                cur.execute("DELETE FROM invoice_items WHERE invoice_id=%s", (inv_id,))
            except Exception:
                pass

            for it in items:
                cols = ["invoice_id"]
                vals: List[Any] = [inv_id]

                if _column_exists(cur, "invoice_items", "item_type"):
                    cols.append("item_type"); vals.append("PROCEDURE")
                if _column_exists(cur, "invoice_items", "code"):
                    cols.append("code"); vals.append(_norm(it["procedure_type"]))
                if _column_exists(cur, "invoice_items", "description"):
                    cols.append("description"); vals.append(_norm(it["procedure_type"]))
                if _column_exists(cur, "invoice_items", "qty"):
                    cols.append("qty"); vals.append(float(it["qty"]))
                if _column_exists(cur, "invoice_items", "unit_price"):
                    cols.append("unit_price"); vals.append(float(it["unit_price"]))
                if _column_exists(cur, "invoice_items", "amount"):
                    cols.append("amount"); vals.append(float(it["amount"]))
                if _column_exists(cur, "invoice_items", "created_at"):
                    cols.append("created_at"); vals.append(_now_str())
                if _column_exists(cur, "invoice_items", "updated_at"):
                    cols.append("updated_at"); vals.append(_now_str())

                try:
                    cur.execute(
                        f"INSERT INTO invoice_items ({','.join(cols)}) VALUES ({','.join(['%s'] * len(vals))})",
                        tuple(vals),
                    )
                except Exception:
                    pass

        if inv_id and _table_exists(cur, "invoices"):
            try:
                cur.execute(
                    """
                    UPDATE invoices
                    SET invoice_type='FINAL', amount=%s, status='Pending'
                    """ + (", updated_at=NOW()" if _column_exists(cur, "invoices", "updated_at") else "") + """
                    WHERE id=%s
                    """,
                    (total, inv_id),
                )
            except Exception:
                pass

    patient_id = int(appt.get("patient_id") or 0)
    if patient_id and inv_id:
        _notify_patient(
            conn,
            patient_id=patient_id,
            notif_type="BILLING_FINAL",
            title="Final bill generated",
            message="Your final bill has been generated. Please check billing section for details.",
            related_table="invoices",
            related_id=inv_id,
        )

    usage_date = str(appt.get("scheduled_date") or _today().strftime("%Y-%m-%d"))
    chair_minutes = _calc_chair_minutes(appt)
    doctor_id = int(appt.get("doctor_id") or 0) if appt.get("doctor_id") else None
    for it in items:
        _update_daily_analytics(
            conn,
            usage_date=usage_date,
            doctor_id=doctor_id,
            procedure_code=_norm(it["procedure_type"]),
            amount=float(it["amount"]),
            qty=float(it["qty"]),
            chair_minutes=chair_minutes,
        )

    if inv_id and visit_id:
        for finding in _detect_leakage(conn, appointment_id=appt_id, visit_id=visit_id, invoice_id=inv_id):
            ftype = finding["type"]
            dedupe = f"revenue_leak:{ftype}:{appt_id}:{_today().strftime('%Y-%m-%d')}"
            _notify_admin(
                conn,
                notif_type=ftype,
                title="Revenue leakage alert",
                message=f"Potential leakage detected for Appointment #{appt_id}.",
                related_table="appointments",
                related_id=appt_id,
                meta=finding.get("meta"),
                dedupe_key=dedupe,
            )

        for issue in _detect_claim_issues(conn, invoice_id=inv_id):
            itype = issue["type"]
            dedupe = f"revenue_leak:{itype}:{inv_id}:{_today().strftime('%Y-%m-%d')}"
            _notify_admin(
                conn,
                notif_type=itype,
                title="Claim issue detected",
                message=f"Issue detected for Invoice #{inv_id}.",
                related_table="invoices",
                related_id=inv_id,
                meta=issue.get("meta"),
                dedupe_key=dedupe,
            )

    conn.commit()


def revenue_monitor_tick(conn, *, horizon_days: int = 30) -> None:
    forecast = _compute_forecast(conn, days=max(30, horizon_days))
    payload = {"forecast": forecast, "as_of_date": str(_today())}
    _write_revenue_insight(conn, as_of=_today(), insight_type="FORECAST", payload=payload, range_label="30d")
    _write_reports(conn)
    _ar_reminders_sweep(conn)
    conn.commit()


class RevenueAgent:
    def handle(self, conn, event_type: str, event_id: int, payload: Dict[str, Any]) -> None:
        if event_type == "AppointmentCreated":
            on_appointment_created(conn, payload)
            return

        if event_type == "AppointmentCompleted":
            on_appointment_completed(conn, payload)
            return

        if event_type in ("RevenueDailyTick", "RevenueMonitorTick"):
            horizon = int(payload.get("horizon_days") or 30)
            revenue_monitor_tick(conn, horizon_days=horizon)
            return

        if event_type in ("ARRankAndNotify",):
            _ar_reminders_sweep(conn)
            conn.commit()
            return

        return


# Legacy compatibility (used by older worker entrypoints)
def daily_revenue_insights() -> None:
    from ..db import get_conn

    conn = get_conn()
    try:
        revenue_monitor_tick(conn, horizon_days=60)
    finally:
        try:
            conn.close()
        except Exception:
            pass


def ar_reminders_sweep() -> None:
    from ..db import get_conn

    conn = get_conn()
    try:
        _ar_reminders_sweep(conn)
        conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass
