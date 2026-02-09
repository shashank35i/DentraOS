# dental_agents/agents/case_tracking_agent.py
from __future__ import annotations

from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, Optional, List, Tuple
import json
import os
import re
import hashlib
import traceback

from ..db import get_conn
from ..notifications import create_notification


# -----------------------------
# Timezone helpers
# -----------------------------
def _get_ist():
    try:
        from zoneinfo import ZoneInfo  # type: ignore

        try:
            return ZoneInfo("Asia/Kolkata")
        except Exception:
            return timezone(timedelta(hours=5, minutes=30), name="IST")
    except Exception:
        return timezone(timedelta(hours=5, minutes=30), name="IST")


IST = _get_ist()


def _now() -> datetime:
    return datetime.now(tz=IST)


def _today() -> date:
    return _now().date()


# -----------------------------
# DB helpers (schema-adaptive)
# -----------------------------
def _cursor(conn):
    """
    Always prefer dict rows even if the connector default is tuple rows.
    """
    try:
        return conn.cursor(dictionary=True)  # mysql-connector
    except TypeError:
        return conn.cursor()  # fallback


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


def _safe_json_loads(v: Any) -> Any:
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


def _digits_only(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


def _set_session_tz(cur) -> None:
    try:
        cur.execute("SET time_zone = '+05:30'")
    except Exception:
        pass


# -----------------------------
# Notifications (multi-channel, safe kwargs)
# -----------------------------
def _notify_one(
    *,
    user_id: Optional[int] = None,
    user_role: Optional[str] = None,
    channel: Optional[str] = None,
    title: str,
    message: str,
    notif_type: str,
    related_table: Optional[str] = None,
    related_id: Optional[int] = None,
    meta: Optional[dict] = None,
) -> None:
    """
    Wrap create_notification safely (your notifications.py may accept different kwargs).
    """
    kwargs: Dict[str, Any] = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "notif_type": notif_type,
        "related_table": related_table,
        "related_id": related_id,
    }
    if channel:
        kwargs["channel"] = channel
    if user_role:
        kwargs["user_role"] = user_role
    if meta is not None:
        kwargs["meta"] = meta

    try:
        create_notification(**kwargs)
    except TypeError:
        # Back-compat: remove unsupported fields
        for k in ["channel", "user_role", "meta"]:
            if k in kwargs:
                kwargs.pop(k, None)
        try:
            create_notification(**kwargs)
        except Exception:
            # Never crash the agent because notifications failed
            return
    except Exception:
        return


def _get_preferred_channels(cur, user_id: int) -> List[str]:
    """
    Best-effort channel preference resolution.
    - patient_profiles.preferred_channels_json
    - fall back to IN_APP
    """
    channels: List[str] = []

    if _table_exists(cur, "patient_profiles") and _column_exists(cur, "patient_profiles", "preferred_channels_json"):
        try:
            cur.execute(
                "SELECT preferred_channels_json FROM patient_profiles WHERE user_id=%s LIMIT 1",
                (user_id,),
            )
            row = cur.fetchone() or {}
            pref = _safe_json_loads(row.get("preferred_channels_json"))
            if isinstance(pref, list):
                for c in pref:
                    if not c:
                        continue
                    cs = str(c).strip().upper()
                    # schema has enum('IN_APP','EMAIL','SMS','WHATSAPP','CALL') in many variants
                    channels.append(cs)
        except Exception:
            pass

    # De-dup + validate lightly
    valid = {"IN_APP", "EMAIL", "SMS", "WHATSAPP", "CALL"}
    out = []
    for c in channels:
        c = c.upper()
        if c in valid and c not in out:
            out.append(c)

    if not out:
        out = ["IN_APP"]
    return out


def _notify_multi(
    *,
    conn,
    user_id: Optional[int],
    user_role: Optional[str],
    title: str,
    message: str,
    notif_type: str,
    related_table: Optional[str],
    related_id: Optional[int],
    priority_hint: str = "NORMAL",
    meta: Optional[dict] = None,
) -> None:
    """
    Send IN_APP always, and also the user's preferred channels when "urgent-ish".
    You can tune routing later; this keeps the workflow promise without breaking.
    """
    if not user_id and not user_role:
        return

    channels: List[str] = ["IN_APP"]
    try:
        if user_id:
            with _cursor(conn) as cur:
                _set_session_tz(cur)
                channels = _get_preferred_channels(cur, user_id)
    except Exception:
        channels = ["IN_APP"]

    # For HIGH/CRITICAL, include ALL preferred; for NORMAL, keep to IN_APP
    send_channels = channels if priority_hint in ("HIGH", "CRITICAL") else ["IN_APP"]
    for ch in send_channels:
        _notify_one(
            user_id=user_id,
            user_role=user_role,
            channel=ch,
            title=title,
            message=message,
            notif_type=notif_type,
            related_table=related_table,
            related_id=related_id,
            meta=meta or {},
        )


# -----------------------------
# Timeline + attachments
# -----------------------------
def _insert_timeline(conn, *, case_id: int, event_type: str, title: str, body: str, meta: dict) -> None:
    """
    case_timeline schema (as per your project direction): event_type, title, body, meta_json, created_at
    """
    with _cursor(conn) as cur:
        if not _table_exists(cur, "case_timeline"):
            return
        cols = {
            "case_id": _column_exists(cur, "case_timeline", "case_id"),
            "event_type": _column_exists(cur, "case_timeline", "event_type"),
            "title": _column_exists(cur, "case_timeline", "title"),
            "body": _column_exists(cur, "case_timeline", "body"),
            "meta_json": _column_exists(cur, "case_timeline", "meta_json"),
            "created_at": _column_exists(cur, "case_timeline", "created_at"),
        }

        fields: List[str] = []
        vals: List[Any] = []

        if cols["case_id"]:
            fields.append("case_id")
            vals.append(case_id)
        if cols["event_type"]:
            fields.append("event_type")
            vals.append((event_type or "UPDATE")[:80])
        if cols["title"]:
            fields.append("title")
            vals.append((title or event_type or "UPDATE")[:200])
        if cols["body"]:
            fields.append("body")
            vals.append((body or "")[:8000])
        if cols["meta_json"]:
            fields.append("meta_json")
            vals.append(json.dumps(meta or {}, ensure_ascii=False))
        if cols["created_at"]:
            fields.append("created_at")
            vals.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        if not fields:
            return

        placeholders = ",".join(["%s"] * len(fields))
        sql = f"INSERT INTO case_timeline ({','.join(fields)}) VALUES ({placeholders})"
        cur.execute(sql, tuple(vals))


