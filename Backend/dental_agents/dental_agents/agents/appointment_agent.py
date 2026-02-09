# dental_agents/agents/appointment_agent.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone, time as dtime, date as ddate
from typing import Any, Dict, Optional, List, Tuple
import json

from ..db import get_conn
from ..notifications import create_notification


def _get_ist_tz():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo("Asia/Kolkata")
    except Exception:
        return timezone(timedelta(hours=5, minutes=30))


IST = _get_ist_tz()

def _now_str() -> str:
    return datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M:%S")

DEFAULT_DURATIONS_MIN = {
    "CONSULTATION": 20,
    "CHECKUP": 20,
    "SCALING": 45,
    "FILLING": 60,
    "EXTRACTION": 45,
    "ROOT_CANAL": 90,
    "IMPLANT": 120,
}

GRACE_MIN_DELAY = 10
GRACE_MIN_NO_SHOW = 45

# Default working hours (if you later want, you can read these from clinic_settings. Keep static for now.)
WORKDAY_START = dtime(9, 0)
WORKDAY_END = dtime(18, 0)

SLOT_STEP_MIN = 15
SUGGEST_DAYS_AHEAD = 7  # ✅ key fix: return alternatives across upcoming days (not just same day)
CASE_STAGE_HEALING = {
    "NEW": 0,
    "IN_TREATMENT": 3,
    "WAITING_ON_PATIENT": 7,
    "CLOSED": 0,
    "COMPLETED": 0,
}



# ---------------------------
# Dispatcher
# ---------------------------
class AppointmentAgent:
    def handle(self, conn, event_type: str, event_id: int, payload: Dict[str, Any]) -> None:
        if event_type == "AppointmentCreated":
            on_appointment_created(payload, conn=conn)
            return
        if event_type == "AppointmentCompleted":
            on_appointment_completed(payload, conn=conn)
            return
        if event_type in ("AppointmentMonitorTick", "AppointmentMonitorSweep"):
            appointment_monitor_sweep(conn=conn)
            return
        if event_type == "AppointmentAutoScheduleRequested":
            on_appointment_auto_schedule_requested(payload, conn=conn)
            return


# ---------------------------
# Utilities
# ---------------------------
def _norm_proc_type(s: Any) -> str:
    t = (str(s or "").strip().upper().replace("-", "_").replace(" ", "_")) or "CONSULTATION"
    return t[:50]


def _norm_status(s: Any) -> str:
    # ✅ key fix: normalize '-' too, and handle spelling variants
    t = str(s or "").strip().upper().replace("-", "_").replace(" ", "_")
    return t


def _is_final_status(status_norm: str) -> bool:
    # ✅ include both spellings
    return status_norm in ("CANCELLED", "CANCELED", "COMPLETED", "NO_SHOW")


def _case_stage_healing(stage: Optional[str]) -> int:
    if not stage:
        return 0
    return CASE_STAGE_HEALING.get(str(stage).upper(), 0)


def _get_case_stage(conn, case_id: int) -> Optional[str]:
    if not case_id:
        return None
    try:
        with conn.cursor() as cur:
            if not _table_exists(cur, "cases") or not _column_exists(cur, "cases", "stage"):
                return None
            cur.execute("SELECT stage FROM cases WHERE id=%s LIMIT 1", (int(case_id),))
            row = cur.fetchone()
            if not row:
                return None
            return row.get("stage") if isinstance(row, dict) else row[0]
    except Exception:
        return None


def _calculate_case_min_start(conn, case_id: int, reference_dt: Optional[datetime] = None) -> Optional[datetime]:
    if not case_id:
        return None
    stage = _get_case_stage(conn, case_id)
    delay = _case_stage_healing(stage)
    ref = reference_dt or datetime.now(tz=IST)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=IST)
    candidate = ref + timedelta(days=delay)
    now = datetime.now(tz=IST)
    return candidate if candidate >= now else now


def _parse_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val.astimezone(IST) if val.tzinfo else val.replace(tzinfo=IST)

    s = str(val).strip()
    if not s:
        return None

    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.astimezone(IST)
    except Exception:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=IST)
        except Exception:
            pass
    return None