def _ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)


def _try_generate_pdf(file_path: str, title: str, lines: List[str]) -> bool:
    """
    Optional: generate a simple PDF with reportlab (if installed in your environment).
    Returns True if created.
    """
    try:
        from reportlab.lib.pagesizes import A4  # type: ignore
        from reportlab.pdfgen import canvas  # type: ignore

        _ensure_dir(os.path.dirname(file_path))
        c = canvas.Canvas(file_path, pagesize=A4)
        width, height = A4

        y = height - 60
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, title[:120])
        y -= 28

        c.setFont("Helvetica", 11)
        for ln in lines:
            if y < 60:
                c.showPage()
                y = height - 60
                c.setFont("Helvetica", 11)
            # simple wrap
            s = str(ln)
            while len(s) > 110:
                c.drawString(50, y, s[:110])
                y -= 16
                s = s[110:]
            c.drawString(50, y, s)
            y -= 16

        c.showPage()
        c.save()
        return True
    except Exception:
        return False


def _insert_attachment(
    conn,
    *,
    case_id: int,
    kind: str,
    file_name: str,
    file_path: str,
    meta: dict,
) -> None:
    """
    Store document reference in case_attachments if available.
    Schema varies in projects, so we attempt best-effort insertion.
    """
    with _cursor(conn) as cur:
        if not _table_exists(cur, "case_attachments"):
            return

        cols = {
            "case_id": _column_exists(cur, "case_attachments", "case_id"),
            "attachment_type": _column_exists(cur, "case_attachments", "attachment_type"),
            "type": _column_exists(cur, "case_attachments", "type"),
            "file_name": _column_exists(cur, "case_attachments", "file_name"),
            "filename": _column_exists(cur, "case_attachments", "filename"),
            "file_path": _column_exists(cur, "case_attachments", "file_path"),
            "path": _column_exists(cur, "case_attachments", "path"),
            "mime_type": _column_exists(cur, "case_attachments", "mime_type"),
            "meta_json": _column_exists(cur, "case_attachments", "meta_json"),
            "created_at": _column_exists(cur, "case_attachments", "created_at"),
        }

        fields: List[str] = []
        vals: List[Any] = []

        if cols["case_id"]:
            fields.append("case_id")
            vals.append(case_id)

        if cols["attachment_type"]:
            fields.append("attachment_type")
            vals.append(kind[:40])
        elif cols["type"]:
            fields.append("type")
            vals.append(kind[:64])

        if cols["file_name"]:
            fields.append("file_name")
            vals.append(file_name[:255])
        elif cols["filename"]:
            fields.append("filename")
            vals.append(file_name[:255])

        if cols["file_path"]:
            fields.append("file_path")
            vals.append(file_path[:2000])
        elif cols["path"]:
            fields.append("path")
            vals.append(file_path[:2000])

        if cols["mime_type"]:
            fields.append("mime_type")
            vals.append("application/pdf")

        if cols["meta_json"]:
            fields.append("meta_json")
            vals.append(json.dumps(meta or {}, ensure_ascii=False))

        if cols["created_at"]:
            fields.append("created_at")
            vals.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        if not fields:
            return

        placeholders = ",".join(["%s"] * len(fields))
        sql = f"INSERT INTO case_attachments ({','.join(fields)}) VALUES ({placeholders})"
        try:
            cur.execute(sql, tuple(vals))
        except Exception:
            return


# -----------------------------
# Scoring / insights
# -----------------------------
def _risk_score(stage: str, next_review_date: Optional[date]) -> int:
    st = (stage or "").strip().upper()
    score = 30
    if st in ("BLOCKED", "URGENT"):
        score = 85
    elif st in ("IN_TREATMENT", "ACTIVE"):
        score = 55
    elif st in ("CLOSED", "RESOLVED"):
        score = 10

    if next_review_date and next_review_date <= _today() and st not in ("CLOSED", "RESOLVED"):
        score = min(100, score + 20)
    return score


def _compute_compliance_score(next_review_date: Optional[date], missed_followups: int) -> int:
    # Simple heuristic: start at 90, penalize overdue + missed
    score = 90
    if next_review_date and next_review_date < _today():
        days = (_today() - next_review_date).days
        score -= min(40, days * 4)
    score -= min(40, missed_followups * 10)
    return max(0, min(100, score))


def _hash_case_snapshot(case_row: dict) -> str:
    payload = {
        "stage": case_row.get("stage"),
        "diagnosis": case_row.get("diagnosis"),
        "notes": case_row.get("notes"),
        "next_review_date": str(case_row.get("next_review_date") or ""),
        "case_type": case_row.get("case_type"),
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _get_last_snapshot_hash(conn, case_id: int) -> Optional[str]:
    with _cursor(conn) as cur:
        if not _table_exists(cur, "case_timeline"):
            return None
        if not _column_exists(cur, "case_timeline", "meta_json"):
            return None
        try:
            cur.execute(
                """
                SELECT meta_json
                FROM case_timeline
                WHERE case_id=%s AND event_type IN ('CASE_SNAPSHOT','CASE_UPDATED')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (case_id,),
            )
            row = cur.fetchone() or {}
            meta = _safe_json_loads(row.get("meta_json")) or {}
            if isinstance(meta, dict):
                return meta.get("snapshot_hash")
        except Exception:
            return None
    return None


def _update_case_insights(conn, case_id: int, insights: dict) -> None:
    """
    Store insights in cases.agent_insights_json if present; else just timeline.
    """
    with _cursor(conn) as cur:
        if not _table_exists(cur, "cases"):
            return
        sets: List[str] = []
        vals: List[Any] = []
        if _column_exists(cur, "cases", "agent_insights_json"):
            sets.append("agent_insights_json=%s")
            vals.append(json.dumps(insights, ensure_ascii=False))
        if _column_exists(cur, "cases", "risk_score") and insights.get("risk_score") is not None:
            sets.append("risk_score=%s")
            vals.append(int(insights.get("risk_score") or 0))
        if _column_exists(cur, "cases", "updated_at"):
            sets.append("updated_at=NOW()")

        if sets:
            vals.append(case_id)
            try:
                cur.execute(f"UPDATE cases SET {', '.join(sets)} WHERE id=%s", tuple(vals))
                return
            except Exception:
                pass

    # fallback: timeline
    _insert_timeline(
        conn,
        case_id=case_id,
        event_type="INSIGHTS_UPDATED",
        title="INSIGHTS_UPDATED",
        body="Case insights updated",
        meta={"insights": insights},
    )


# -----------------------------
# Patient auto-match (hooks)
# -----------------------------
def _resolve_patient_id(conn, payload: Dict[str, Any]) -> Optional[int]:
    """
    Best-effort patient identification using:
    - payload patientId
    - payload phone -> users.phone
    - payload name -> users.full_name (weak match)
    """
    pid = payload.get("patientId") or payload.get("patient_id")
    if pid:
        try:
            n = int(pid)
            if n > 0:
                return n
        except Exception:
            pass

    phone = payload.get("patientPhone") or payload.get("phone") or payload.get("mobile")
    name = payload.get("patientName") or payload.get("name")

    phone_norm = _digits_only(str(phone or ""))
    with _cursor(conn) as cur:
        if not _table_exists(cur, "users"):
            return None

        # Prefer phone exact match if users.phone exists
        if phone_norm and _column_exists(cur, "users", "phone"):
            try:
                cur.execute(
                    "SELECT id FROM users WHERE role='Patient' AND REPLACE(REPLACE(REPLACE(phone,' ',''),'+',''),'-','')=%s LIMIT 1",
                    (phone_norm,),
                )
                row = cur.fetchone()
                if row and row.get("id"):
                    return int(row["id"])
            except Exception:
                pass

        # Weak fallback: name match (avoid if too short)
        if name and _column_exists(cur, "users", "full_name"):
            nm = str(name).strip()
            if len(nm) >= 5:
                try:
                    cur.execute(
                        "SELECT id FROM users WHERE role='Patient' AND full_name LIKE %s LIMIT 1",
                        (f"%{nm}%",),
                    )
                    row = cur.fetchone()
                    if row and row.get("id"):
                        return int(row["id"])
                except Exception:
                    pass

    return None


def _get_recent_cases_for_patient(conn, patient_id: int, limit: int = 5) -> List[dict]:
    with _cursor(conn) as cur:
        if not _table_exists(cur, "cases"):
            return []
        cols = {
            "created_at": _column_exists(cur, "cases", "created_at"),
            "updated_at": _column_exists(cur, "cases", "updated_at"),
        }
        order_col = "updated_at" if cols["updated_at"] else ("created_at" if cols["created_at"] else "id")
        try:
            cur.execute(
                f"""
                SELECT id, stage, diagnosis, next_review_date, notes
                FROM cases
                WHERE patient_id=%s
                ORDER BY {order_col} DESC
                LIMIT %s
                """,
                (patient_id, int(limit)),
            )
            return cur.fetchall() or []
        except Exception:
            return []


# -----------------------------
# Approval-gated workflow handlers
# -----------------------------
def _flag_approval_required(conn, case_id: int, reason: str, meta: dict) -> None:
    """
    Sets cases.approval_required if present; always writes a timeline entry.
    """
    with _cursor(conn) as cur:
        if _table_exists(cur, "cases") and _column_exists(cur, "cases", "approval_required"):
            try:
                cur.execute("UPDATE cases SET approval_required=1, updated_at=NOW() WHERE id=%s", (case_id,))
            except Exception:
                pass

    _insert_timeline(
        conn,
        case_id=case_id,
        event_type="APPROVAL_REQUIRED",
        title="APPROVAL_REQUIRED",
        body=reason,
        meta=meta or {},
    )


def _store_pending_field(conn, case_id: int, field: str, value: Any) -> None:
    """
    Store pending changes safely if cases has a matching pending column.
    E.g. pending_stage, pending_treatment_json, pending_prescription_json
    """
    with _cursor(conn) as cur:
        if not _table_exists(cur, "cases"):
            return
        if _column_exists(cur, "cases", field):
            try:
                cur.execute(f"UPDATE cases SET {field}=%s, updated_at=NOW() WHERE id=%s", (value, case_id))
            except Exception:
                return


# -----------------------------
# Summaries & doc drafts
# -----------------------------
def _draft_summary(case_row: dict) -> dict:
    from ..ai import ai_json

    diagnosis = case_row.get("diagnosis") or case_row.get("diagnosis_text") or "Not specified"
    stage = case_row.get("stage") or "ACTIVE"
    notes = case_row.get("notes") or ""

    system_prompt = (
        "You are an expert dental case manager AI. "
        "Summarize the patient case status in 4-5 concise lines. "
        "Then provide 3 simple, actionable suggestions for the doctor. "
        "Keep the tone professional but simple."
    )
    user_prompt = (
        f"Case Data:\nDiagnosis: {diagnosis}\nStage: {stage}\nNotes: {notes}\n"
        "Generate a JSON response with keys: 'summary', 'recommendation', 'patient_explanation', 'confidence'."
    )
    
    schema_hint = (
        "{"
        "  'summary': '4-5 lines text',"
        "  'recommendation': 'Bullet points or clear steps',"
        "  'patient_explanation': 'Simple language for patient',"
        "  'confidence': 85"
        "}"
    )

    try:
        data = ai_json(system_prompt, user_prompt, schema_hint)
        if data and data.get("summary"):
            return {
                "summary": data.get("summary"),
                "recommendation": data.get("recommendation"),
                "patient_explanation": data.get("patient_explanation"),
                "signals": {
                    "has_notes": bool(notes),
                    "has_diagnosis": bool(case_row.get("diagnosis") or case_row.get("diagnosis_text")),
                },
                "confidence": data.get("confidence", 70),
            }
    except Exception:
        pass

    # Fallback if AI fails
    plan = [
        "Review diagnosis and confirm treatment plan.",
        "Verify required procedures and estimated duration.",
        "Ensure follow-up date is set and reminders are enabled.",
    ]
    patient_explain = (
        f"Your case is currently in '{stage}'. "
        f"Diagnosis noted: {diagnosis}. "
        f"Next steps will be confirmed by your doctor."
    )

    return {
        "summary": f"Draft case summary (pending doctor approval). Diagnosis: {diagnosis}. Stage: {stage}.",
        "recommendation": " | ".join(plan),
        "patient_explanation": patient_explain,
        "signals": {
            "has_notes": bool(notes),
            "has_diagnosis": bool(diagnosis and diagnosis != "Not specified"),
        },
        "confidence": 55,
    }


def _insert_case_summary(conn, case_id: int, summary: str, recommendation: str, confidence: int, meta: dict) -> None:
    with _cursor(conn) as cur:
        if not _table_exists(cur, "case_summaries"):
            return

        cols = {
            "case_id": _column_exists(cur, "case_summaries", "case_id"),
            "summary": _column_exists(cur, "case_summaries", "summary"),
            "recommendation": _column_exists(cur, "case_summaries", "recommendation"),
            "confidence": _column_exists(cur, "case_summaries", "confidence"),
            "status": _column_exists(cur, "case_summaries", "status"),
            "created_by_agent": _column_exists(cur, "case_summaries", "created_by_agent"),
            "meta_json": _column_exists(cur, "case_summaries", "meta_json"),
            "created_at": _column_exists(cur, "case_summaries", "created_at"),
        }

        fields: List[str] = []
        vals: List[Any] = []

        if cols["case_id"]:
            fields.append("case_id")
            vals.append(case_id)
        if cols["summary"]:
            fields.append("summary")
            vals.append(summary[:65535])
        if cols["recommendation"]:
            fields.append("recommendation")
            vals.append(recommendation[:65535])
        if cols["confidence"]:
            fields.append("confidence")
            vals.append(int(confidence))
        if cols["status"]:
            fields.append("status")
            vals.append("PENDING_REVIEW")
        if cols["created_by_agent"]:
            fields.append("created_by_agent")
            vals.append(1)
        if cols["meta_json"]:
            fields.append("meta_json")
            vals.append(json.dumps(meta or {}, ensure_ascii=False))
        if cols["created_at"]:
            fields.append("created_at")
            vals.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        if not fields:
            return

        placeholders = ",".join(["%s"] * len(fields))
        sql = f"INSERT INTO case_summaries ({','.join(fields)}) VALUES ({placeholders})"
        try:
            cur.execute(sql, tuple(vals))
        except Exception:
            return


def _get_latest_case_summary(conn, case_id: int) -> Optional[dict]:
    with _cursor(conn) as cur:
        if not _table_exists(cur, "case_summaries"):
            return None
        try:
            cur.execute(
                """
                SELECT summary, recommendation
                FROM case_summaries
                WHERE case_id=%s
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                """,
                (case_id,),
            )
            row = cur.fetchone()
            return row if row else None
        except Exception:
            return None


def _mirror_summary_to_case(conn, case_id: int, summary: str, recommendation: str) -> None:
    with _cursor(conn) as cur:
        if not _table_exists(cur, "cases"):
            return
        # Only update if columns exist
        sets: List[str] = []
        vals: List[Any] = []
        if _column_exists(cur, "cases", "agent_summary"):
            sets.append("agent_summary=%s")
            vals.append(summary[:65535])
        if _column_exists(cur, "cases", "agent_recommendation"):
            sets.append("agent_recommendation=%s")
            vals.append(recommendation[:65535])
        if _column_exists(cur, "cases", "approval_required"):
            sets.append("approval_required=1")
        if _column_exists(cur, "cases", "updated_at"):
            sets.append("updated_at=NOW()")

        if not sets:
            return
        vals.append(case_id)
        try:
            cur.execute(f"UPDATE cases SET {', '.join(sets)} WHERE id=%s", tuple(vals))
        except Exception:
            return


def _draft_docs_if_needed(conn, case_id: int, case_row: dict) -> None:
    """
    Generates lightweight, approval-gated documents:
      - consent form draft (if stage suggests surgery)
      - post-op instructions draft (if next review is set and stage is post-op-ish)

    Stores PDFs in a local folder if possible, and references them in case_attachments + timeline.
    """
    stage = str(case_row.get("stage") or "").upper()
    diagnosis = str(case_row.get("diagnosis") or case_row.get("diagnosis_text") or "Not specified")
    nrd = case_row.get("next_review_date")
    if isinstance(nrd, datetime):
        nrd = nrd.date()

    base_dir = os.getenv("EXPORT_DIR") or os.getenv("REPORTS_DIR") or os.path.join(os.getcwd(), "exports")
    case_dir = os.path.join(base_dir, "cases", f"case_{case_id}")

    # Consent (surgery/treatment change)
    if "SURG" in stage or "SURGERY" in stage:
        file_name = f"consent_case_{case_id}.pdf"
        file_path = os.path.join(case_dir, file_name)
        ok = _try_generate_pdf(
            file_path,
            "Dental Consent Form (Draft - Pending Doctor Approval)",
            [
                f"Case ID: {case_id}",
                f"Diagnosis: {diagnosis}",
                "This is a draft consent form generated by the system.",
                "Final consent must be reviewed and approved by the doctor.",
                "",
                "Key points:",
                "- Procedure details will be confirmed by the doctor.",
                "- Risks/benefits will be explained before signing.",
                "- Patient may ask questions at any time.",
            ],
        )
        if ok:
            _insert_attachment(
                conn,
                case_id=case_id,
                kind="CONSENT_FORM_DRAFT",
                file_name=file_name,
                file_path=file_path,
                meta={"status": "PENDING_REVIEW"},
            )
            _insert_timeline(
                conn,
                case_id=case_id,
                event_type="DOC_DRAFTED",
                title="Consent form drafted",
                body="Consent form draft generated (pending doctor approval).",
                meta={"doc": "CONSENT_FORM_DRAFT", "file": file_name},
            )
            _flag_approval_required(
                conn,
                case_id,
                reason="Consent form draft generated. Doctor approval required before use.",
                meta={"doc": "CONSENT_FORM_DRAFT"},
            )

    # Post-op instructions (if follow-up scheduled and stage indicates post-op/recovery)
    if nrd and ("POST" in stage or "RECOVERY" in stage or "HEAL" in stage):
        file_name = f"postop_case_{case_id}.pdf"
        file_path = os.path.join(case_dir, file_name)
        ok = _try_generate_pdf(
            file_path,
            "Post-Op Instructions (Draft - Pending Doctor Approval)",
            [
                f"Case ID: {case_id}",
                f"Next review date: {nrd}",
                "",
                "General instructions (draft):",
                "- Follow prescribed medications as directed.",
                "- Avoid hard foods for the recommended period.",
                "- Maintain oral hygiene as advised.",
                "- Contact the clinic if pain/swelling increases.",
                "",
                "Doctor approval required before sending to patient.",
            ],
        )
        if ok:
            _insert_attachment(
                conn,
                case_id=case_id,
                kind="POST_OP_INSTRUCTIONS_DRAFT",
                file_name=file_name,
                file_path=file_path,
                meta={"status": "PENDING_REVIEW"},
            )
            _insert_timeline(
                conn,
                case_id=case_id,
                event_type="DOC_DRAFTED",
                title="Post-op instructions drafted",
                body="Post-op instructions draft generated (pending doctor approval).",
                meta={"doc": "POST_OP_INSTRUCTIONS_DRAFT", "file": file_name},
            )
            _flag_approval_required(
                conn,
                case_id,
                reason="Post-op instructions draft generated. Doctor approval required before sending.",
                meta={"doc": "POST_OP_INSTRUCTIONS_DRAFT"},
            )


# -----------------------------
# Core handlers
# -----------------------------
def _fetch_case(conn, case_id: int) -> Optional[dict]:
    with _cursor(conn) as cur:
        _set_session_tz(cur)
        if not _table_exists(cur, "cases"):
            return None
        # Select only columns that likely exist; tolerate missing ones.
        cols = ["id", "patient_id", "doctor_id"]
        for c in ["stage", "diagnosis", "diagnosis_text", "next_review_date", "notes", "case_type", "created_at", "updated_at"]:
            if _column_exists(cur, "cases", c):
                cols.append(c)
        try:
            cur.execute(f"SELECT {', '.join(cols)} FROM cases WHERE id=%s", (case_id,))
            return cur.fetchone()
        except Exception:
            return None


def _on_case_updated_conn(conn, payload: Dict[str, Any]) -> None:
    case_id = int(payload.get("caseDbId") or payload.get("caseId") or 0)
    if not case_id:
        return

    case_row = _fetch_case(conn, case_id)
    if not case_row:
        return

    # timeline: update
    _insert_timeline(
        conn,
        case_id=case_id,
        event_type="CASE_UPDATED",
        title="Case updated",
        body="Case updated",
        meta={"payload": payload},
    )

    # change detection (compare snapshot hash vs last snapshot)
    current_hash = _hash_case_snapshot(case_row)
    last_hash = _get_last_snapshot_hash(conn, case_id)
    changed = bool(last_hash and last_hash != current_hash)

    # store snapshot (no schema change required)
    _insert_timeline(
        conn,
        case_id=case_id,
        event_type="CASE_SNAPSHOT",
        title="Case snapshot",
        body="Snapshot recorded",
        meta={"snapshot_hash": current_hash},
    )

    # Draft summary (approval-gated)
    draft = _draft_summary(case_row)
    _insert_case_summary(
        conn,
        case_id,
        summary=draft.get("summary") or "",
        recommendation=draft.get("recommendation") or "",
        confidence=int(draft.get("confidence") or 0),
        meta={"patient_explanation": draft.get("patient_explanation"), "signals": draft.get("signals")},
    )
    _mirror_summary_to_case(conn, case_id, draft.get("summary") or "", draft.get("recommendation") or "")

    # Insights
    nrd = case_row.get("next_review_date")
    if isinstance(nrd, datetime):
        nrd = nrd.date()
    st = str(case_row.get("stage") or "ACTIVE")
    risk = _risk_score(st, nrd if isinstance(nrd, date) else None)

    # Missed follow-ups: count timeline followup due alerts (simple heuristic)
    missed_followups = 0
    try:
        with _cursor(conn) as cur:
            if _table_exists(cur, "case_timeline") and _column_exists(cur, "case_timeline", "event_type"):
                cur.execute(
                    """
                    SELECT COUNT(1) AS c
                    FROM case_timeline
                    WHERE case_id=%s AND event_type='FOLLOWUP_DUE'
                    """,
                    (case_id,),
                )
                row = cur.fetchone() or {}
                missed_followups = int(row.get("c") or 0)
    except Exception:
        missed_followups = 0

    compliance = _compute_compliance_score(nrd if isinstance(nrd, date) else None, missed_followups)

    insights = {
        "risk_score": risk,
        "compliance_score": compliance,
        "on_track": True if not (isinstance(nrd, date) and nrd < _today()) else False,
        "expected_next_steps": [
            "Doctor review/approval pending for generated draft summary.",
            "Confirm next review date and ensure reminders are enabled.",
        ],
        "generated_at": _now().isoformat(),
    }
    _update_case_insights(conn, case_id, insights)

    # If notes/condition changed, alert doctor (health change detection)
    doctor_id = int(case_row.get("doctor_id") or 0) if case_row else 0
    patient_id = int(case_row.get("patient_id") or 0) if case_row else 0

    if changed and doctor_id:
        _insert_timeline(
            conn,
            case_id=case_id,
            event_type="CHANGE_DETECTED",
            title="Health/notes change detected",
            body="The case details changed compared to the previous snapshot.",
            meta={"prev_hash": last_hash, "new_hash": current_hash},
        )
        _notify_multi(
            conn=conn,
            user_id=doctor_id,
            user_role=None,
            title="Change Detected in Case",
            message=f"Case #{case_id} details changed (symptoms/notes/diagnosis). Please review.",
            notif_type="CASE_CHANGE_DETECTED",
            related_table="cases",
            related_id=case_id,
            priority_hint="HIGH",
            meta={"prev_hash": last_hash, "new_hash": current_hash},
        )

    # Doctor review needed (always)
    if doctor_id:
        _notify_multi(
            conn=conn,
            user_id=doctor_id,
            user_role=None,
            title="Case Review Needed",
            message=f"A draft summary was generated for Case #{case_id}. Please review and approve.",
            notif_type="CASE_REVIEW",
            related_table="cases",
            related_id=case_id,
            priority_hint="NORMAL",
            meta={"case_id": case_id},
        )

    # Follow-up due (doctor + patient)
    if isinstance(nrd, date) and nrd <= _today() and doctor_id:
        _insert_timeline(
            conn,
            case_id=case_id,
            event_type="FOLLOWUP_DUE",
            title="Follow-up due",
            body=f"Follow-up due (next review date: {nrd})",
            meta={"next_review_date": str(nrd)},
        )
        _notify_multi(
            conn=conn,
            user_id=doctor_id,
            user_role=None,
            title="Follow-up Due",
            message=f"Follow-up is due for Case #{case_id} (next review date: {nrd}).",
            notif_type="FOLLOWUP_DUE",
            related_table="cases",
            related_id=case_id,
            priority_hint="HIGH",
            meta={"next_review_date": str(nrd)},
        )
        if patient_id:
            _notify_multi(
                conn=conn,
                user_id=patient_id,
                user_role=None,
                title="Follow-up Reminder",
                message=f"Your follow-up is due for Case #{case_id}. Please schedule/confirm with the clinic.",
                notif_type="PATIENT_FOLLOWUP_DUE",
                related_table="cases",
                related_id=case_id,
                priority_hint="NORMAL",
                meta={"next_review_date": str(nrd)},
            )

    # Draft documents (consent/post-op) when applicable
    _draft_docs_if_needed(conn, case_id, case_row)


def _on_appointment_completed_conn(conn, payload: Dict[str, Any]) -> None:
    appt_id = int(payload.get("appointmentId") or 0)
    if not appt_id:
        return

    linked_case_id = payload.get("linkedCaseId")
    linked_case_id = int(linked_case_id) if linked_case_id not in (None, "", 0) else None

    with _cursor(conn) as cur:
        _set_session_tz(cur)
        if not _table_exists(cur, "appointments"):
            return

        cur.execute("SELECT id, linked_case_id FROM appointments WHERE id=%s", (appt_id,))
        appt = cur.fetchone()
        if not appt:
            return

        if not linked_case_id and appt.get("linked_case_id"):
            try:
                linked_case_id = int(appt["linked_case_id"])
            except Exception:
                linked_case_id = None

    if not linked_case_id:
        return

    _insert_timeline(
        conn,
        case_id=linked_case_id,
        event_type="VISIT_COMPLETED",
        title="Visit completed",
        body="Visit completed",
        meta={"appointment_id": appt_id},
    )


def _on_case_generate_summary_conn(conn, payload: Dict[str, Any]) -> None:
    """
    Consolidated summary across visits. Still approval-gated.
    Payload:
      { "caseId": int, "visitIds": [int]?, "requestedBy": int? }
    """
    case_id = int(payload.get("caseId") or payload.get("caseDbId") or 0)
    if not case_id:
        return

    visit_ids: Optional[List[int]] = None
    vlist = payload.get("visitIds") or payload.get("visitDbIds")
    if isinstance(vlist, list):
        ids = []
        for vid in vlist:
            try:
                n = int(vid)
                if n > 0:
                    ids.append(n)
            except Exception:
                continue
        if ids:
            visit_ids = ids

    case_row = _fetch_case(conn, case_id)
    if not case_row:
        return

    doctor_id = int(case_row.get("doctor_id") or 0)
    patient_id = int(case_row.get("patient_id") or 0)

    rows: List[dict] = []
    with _cursor(conn) as cur:
        _set_session_tz(cur)
        if not _table_exists(cur, "visits"):
            rows = []
        else:
            params: List[Any] = [case_id]
            extra = ""
            if visit_ids:
                extra = " AND v.id IN (" + ",".join(["%s"] * len(visit_ids)) + ")"
                params.extend(visit_ids)
            try:
                cur.execute(
                    """
                    SELECT v.id, v.started_at, v.ended_at, v.chief_complaint, v.clinical_notes,
                           v.diagnosis_text, v.procedures_json
                    FROM visits v
                    WHERE v.linked_case_id=%s
                    """
                    + extra
                    + " ORDER BY v.started_at ASC",
                    tuple(params),
                )
                rows = cur.fetchall() or []
            except Exception:
                rows = []

    notes_sections: List[str] = []
    procedures: List[str] = []

    for r in rows:
        parts: List[str] = []
        if r.get("chief_complaint"):
            parts.append(f"Complaint: {r.get('chief_complaint')}")
        if r.get("diagnosis_text"):
            parts.append(f"Diagnosis: {r.get('diagnosis_text')}")
        if r.get("clinical_notes"):
            parts.append(str(r.get("clinical_notes")))
        if parts:
            notes_sections.append(" | ".join(parts))

        pj = r.get("procedures_json")
        arr = _safe_json_loads(pj)
        if isinstance(arr, list):
            for it in arr:
                if isinstance(it, dict):
                    code = it.get("code") or it.get("procedure_code") or it.get("procedure_type")
                    if code:
                        procedures.append(str(code))

    if not notes_sections:
        # Fallback: use case metadata to avoid empty summaries
        info_bits = []
        stage = str(case_row.get("stage") or "").replace("_", " ").title()
        ctype = case_row.get("case_type") or case_row.get("diagnosis") or case_row.get("diagnosis_text")
        if ctype:
            info_bits.append(f"Case type: {ctype}")
        if stage:
            info_bits.append(f"Stage: {stage}")
        na = case_row.get("next_action")
        if na:
            info_bits.append(f"Next action: {na}")
        nrd = case_row.get("next_review_date")
        if nrd:
            info_bits.append(f"Next review date: {nrd}")
        notes_sections.append(" | ".join(info_bits) if info_bits else f"No visit notes available for case {case_id}.")

    uniq_procs = sorted(set([p.upper().replace("_", " ") for p in procedures if p]))

    # Clinical summary (doctor-facing)
    clinical_summary = "\n".join(notes_sections)
    if uniq_procs:
        clinical_summary += "\n\nProcedures involved: " + ", ".join(uniq_procs)

    # Patient-friendly explanation (simple, safe)
    sanitized_sections = [
        re.sub(r"\s+", " ", s).strip()[:180] for s in notes_sections[:6]
    ]
    patient_summary = "Summary of your recent visits:\n" + "\n".join(
        [f"- {s}" for s in sanitized_sections]
    )
    if uniq_procs:
        patient_summary += "\n\nPlanned/performed procedures: " + ", ".join(uniq_procs[:12])

    recommendation = "Review the treatment timeline, confirm next appointment, and schedule follow-ups as needed."

    # Skip inserting duplicates (same summary + recommendation as latest)
    last = _get_latest_case_summary(conn, case_id)
    if last and (last.get("summary") or "").strip() == clinical_summary.strip() and (last.get("recommendation") or "").strip() == recommendation.strip():
        return

    conf = 50
    n_vis = len(rows)
    if n_vis >= 3:
        conf = 85
    elif n_vis == 2:
        conf = 70
    elif n_vis == 1:
        conf = 60

    meta = {
        "visit_ids": visit_ids or [r.get("id") for r in rows if r.get("id")],
        "patient_explanation": patient_summary,
    }

    _insert_case_summary(conn, case_id, clinical_summary, recommendation, conf, meta)
    _mirror_summary_to_case(conn, case_id, clinical_summary, recommendation)

    _insert_timeline(
        conn,
        case_id=case_id,
        event_type="SUMMARY_GENERATED",
        title="AI summary generated",
        body="A consolidated AI summary was generated (pending doctor approval).",
        meta={"visit_ids": meta["visit_ids"]},
    )
    _flag_approval_required(
        conn,
        case_id,
        reason="Consolidated summary generated. Doctor approval required before it becomes final.",
        meta={"kind": "CASE_SUMMARY"},
    )

    if doctor_id:
        _notify_multi(
            conn=conn,
            user_id=doctor_id,
            user_role=None,
            title="AI Summary Ready",
            message=f"A new AI summary is ready for Case #{case_id}. Please review and approve.",
            notif_type="CASE_SUMMARY_READY",
            related_table="cases",
            related_id=case_id,
            priority_hint="NORMAL",
            meta={"case_id": case_id},
        )

    # Optional patient notification (in-app) that summary is being prepared (not final)
    if patient_id:
        _notify_multi(
            conn=conn,
            user_id=patient_id,
            user_role=None,
            title="Visit Summary Prepared",
            message=f"A summary for Case #{case_id} has been prepared and is awaiting doctor approval.",
            notif_type="PATIENT_SUMMARY_PENDING",
            related_table="cases",
            related_id=case_id,
            priority_hint="NORMAL",
            meta={"case_id": case_id},
        )


def _on_stage_transition_requested_conn(conn, payload: Dict[str, Any]) -> None:
    case_id = int(payload.get("caseId") or payload.get("caseDbId") or 0)
    requested_stage = (payload.get("requestedStage") or payload.get("toStage") or "").strip()
    reason = (payload.get("reason") or "Stage change requested").strip()
    if not case_id or not requested_stage:
        return

    case_row = _fetch_case(conn, case_id)
    if not case_row:
        return
    doctor_id = int(case_row.get("doctor_id") or 0)
    patient_id = int(case_row.get("patient_id") or 0)

    _store_pending_field(conn, case_id, "pending_stage", requested_stage)
    _flag_approval_required(
        conn,
        case_id,
        reason=f"Stage transition requested to '{requested_stage}'. Doctor approval required.",
        meta={"requested_stage": requested_stage, "reason": reason, "payload": payload},
    )
    _insert_timeline(
        conn,
        case_id=case_id,
        event_type="STAGE_CHANGE_REQUESTED",
        title="Stage change requested",
        body=f"Requested stage: {requested_stage}. Reason: {reason}",
        meta={"requested_stage": requested_stage, "reason": reason},
    )

    if doctor_id:
        _notify_multi(
            conn=conn,
            user_id=doctor_id,
            user_role=None,
            title="Approval Needed: Stage Transition",
            message=f"Case #{case_id} requested stage change to '{requested_stage}'. Reason: {reason}",
            notif_type="CASE_STAGE_APPROVAL",
            related_table="cases",
            related_id=case_id,
            priority_hint="HIGH",
            meta={"requested_stage": requested_stage},
        )

    # Inform patient that it's under review (no action required)
    if patient_id:
        _notify_multi(
            conn=conn,
            user_id=patient_id,
            user_role=None,
            title="Treatment Update Under Review",
            message=f"A treatment stage update for Case #{case_id} is pending doctor approval.",
            notif_type="PATIENT_STAGE_PENDING",
            related_table="cases",
            related_id=case_id,
            priority_hint="NORMAL",
            meta={"requested_stage": requested_stage},
        )


def _on_stage_transition_approved_conn(conn, payload: Dict[str, Any]) -> None:
    case_id = int(payload.get("caseId") or payload.get("caseDbId") or 0)
    approved_stage = (payload.get("approvedStage") or payload.get("toStage") or payload.get("stage") or "").strip()
    if not case_id:
        return

    # If stage not in payload, attempt to read from cases.pending_stage
    if not approved_stage:
        with _cursor(conn) as cur:
            if _table_exists(cur, "cases") and _column_exists(cur, "cases", "pending_stage"):
                cur.execute("SELECT pending_stage FROM cases WHERE id=%s", (case_id,))
                row = cur.fetchone() or {}
                approved_stage = str(row.get("pending_stage") or "").strip()

    if not approved_stage:
        return

    case_row = _fetch_case(conn, case_id)
    if not case_row:
        return

    doctor_id = int(case_row.get("doctor_id") or 0)
    patient_id = int(case_row.get("patient_id") or 0)

    # Apply stage
    with _cursor(conn) as cur:
        if _table_exists(cur, "cases") and _column_exists(cur, "cases", "stage"):
            sets = ["stage=%s"]
            vals: List[Any] = [approved_stage]
            if _column_exists(cur, "cases", "approval_required"):
                sets.append("approval_required=0")
            if _column_exists(cur, "cases", "pending_stage"):
                sets.append("pending_stage=NULL")
            if _column_exists(cur, "cases", "updated_at"):
                sets.append("updated_at=NOW()")
            vals.append(case_id)
            try:
                cur.execute(f"UPDATE cases SET {', '.join(sets)} WHERE id=%s", tuple(vals))
            except Exception:
                return

    _insert_timeline(
        conn,
        case_id=case_id,
        event_type="STAGE_CHANGE_APPROVED",
        title="Stage change approved",
        body=f"Stage updated to '{approved_stage}'.",
        meta={"approved_stage": approved_stage, "payload": payload},
    )

    if doctor_id:
        _notify_multi(
            conn=conn,
            user_id=doctor_id,
            user_role=None,
            title="Stage Updated",
            message=f"Case #{case_id} stage updated to '{approved_stage}'.",
            notif_type="CASE_STAGE_UPDATED",
            related_table="cases",
            related_id=case_id,
            priority_hint="NORMAL",
            meta={"approved_stage": approved_stage},
        )

    if patient_id:
        _notify_multi(
            conn=conn,
            user_id=patient_id,
            user_role=None,
            title="Treatment Stage Updated",
            message=f"Your Case #{case_id} stage has been updated to '{approved_stage}'.",
            notif_type="PATIENT_STAGE_UPDATED",
            related_table="cases",
            related_id=case_id,
            priority_hint="NORMAL",
            meta={"approved_stage": approved_stage},
        )


def _on_case_monitor_tick_conn(conn, payload: Dict[str, Any]) -> None:
    """
    Periodic monitor (e.g., worker enqueues daily):
      - follow-up due reminders
      - delayed progress alert
    Payload can include:
      { "daysAhead": 0|1|2 ... }
    """
    days_ahead = 0
    try:
        days_ahead = int(payload.get("daysAhead") or 0)
    except Exception:
        days_ahead = 0

    target_date = _today() + timedelta(days=days_ahead)

    with _cursor(conn) as cur:
        _set_session_tz(cur)
        if not _table_exists(cur, "cases"):
            return
        if not _column_exists(cur, "cases", "next_review_date"):
            return

        # Only active-ish stages
        stage_col = _column_exists(cur, "cases", "stage")
        where_stage = ""
        if stage_col:
            where_stage = " AND UPPER(COALESCE(stage,'')) NOT IN ('CLOSED','RESOLVED')"

        try:
            cur.execute(
                f"""
                SELECT id, patient_id, doctor_id, stage, next_review_date
                FROM cases
                WHERE next_review_date IS NOT NULL AND DATE(next_review_date) <= %s
                {where_stage}
                ORDER BY next_review_date ASC
                LIMIT 200
                """,
                (target_date.strftime("%Y-%m-%d"),),
            )
            due = cur.fetchall() or []
        except Exception:
            due = []

    for row in due:
        try:
            case_id = int(row.get("id") or 0)
            if not case_id:
                continue
            doctor_id = int(row.get("doctor_id") or 0)
            patient_id = int(row.get("patient_id") or 0)
            nrd = row.get("next_review_date")
            if isinstance(nrd, datetime):
                nrd = nrd.date()

            _insert_timeline(
                conn,
                case_id=case_id,
                event_type="FOLLOWUP_DUE",
                title="Follow-up due",
                body=f"Follow-up due (next review date: {nrd})",
                meta={"next_review_date": str(nrd), "monitor_tick": True},
            )

            if doctor_id:
                _notify_multi(
                    conn=conn,
                    user_id=doctor_id,
                    user_role=None,
                    title="Follow-up Due",
                    message=f"Follow-up is due for Case #{case_id} (next review date: {nrd}).",
                    notif_type="FOLLOWUP_DUE",
                    related_table="cases",
                    related_id=case_id,
                    priority_hint="HIGH",
                    meta={"next_review_date": str(nrd), "monitor_tick": True},
                )
            if patient_id:
                _notify_multi(
                    conn=conn,
                    user_id=patient_id,
                    user_role=None,
                    title="Follow-up Reminder",
                    message=f"Your follow-up for Case #{case_id} is due. Please contact the clinic.",
                    notif_type="PATIENT_FOLLOWUP_DUE",
                    related_table="cases",
                    related_id=case_id,
                    priority_hint="NORMAL",
                    meta={"next_review_date": str(nrd), "monitor_tick": True},
                )
        except Exception:
            continue


def _on_case_auto_match_requested_conn(conn, payload: Dict[str, Any]) -> None:
    """
    Hook event: tries to resolve patient and return candidate cases.
    Since agents are DB-only, we write candidates into timeline meta + notify doctor.

    Payload:
      { patientPhone/name/patientId, caseId? }
    """
    patient_id = _resolve_patient_id(conn, payload)
    if not patient_id:
        return

    candidates = _get_recent_cases_for_patient(conn, patient_id, limit=5)
    case_id = int(payload.get("caseId") or payload.get("caseDbId") or 0)

    # If a case_id is provided, store candidates against that case; else just notify doctor role-broadcast.
    if case_id:
        case_row = _fetch_case(conn, case_id)
        doctor_id = int(case_row.get("doctor_id") or 0) if case_row else 0
        _insert_timeline(
            conn,
            case_id=case_id,
            event_type="AUTO_MATCH",
            title="Auto-match candidates",
            body="Potential matching historical cases were found for this patient.",
            meta={"patient_id": patient_id, "candidates": candidates},
        )
        if doctor_id:
            _notify_multi(
                conn=conn,
                user_id=doctor_id,
                user_role=None,
                title="Patient History Auto-Match",
                message=f"Found {len(candidates)} previous case(s) for the patient. Review history for Case #{case_id}.",
                notif_type="PATIENT_HISTORY_MATCH",
                related_table="cases",
                related_id=case_id,
                priority_hint="NORMAL",
                meta={"patient_id": patient_id, "candidate_case_ids": [c.get('id') for c in candidates]},
            )
    else:
        # Role broadcast (Admin/Doctor) if supported by notifications.py
        _notify_multi(
            conn=conn,
            user_id=None,
            user_role="Doctor",
            title="Patient History Auto-Match",
            message=f"Found {len(candidates)} previous case(s) for patient_id={patient_id}.",
            notif_type="PATIENT_HISTORY_MATCH",
            related_table="cases",
            related_id=None,
            priority_hint="NORMAL",
            meta={"patient_id": patient_id, "candidate_case_ids": [c.get('id') for c in candidates]},
        )


# -----------------------------
# Public entrypoints (optional)
# -----------------------------
def on_case_updated(payload: Dict[str, Any]) -> None:
    conn = get_conn()
    try:
        conn.begin() if hasattr(conn, "begin") else conn.start_transaction()
        _on_case_updated_conn(conn, payload)
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass


def on_appointment_completed(payload: Dict[str, Any]) -> None:
    conn = get_conn()
    try:
        conn.begin() if hasattr(conn, "begin") else conn.start_transaction()
        _on_appointment_completed_conn(conn, payload)
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass


# -----------------------------
# Worker-facing dispatcher
# -----------------------------
class CaseTrackingAgent:
    """
    Supported event types (worker -> agent):
      - CaseUpdated
      - CaseGenerateSummary
      - AppointmentCompleted
      - CaseStageTransitionRequested
      - CaseStageTransitionApproved
      - CaseMonitorTick
      - CaseAutoMatchRequested

    Notes:
      - Approval gates are represented via cases.approval_required (if exists) + timeline entries,
        and any pending fields (pending_stage) if those columns exist.
      - Documents are drafted as PDFs only if ReportLab is available; otherwise it silently skips.
    """

    def handle(self, conn, event_type: str, event_id: int, payload: Dict[str, Any]) -> None:
        # Normalize (exact names matter in your outbox)
        et = (event_type or "").strip()

        try:
            if et == "CaseUpdated":
                _on_case_updated_conn(conn, payload)
                return

            if et == "CaseGenerateSummary":
                _on_case_generate_summary_conn(conn, payload)
                try:
                    conn.commit()
                except Exception:
                    pass
                return

            if et == "AppointmentCompleted":
                _on_appointment_completed_conn(conn, payload)
                return

            if et == "CaseStageTransitionRequested":
                _on_stage_transition_requested_conn(conn, payload)
                return

            if et == "CaseStageTransitionApproved":
                _on_stage_transition_approved_conn(conn, payload)
                return

            if et == "CaseMonitorTick":
                _on_case_monitor_tick_conn(conn, payload)
                return

            if et == "CaseAutoMatchRequested":
                _on_case_auto_match_requested_conn(conn, payload)
                return

            # Ignore unknown event types gracefully.
            return

        except Exception:
            # Never crash the worker loop without context; record a timeline row if possible.
            # (Worker should also mark the event FAILED and store last_error.)
            case_id = 0
            try:
                case_id = int(payload.get("caseId") or payload.get("caseDbId") or payload.get("caseDbID") or 0)
            except Exception:
                case_id = 0

            if case_id:
                _insert_timeline(
                    conn,
                    case_id=case_id,
                    event_type="AGENT_ERROR",
                    title="Case agent error",
                    body=f"Error handling {et}: {traceback.format_exc()[:8000]}",
                    meta={"event_type": et, "event_id": event_id},
                )
            raise