def _combine_date_time(d: Any, t: Any) -> Optional[datetime]:
    if d is None or t is None:
        return None
    # mysql-connector can return TIME as datetime.timedelta
    if isinstance(t, timedelta):
        total_seconds = int(t.total_seconds())
        hours = (total_seconds // 3600) % 24
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        t = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    ds = str(d).strip()
    ts = str(t).strip()
    if not ds or not ts:
        return None
    for tfmt in ("%H:%M:%S", "%H:%M"):
        try:
            dt = datetime.strptime(f"{ds} {ts}", f"%Y-%m-%d {tfmt}")
            return dt.replace(tzinfo=IST)
        except Exception:
            pass
    return None


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


def _get_status_enum_values(cur) -> List[str]:
    try:
        cur.execute(
            """
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='status'
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            return []
        coltype = row["COLUMN_TYPE"] if isinstance(row, dict) else row[0]
        if not coltype or "enum(" not in coltype.lower():
            return []
        inside = coltype[coltype.find("(") + 1 : coltype.rfind(")")]
        vals = []
        for part in inside.split(","):
            p = part.strip().strip("'").strip('"')
            if p:
                vals.append(p)
        return vals
    except Exception:
        return []


def _pick_enum_value(enum_vals: List[str], desired: str) -> Optional[str]:
    if not desired:
        return None
    if not enum_vals:
        return desired
    want = desired.strip().lower().replace("_", " ").replace("-", " ")
    for v in enum_vals:
        vv = v.strip().lower().replace("_", " ").replace("-", " ")
        if vv == want:
            return v
    want2 = want.replace(" ", "")
    for v in enum_vals:
        vv2 = v.strip().lower().replace("_", " ").replace("-", " ").replace(" ", "")
        if vv2 == want2:
            return v
    return None


def _predict_duration_minutes(conn, procedure_type: str) -> int:
    proc = _norm_proc_type(procedure_type)
    try:
        with conn.cursor() as cur:
            if not _table_exists(cur, "visit_procedures"):
                return int(DEFAULT_DURATIONS_MIN.get(proc, 30))

            col = "procedure_code"
            try:
                cur.execute(
                    """
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='visit_procedures'
                          AND COLUMN_NAME IN ('procedure_code','procedure_type')
                    LIMIT 1
                    """
                )
                c = cur.fetchone()
                if c:
                    cname = c["COLUMN_NAME"] if isinstance(c, dict) else c[0]
                    if cname:
                        col = cname
            except Exception:
                pass

            cur.execute(
                f"""
                SELECT actual_duration_min
                FROM visit_procedures
                WHERE {col} = %s
                  AND actual_duration_min IS NOT NULL
                  AND actual_duration_min > 0
                ORDER BY actual_duration_min
                """,
                (proc,),
            )
            rows = cur.fetchall() or []
            vals: List[int] = []
            for r in rows:
                v = r["actual_duration_min"] if isinstance(r, dict) else r[0]
                if v:
                    vals.append(int(v))
            if len(vals) >= 5:
                vals.sort()
                mid = len(vals) // 2
                med = vals[mid] if len(vals) % 2 else (vals[mid - 1] + vals[mid]) // 2
                return max(10, min(int(med), 240))
    except Exception:
        pass

    return int(DEFAULT_DURATIONS_MIN.get(proc, 30))


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def _fetch_appt_datetime(appt_row: dict) -> Optional[datetime]:
    adt = _parse_dt(appt_row.get("appointment_datetime"))
    if adt:
        return adt
    return _combine_date_time(appt_row.get("scheduled_date"), appt_row.get("scheduled_time"))


def _fetch_appt_end_datetime(appt_row: dict, start_dt: Optional[datetime], duration_min: int) -> Optional[datetime]:
    if not start_dt:
        return None
    end_dt = _combine_date_time(appt_row.get("scheduled_date"), appt_row.get("scheduled_end_time"))
    if end_dt:
        return end_dt
    return start_dt + timedelta(minutes=int(duration_min))


def _write_audit(conn, appt_id: int, action: str, meta: dict) -> None:
    try:
        with conn.cursor() as cur:
            if not _table_exists(cur, "appointment_audit_logs"):
                return
            cur.execute(
                """
                INSERT INTO appointment_audit_logs (appointment_id, action, meta_json, created_at)
                VALUES (%s, %s, %s, NOW())
                """,
                (appt_id, (action or "")[:50], json.dumps(meta or {}, ensure_ascii=False)),
            )
    except Exception:
        pass


def _insert_reschedule_suggestion(
    conn,
    *,
    appt_id: int,
    reason: str,
    suggestions: List[Dict[str, Any]],
) -> None:
    try:
        with conn.cursor() as cur:
            if not _table_exists(cur, "appointment_reschedule_suggestions"):
                return

            if not _column_exists(cur, "appointment_reschedule_suggestions", "appointment_id"):
                return

            # Avoid duplicates if a pending suggestion already exists.
            if _column_exists(cur, "appointment_reschedule_suggestions", "status"):
                cur.execute(
                    """
                    SELECT id
                    FROM appointment_reschedule_suggestions
                    WHERE appointment_id=%s AND status='PENDING'
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (appt_id,),
                )
                if cur.fetchone():
                    return

            cols = ["appointment_id"]
            vals = [appt_id]

            if _column_exists(cur, "appointment_reschedule_suggestions", "reason"):
                cols.append("reason")
                vals.append((reason or "NO_SHOW")[:64])
            if _column_exists(cur, "appointment_reschedule_suggestions", "suggested_slots_json"):
                cols.append("suggested_slots_json")
                vals.append(json.dumps(suggestions or [], ensure_ascii=False))
            if _column_exists(cur, "appointment_reschedule_suggestions", "status"):
                cols.append("status")
                vals.append("PENDING")
            if _column_exists(cur, "appointment_reschedule_suggestions", "created_at"):
                cols.append("created_at")
                vals.append(_now_str())
            if _column_exists(cur, "appointment_reschedule_suggestions", "updated_at"):
                cols.append("updated_at")
                vals.append(_now_str())

            placeholders = ",".join(["%s"] * len(vals))
            cur.execute(
                f"INSERT INTO appointment_reschedule_suggestions ({','.join(cols)}) VALUES ({placeholders})",
                tuple(vals),
            )
    except Exception:
        pass


def _update_predicted_fields(conn, appt_id: int, duration_min: int, start_dt: Optional[datetime]) -> None:
    if not start_dt:
        return
    try:
        with conn.cursor() as cur:
            has_pred = _column_exists(cur, "appointments", "predicted_duration_min")
            has_end = _column_exists(cur, "appointments", "scheduled_end_time")
            has_updated = _column_exists(cur, "appointments", "updated_at")

            sets = []
            params: List[Any] = []
            if has_pred:
                sets.append("predicted_duration_min=%s")
                params.append(int(duration_min))
            if has_end:
                end_dt = start_dt + timedelta(minutes=int(duration_min))
                sets.append("scheduled_end_time=%s")
                params.append(end_dt.strftime("%H:%M:%S"))
            if has_updated:
                sets.append("updated_at=NOW()")

            if not sets:
                return

            params.append(appt_id)
            cur.execute(f"UPDATE appointments SET {', '.join(sets)} WHERE id=%s", tuple(params))
    except Exception:
        pass


def _set_status_if_possible(conn, appt_id: int, desired: str) -> None:
    try:
        with conn.cursor() as cur:
            enum_vals = _get_status_enum_values(cur)
            picked = _pick_enum_value(enum_vals, desired)
            if not picked:
                return

            has_updated = _column_exists(cur, "appointments", "updated_at")
            if has_updated:
                cur.execute("UPDATE appointments SET status=%s, updated_at=NOW() WHERE id=%s", (picked, appt_id))
            else:
                cur.execute("UPDATE appointments SET status=%s WHERE id=%s", (picked, appt_id))
    except Exception:
        pass


def _appt_select_cols(cur) -> List[str]:
    cols = ["id", "scheduled_date", "scheduled_time", "scheduled_end_time", "status", "predicted_duration_min"]
    if _column_exists(cur, "appointments", "appointment_datetime"):
        cols.append("appointment_datetime")
    if _column_exists(cur, "appointments", "operatory_id"):
        cols.append("operatory_id")
    return cols


def _detect_conflicts(
    conn,
    appt_id: int,
    doctor_id: int,
    start_dt: datetime,
    end_dt: datetime,
    operatory_id: Optional[int],
) -> List[dict]:
    conflicts: List[dict] = []
    with conn.cursor() as cur:
        select_cols = _appt_select_cols(cur)
        col_sql = ", ".join(select_cols)

        cur.execute(
            f"""
            SELECT {col_sql}
            FROM appointments
            WHERE doctor_id=%s
              AND id<>%s
            """,
            (doctor_id, appt_id),
        )
        rows = cur.fetchall() or []
        for row in rows:
            status_norm = _norm_status(row.get("status"))
            if _is_final_status(status_norm):
                continue
            s = _fetch_appt_datetime(row)
            if not s:
                continue
            dur = int(row.get("predicted_duration_min") or 0) or 30
            e = _fetch_appt_end_datetime(row, s, dur)
            if e and _overlaps(start_dt, end_dt, s, e):
                conflicts.append(
                    {
                        "type": "DOCTOR",
                        "with_appointment_id": int(row["id"]),
                        "at": s.isoformat(),
                        "status": row.get("status"),
                    }
                )

        # Operatory conflicts only if operatory_id and column exists
        if operatory_id and _column_exists(cur, "appointments", "operatory_id"):
            cur.execute(
                f"""
                SELECT {col_sql}
                FROM appointments
                WHERE operatory_id=%s
                  AND id<>%s
                """,
                (operatory_id, appt_id),
            )
            rows2 = cur.fetchall() or []
            for row in rows2:
                status_norm = _norm_status(row.get("status"))
                if _is_final_status(status_norm):
                    continue
                s = _fetch_appt_datetime(row)
                if not s:
                    continue
                dur = int(row.get("predicted_duration_min") or 0) or 30
                e = _fetch_appt_end_datetime(row, s, dur)
                if e and _overlaps(start_dt, end_dt, s, e):
                    conflicts.append(
                        {
                            "type": "OPERATORY",
                            "with_appointment_id": int(row["id"]),
                            "at": s.isoformat(),
                            "status": row.get("status"),
                        }
                    )
    return conflicts


def _collect_busy_windows_for_day(
    conn,
    *,
    day: ddate,
    doctor_id: int,
    operatory_id: Optional[int],
    exclude_appt_id: Optional[int] = None,
) -> List[Tuple[datetime, datetime]]:
    busy: List[Tuple[datetime, datetime]] = []
    with conn.cursor() as cur:
        select_cols = ["id", "scheduled_date", "scheduled_time", "scheduled_end_time", "predicted_duration_min", "status", "doctor_id"]
        if _column_exists(cur, "appointments", "appointment_datetime"):
            select_cols.append("appointment_datetime")
        if _column_exists(cur, "appointments", "operatory_id"):
            select_cols.append("operatory_id")

        col_sql = ", ".join(select_cols)

        # ✅ Pull both doctor and operatory blocks (if operatory_id available)
        where = ["scheduled_date=%s"]
        params: List[Any] = [day.strftime("%Y-%m-%d")]

        blocks = ["doctor_id=%s"]
        params.append(doctor_id)

        if operatory_id and _column_exists(cur, "appointments", "operatory_id"):
            blocks.append("operatory_id=%s")
            params.append(operatory_id)

        where.append(f"({ ' OR '.join(blocks) })")

        if exclude_appt_id:
            where.append("id<>%s")
            params.append(int(exclude_appt_id))

        cur.execute(
            f"""
            SELECT {col_sql}
            FROM appointments
            WHERE {' AND '.join(where)}
            """,
            tuple(params),
        )

        rows = cur.fetchall() or []
        for row in rows:
            status_norm = _norm_status(row.get("status"))
            if _is_final_status(status_norm):
                continue

            s = _fetch_appt_datetime(row)
            if not s:
                continue

            dur = int(row.get("predicted_duration_min") or 0) or 30
            e = _fetch_appt_end_datetime(row, s, dur)
            if e:
                busy.append((s, e))

    busy.sort(key=lambda x: x[0])
    return busy


def _suggest_slots(
    conn,
    *,
    doctor_id: int,
    target_date: str,
    duration_min: int,
    operatory_id: Optional[int] = None,
    exclude_appt_id: Optional[int] = None,
    limit: int = 10,
    days_ahead: int = SUGGEST_DAYS_AHEAD,
    start_time: Optional[str] = None,
    min_start_dt: Optional[datetime] = None,
) -> List[dict]:
    """
    ✅ Key behavior:
    - Searches target_date first
    - If none, searches next N days until it finds slots
    - Never suggests past times for today
    """
    try:
        base_day = datetime.strptime(str(target_date)[:10], "%Y-%m-%d").date()
    except Exception:
        base_day = datetime.now(tz=IST).date()

    now = datetime.now(tz=IST)

    out: List[dict] = []

    start_time_dt: Optional[dtime] = None
    if start_time:
        st = str(start_time).strip()
        for tfmt in ("%H:%M:%S", "%H:%M"):
            try:
                start_time_dt = datetime.strptime(st, tfmt).time()
                break
            except Exception:
                pass

    for day_offset in range(0, max(0, int(days_ahead)) + 1):
        day = base_day + timedelta(days=day_offset)
        if min_start_dt and day < min_start_dt.date():
            continue
        start_of_day = datetime.combine(day, WORKDAY_START).replace(tzinfo=IST)
        end_of_day = datetime.combine(day, WORKDAY_END).replace(tzinfo=IST)

        busy = _collect_busy_windows_for_day(
            conn,
            day=day,
            doctor_id=doctor_id,
            operatory_id=operatory_id,
            exclude_appt_id=exclude_appt_id,
        )

        def is_free(candidate_start: datetime) -> bool:
            candidate_end = candidate_start + timedelta(minutes=int(duration_min))
            if candidate_end > end_of_day:
                return False

            # ✅ don't suggest in the past (for today)
            if day == now.date() and candidate_start < (now + timedelta(minutes=2)):
                return False

            if min_start_dt and candidate_start < min_start_dt:
                return False

            for bs, be in busy:
                if _overlaps(candidate_start, candidate_end, bs, be):
                    return False
            return True

        cur_time = start_of_day
        if day_offset == 0 and start_time_dt:
            cur_time = max(cur_time, datetime.combine(day, start_time_dt).replace(tzinfo=IST))
        step = timedelta(minutes=SLOT_STEP_MIN)

        while cur_time + timedelta(minutes=int(duration_min)) <= end_of_day and len(out) < limit:
            if is_free(cur_time):
                out.append(
                    {
                        "date": day.strftime("%Y-%m-%d"),
                        "startTime": cur_time.strftime("%H:%M:%S"),
                        "endTime": (cur_time + timedelta(minutes=int(duration_min))).strftime("%H:%M:%S"),
                        "predictedDurationMin": int(duration_min),
                    }
                )
            cur_time += step

        # ✅ if we found at least 1 day worth, stop (don’t mix many days unless needed)
        if out:
            break

    return out


def _get_user_name(conn, user_id: int) -> Optional[str]:
    if not user_id:
        return None
    try:
        with conn.cursor() as cur:
            if not _table_exists(cur, "users"):
                return None
            for col in ("full_name", "name", "username", "email"):
                if _column_exists(cur, "users", col):
                    cur.execute(f"SELECT {col} FROM users WHERE id=%s LIMIT 1", (int(user_id),))
                    r = cur.fetchone()
                    if r:
                        v = r.get(col) if isinstance(r, dict) else r[0]
                        if v:
                            return str(v)
    except Exception:
        return None
    return None


def _notify_admins(
    *,
    title: str,
    message: str,
    notif_type: str,
    related_id: int,
    meta: Optional[Dict[str, Any]] = None,
    scheduled_at: Optional[datetime] = None,
    dedupe_key: Optional[str] = None,
    priority: int = 120,
) -> None:
    create_notification(
        user_id=None,
        user_role="Admin",
        title=title,
        message=message,
        notif_type=notif_type,
        related_table="appointments",
        related_id=related_id,
        meta=meta,
        scheduled_at=scheduled_at,
        status="PENDING",
        priority=priority,
        dedupe_key=dedupe_key,
        conn=None,
    )


# ---------------------------
# Handlers
# ---------------------------
def on_appointment_created(payload: Dict[str, Any], conn=None) -> None:
    appt_id = int(payload.get("appointmentId") or 0)
    if not appt_id:
        return

    owns_conn = conn is None
    if owns_conn:
        conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM appointments WHERE id=%s", (appt_id,))
            appt_row = cur.fetchone()
            if not appt_row:
                conn.commit()
                return

            patient_id = int(appt_row.get("patient_id") or payload.get("patientId") or 0)
            doctor_id = int(appt_row.get("doctor_id") or payload.get("doctorId") or 0)
            appt_type = appt_row.get("type") or payload.get("type") or "CONSULTATION"

            linked_case_id = int(
                appt_row.get("linked_case_id")
                or payload.get("linkedCaseId")
                or payload.get("caseId")
                or payload.get("case_id")
                or 0
            )

            operatory_id = appt_row.get("operatory_id") or payload.get("operatoryId") or payload.get("operatoryRoomId")
            operatory_id = int(operatory_id) if operatory_id not in (None, "", 0) else None

            start_dt = _fetch_appt_datetime(appt_row) or _parse_dt(payload.get("appointmentDateTime"))
            if not start_dt:
                start_dt = _combine_date_time(payload.get("date"), payload.get("time"))

            dur_min = _predict_duration_minutes(conn, appt_type)
            end_dt = (start_dt + timedelta(minutes=dur_min)) if start_dt else None

            # Treatment-linked: enforce healing window if tied to a case
            min_start_dt = _calculate_case_min_start(conn, linked_case_id, start_dt)
            if min_start_dt and start_dt and start_dt < min_start_dt:
                start_dt = min_start_dt
                end_dt = start_dt + timedelta(minutes=dur_min)

            _update_predicted_fields(conn, appt_id, dur_min, start_dt)

            conflicts: List[dict] = []
            if start_dt and end_dt and doctor_id:
                conflicts = _detect_conflicts(conn, appt_id, doctor_id, start_dt, end_dt, operatory_id)

            if not conflicts:
                _set_status_if_possible(conn, appt_id, "Confirmed")

            _write_audit(
                conn,
                appt_id,
                "CREATED",
                {"source": "python_agent", "predicted_duration_min": dur_min, "conflicts": conflicts},
            )

        conn.commit()

        if start_dt:
            pretty = start_dt.strftime("%d %b %Y, %I:%M %p")
            p_name = _get_user_name(conn, patient_id) or (f"Patient#{patient_id}" if patient_id else "Patient")
            d_name = _get_user_name(conn, doctor_id) or (f"Doctor#{doctor_id}" if doctor_id else "Doctor")

            final_status = "Confirmed" if not conflicts else "Requested"

            if patient_id:
                create_notification(
                    user_id=patient_id,
                    title="Appointment Scheduled",
                    message=f"Your appointment is scheduled at {pretty}.",
                    notif_type="APPOINTMENT_SCHEDULED",
                    related_table="appointments",
                    related_id=appt_id,
                    meta={"finalStatus": final_status},
                    status="PENDING",
                    channel="IN_APP",
                    priority=100,
                    dedupe_key=f"appt:{appt_id}:patient:scheduled",
                    conn=None,
                )

            if doctor_id:
                create_notification(
                    user_id=doctor_id,
                    title="New Appointment",
                    message=f"New appointment at {pretty} (Type: {appt_type}).",
                    notif_type="APPOINTMENT_SCHEDULED",
                    related_table="appointments",
                    related_id=appt_id,
                    meta={"finalStatus": final_status},
                    status="PENDING",
                    channel="IN_APP",
                    priority=110,
                    dedupe_key=f"appt:{appt_id}:doctor:scheduled",
                    conn=None,
                )

            _notify_admins(
                title="New Appointment Created",
                message=f"{p_name} booked with {d_name} at {pretty}. Status: {final_status}.",
                notif_type="APPOINTMENT_SCHEDULED",
                related_id=appt_id,
                meta={"finalStatus": final_status, "patientId": patient_id, "doctorId": doctor_id},
                dedupe_key=f"appt:{appt_id}:admin:created",
                priority=115,
            )

            if conflicts and doctor_id:
                suggestions = _suggest_slots(
                    conn,
                    doctor_id=doctor_id,
                    target_date=start_dt.strftime("%Y-%m-%d"),
                    duration_min=dur_min,
                    operatory_id=operatory_id,
                    exclude_appt_id=appt_id,
                    limit=10,
                    days_ahead=SUGGEST_DAYS_AHEAD,
                    start_time=start_dt.strftime("%H:%M:%S"),
                    min_start_dt=min_start_dt,
                )

                create_notification(
                    user_id=doctor_id,
                    title="Appointment Conflict Detected",
                    message=f"Appointment #{appt_id} overlaps with existing booking(s). Suggested alternatives are available.",
                    notif_type="APPOINTMENT_CONFLICT",
                    related_table="appointments",
                    related_id=appt_id,
                    meta={"conflicts": conflicts, "suggestedSlots": suggestions},
                    status="PENDING",
                    channel="IN_APP",
                    priority=140,
                    dedupe_key=f"appt:{appt_id}:doctor:conflict",
                    conn=None,
                )

                _notify_admins(
                    title="Appointment Conflict Detected",
                    message=f"Conflict for Appointment #{appt_id} ({pretty}) with {d_name}. Check alternatives.",
                    notif_type="APPOINTMENT_CONFLICT",
                    related_id=appt_id,
                    meta={"conflicts": conflicts, "suggestedSlots": suggestions, "doctorId": doctor_id},
                    dedupe_key=f"appt:{appt_id}:admin:conflict",
                    priority=145,
                )

            now = datetime.now(tz=IST)
            for hrs, label in [(24, "24h"), (2, "2h")]:
                when = start_dt - timedelta(hours=hrs)
                if when > now:
                    if patient_id:
                        create_notification(
                            user_id=patient_id,
                            title=f"Appointment Reminder ({label})",
                            message=f"Your dental appointment is scheduled at {pretty}.",
                            notif_type="APPOINTMENT_REMINDER",
                            related_table="appointments",
                            related_id=appt_id,
                            scheduled_at=when,
                            status="PENDING",
                            channel="IN_APP",
                            priority=90,
                            dedupe_key=f"appt:{appt_id}:patient:reminder:{label}",
                            conn=None,
                        )
                    if doctor_id:
                        create_notification(
                            user_id=doctor_id,
                            title=f"Upcoming Appointment ({label})",
                            message=f"Patient appointment at {pretty} (Type: {appt_type}).",
                            notif_type="APPOINTMENT_REMINDER",
                            related_table="appointments",
                            related_id=appt_id,
                            scheduled_at=when,
                            status="PENDING",
                            channel="IN_APP",
                            priority=95,
                            dedupe_key=f"appt:{appt_id}:doctor:reminder:{label}",
                            conn=None,
                        )

    finally:
        if owns_conn:
            try:
                conn.close()
            except Exception:
                pass


def appointment_monitor_sweep(conn=None) -> None:
    owns_conn = conn is None
    if owns_conn:
        conn = get_conn()

    try:
        with conn.cursor() as cur:
            today = datetime.now(tz=IST).date().strftime("%Y-%m-%d")
            cur.execute("SELECT * FROM appointments WHERE scheduled_date=%s", (today,))
            rows = cur.fetchall() or []

        now = datetime.now(tz=IST)

        for appt in rows:
            status_norm = _norm_status(appt.get("status"))
            if _is_final_status(status_norm):
                continue

            appt_id = int(appt.get("id") or 0)
            patient_id = int(appt.get("patient_id") or 0)
            doctor_id = int(appt.get("doctor_id") or 0)

            start_dt = _fetch_appt_datetime(appt)
            if not start_dt:
                continue

            # No-show
            if now > start_dt + timedelta(minutes=GRACE_MIN_NO_SHOW):
                _set_status_if_possible(conn, appt_id, "No-show")
                _write_audit(conn, appt_id, "NO_SHOW", {"source": "python_agent"})
                conn.commit()

                # Generate reschedule suggestions for admin review (complex workflow)
                try:
                    appt_type = appt.get("type") or "CONSULTATION"
                    dur_min = int(appt.get("predicted_duration_min") or 0) or _predict_duration_minutes(conn, appt_type)
                    suggestions = []
                    if doctor_id:
                        suggestions = _suggest_slots(
                            conn,
                            doctor_id=doctor_id,
                            target_date=start_dt.strftime("%Y-%m-%d"),
                            duration_min=dur_min,
                            operatory_id=appt.get("operatory_id"),
                            exclude_appt_id=appt_id,
                            limit=8,
                            days_ahead=SUGGEST_DAYS_AHEAD,
                            start_time=start_dt.strftime("%H:%M:%S"),
                        )
                    if suggestions:
                        _insert_reschedule_suggestion(
                            conn,
                            appt_id=appt_id,
                            reason="NO_SHOW",
                            suggestions=suggestions,
                        )
                        conn.commit()
                except Exception:
                    pass

                if patient_id:
                    create_notification(
                        user_id=patient_id,
                        title="Missed Appointment",
                        message="You missed your appointment. Please reschedule if needed.",
                        notif_type="APPOINTMENT_NO_SHOW",
                        related_table="appointments",
                        related_id=appt_id,
                        status="PENDING",
                        channel="IN_APP",
                        priority=150,
                        dedupe_key=f"appt:{appt_id}:patient:noshow",
                        conn=None,
                    )
                if doctor_id:
                    create_notification(
                        user_id=doctor_id,
                        title="No-show Alert",
                        message=f"Patient did not arrive for Appointment #{appt_id}.",
                        notif_type="APPOINTMENT_NO_SHOW",
                        related_table="appointments",
                        related_id=appt_id,
                        status="PENDING",
                        channel="IN_APP",
                        priority=155,
                        dedupe_key=f"appt:{appt_id}:doctor:noshow",
                        conn=None,
                    )

                _notify_admins(
                    title="No-show Alert",
                    message=f"No-show for Appointment #{appt_id}. Please reschedule/confirm with patient.",
                    notif_type="APPOINTMENT_NO_SHOW",
                    related_id=appt_id,
                    meta={"patientId": patient_id, "doctorId": doctor_id},
                    dedupe_key=f"appt:{appt_id}:admin:noshow",
                    priority=160,
                )
                continue

            # Delay (notify once via dedupe_key)
            if now > start_dt + timedelta(minutes=GRACE_MIN_DELAY):
                if doctor_id:
                    create_notification(
                        user_id=doctor_id,
                        title="Appointment Running Late",
                        message=f"Appointment #{appt_id} appears delayed (scheduled {start_dt.strftime('%H:%M')}).",
                        notif_type="APPOINTMENT_DELAY",
                        related_table="appointments",
                        related_id=appt_id,
                        status="PENDING",
                        channel="IN_APP",
                        priority=130,
                        dedupe_key=f"appt:{appt_id}:doctor:delay",
                        conn=None,
                    )
                _notify_admins(
                    title="Appointment Delay",
                    message=f"Appointment #{appt_id} appears delayed (scheduled {start_dt.strftime('%H:%M')}).",
                    notif_type="APPOINTMENT_DELAY",
                    related_id=appt_id,
                    meta={"doctorId": doctor_id},
                    dedupe_key=f"appt:{appt_id}:admin:delay",
                    priority=135,
                )

    finally:
        if owns_conn:
            try:
                conn.close()
            except Exception:
                pass


def on_appointment_completed(payload: Dict[str, Any], conn=None) -> None:
    appt_id = int(payload.get("appointmentId") or 0)
    if not appt_id:
        return

    owns_conn = conn is None
    if owns_conn:
        conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM appointments WHERE id=%s", (appt_id,))
            appt = cur.fetchone()
            if not appt:
                conn.commit()
                return

            patient_id = int(appt.get("patient_id") or 0)
            doctor_id = int(appt.get("doctor_id") or 0)

            _write_audit(conn, appt_id, "COMPLETED", {"source": "python_agent"})
        conn.commit()

        if patient_id:
            create_notification(
                user_id=patient_id,
                title="Appointment Completed",
                message="Your appointment is marked as completed. Billing and follow-ups (if any) will be updated shortly.",
                notif_type="APPOINTMENT_COMPLETED",
                related_table="appointments",
                related_id=appt_id,
                status="PENDING",
                channel="IN_APP",
                priority=120,
                dedupe_key=f"appt:{appt_id}:patient:completed",
                conn=None,
            )

        if doctor_id:
            create_notification(
                user_id=doctor_id,
                title="Appointment Completed",
                message=f"Appointment #{appt_id} marked completed.",
                notif_type="APPOINTMENT_COMPLETED",
                related_table="appointments",
                related_id=appt_id,
                status="PENDING",
                channel="IN_APP",
                priority=120,
                dedupe_key=f"appt:{appt_id}:doctor:completed",
                conn=None,
            )

        _notify_admins(
            title="Appointment Completed",
            message=f"Appointment #{appt_id} marked completed. Billing/visit processing can proceed.",
            notif_type="APPOINTMENT_COMPLETED",
            related_id=appt_id,
            meta={"doctorId": doctor_id, "patientId": patient_id},
            dedupe_key=f"appt:{appt_id}:admin:completed",
            priority=125,
        )

    finally:
        if owns_conn:
            try:
                conn.close()
            except Exception:
                pass


def on_appointment_auto_schedule_requested(payload: Dict[str, Any], conn=None) -> None:
    """
    Optional workflow event:
    - Finds first available slot (today+next days)
    - Updates appointment scheduled_date/scheduled_time (+ scheduled_end_time if present)
    - Notifies patient/doctor/admin
    """
    appt_id = int(payload.get("appointmentId") or 0)
    if not appt_id:
        return

    days_ahead = int(payload.get("daysAhead") or SUGGEST_DAYS_AHEAD)
    limit = int(payload.get("limit") or 10)

    owns_conn = conn is None
    if owns_conn:
        conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM appointments WHERE id=%s", (appt_id,))
            appt = cur.fetchone()
            if not appt:
                conn.commit()
                return

            doctor_id = int(appt.get("doctor_id") or 0)
            patient_id = int(appt.get("patient_id") or 0)
            appt_type = appt.get("type") or "CONSULTATION"
            operatory_id = appt.get("operatory_id")
            operatory_id = int(operatory_id) if operatory_id not in (None, "", 0) else None
            linked_case_id = int(
                appt.get("linked_case_id")
                or payload.get("linkedCaseId")
                or payload.get("caseId")
                or payload.get("case_id")
                or 0
            )

            # Start from existing date if present; else today
            base_date = str(appt.get("scheduled_date") or "")[:10] or datetime.now(tz=IST).strftime("%Y-%m-%d")

            dur_min = int(appt.get("predicted_duration_min") or 0) or _predict_duration_minutes(conn, appt_type)

            min_start_dt = _calculate_case_min_start(conn, linked_case_id, _fetch_appt_datetime(appt))

            suggestions = _suggest_slots(
                conn,
                doctor_id=doctor_id,
                target_date=base_date,
                duration_min=dur_min,
                operatory_id=operatory_id,
                exclude_appt_id=appt_id,
                limit=limit,
                days_ahead=days_ahead,
                min_start_dt=min_start_dt,
            )

            if not suggestions:
                _write_audit(conn, appt_id, "AUTO_SCHEDULE_FAILED", {"reason": "no_slots", "daysAhead": days_ahead})
                conn.commit()
                return

            chosen = suggestions[0]
            new_date = chosen["date"]
            new_time = chosen["startTime"]
            new_end = chosen["endTime"]

            sets = ["scheduled_date=%s", "scheduled_time=%s"]
            params: List[Any] = [new_date, new_time]

            if _column_exists(cur, "appointments", "scheduled_end_time"):
                sets.append("scheduled_end_time=%s")
                params.append(new_end)

            if _column_exists(cur, "appointments", "predicted_duration_min"):
                sets.append("predicted_duration_min=%s")
                params.append(int(dur_min))

            if _column_exists(cur, "appointments", "updated_at"):
                sets.append("updated_at=NOW()")

            params.append(appt_id)
            cur.execute(f"UPDATE appointments SET {', '.join(sets)} WHERE id=%s", tuple(params))

            _set_status_if_possible(conn, appt_id, "Confirmed")
            _write_audit(conn, appt_id, "AUTO_SCHEDULED", {"chosen": chosen, "candidates": suggestions})

        conn.commit()

        pretty = _combine_date_time(new_date, new_time).strftime("%d %b %Y, %I:%M %p")
        if patient_id:
            create_notification(
                user_id=patient_id,
                title="Appointment Rescheduled",
                message=f"Your appointment has been auto-rescheduled to {pretty}.",
                notif_type="APPOINTMENT_RESCHEDULED",
                related_table="appointments",
                related_id=appt_id,
                meta={"newSlot": chosen, "auto": True},
                status="PENDING",
                channel="IN_APP",
                priority=140,
                dedupe_key=f"appt:{appt_id}:patient:autoscheduled",
                conn=None,
            )

        if doctor_id:
            create_notification(
                user_id=doctor_id,
                title="Appointment Rescheduled",
                message=f"Appointment #{appt_id} was auto-rescheduled to {pretty}.",
                notif_type="APPOINTMENT_RESCHEDULED",
                related_table="appointments",
                related_id=appt_id,
                meta={"newSlot": chosen, "auto": True},
                status="PENDING",
                channel="IN_APP",
                priority=145,
                dedupe_key=f"appt:{appt_id}:doctor:autoscheduled",
                conn=None,
            )

        _notify_admins(
            title="Appointment Auto-Rescheduled",
            message=f"Appointment #{appt_id} auto-rescheduled to {pretty}.",
            notif_type="APPOINTMENT_RESCHEDULED",
            related_id=appt_id,
            meta={"newSlot": chosen, "auto": True, "doctorId": doctor_id, "patientId": patient_id},
            dedupe_key=f"appt:{appt_id}:admin:autoscheduled",
            priority=150,
        )

    finally:
        if owns_conn:
            try:
                conn.close()
            except Exception:
                pass
