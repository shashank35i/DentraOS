# dental_agents/worker.py
from __future__ import annotations

import os
import sys
import time
import traceback
from typing import Any, Dict, Optional

from . import config as _config  # loads .env for INVENTORY_PO_AUTO and DB settings

from .db import (
    claim_next_event,
    count_pending_events,
    get_conn,
    mark_done,
    mark_failed,
    safe_rollback,
    enqueue_event,
)

# Agents
from .agents.appointment_agent import AppointmentAgent
from .agents.inventory_agent import InventoryAgent
from .agents.revenue_agent import RevenueAgent
from .agents.case_tracking_agent import CaseTrackingAgent


def _env(name: str, default: str) -> str:
    v = os.environ.get(name)
    if v is None or str(v).strip() == "":
        return default
    return str(v)


def _int_env(name: str, default: int) -> int:
    v = os.environ.get(name)
    try:
        return int(v) if v is not None else default
    except Exception:
        return default


def _int_env_any(names: list[str], default: int) -> int:
    for n in names:
        v = os.environ.get(n)
        if v is None:
            continue
        try:
            return int(v)
        except Exception:
            continue
    return default


def _log(worker_id: str, msg: str) -> None:
    print(f"[worker:{worker_id}] {msg}", flush=True)


def _dispatch_agents(event_type: str):
    agents = []
    if event_type.startswith("Appointment"):
        agents.append(AppointmentAgent())
        if event_type in ("AppointmentCreated", "AppointmentCompleted"):
            agents.append(RevenueAgent())
        if event_type == "AppointmentCompleted":
            agents.append(InventoryAgent())
        return agents
    if event_type == "VisitConsumablesUpdated":
        return [InventoryAgent()]
    if event_type.startswith("Inventory"):
        return [InventoryAgent()]
    if event_type.startswith("Revenue"):
        return [RevenueAgent()]
    if event_type.startswith("Case"):
        return [CaseTrackingAgent()]
    if event_type in ("AgentRunRequested",):
        return []
    return []


def main() -> None:
    worker_id = _env("WORKER_ID", _config.WORKER_ID if hasattr(_config, "WORKER_ID") else "py-worker-1")
    poll_ms = _int_env_any(["POLL_INTERVAL_MS", "POLL_MS"], getattr(_config, "POLL_MS", 800))
    lock_seconds = _int_env_any(["EVENT_LOCK_SECONDS", "LOCK_TTL_SECONDS"], getattr(_config, "LOCK_TTL_SECONDS", 60))
    retry_delay = _int_env_any(["EVENT_RETRY_DELAY_SEC"], 20)
    monitor_interval_min = _int_env_any(["INVENTORY_MONITOR_INTERVAL_MIN"], 60)
    revenue_monitor_interval_min = _int_env_any(["REVENUE_MONITOR_INTERVAL_MIN"], 60)
    case_monitor_interval_min = _int_env_any(["CASE_MONITOR_INTERVAL_MIN"], 1440)  # default daily

    try:
        conn = get_conn()
    except Exception as e:
        _log(worker_id, f"FATAL: cannot connect to DB: {e}")
        raise

    try:
        # Verify DB name + time quickly
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT DATABASE() AS db, NOW() AS now")
                row = cur.fetchone() or {}
                db = row.get("db") if isinstance(row, dict) else row[0]
                now = row.get("now") if isinstance(row, dict) else row[1]
            _log(worker_id, f"Connected. db={db} now={now}")
        except Exception:
            _log(worker_id, "Connected.")

        last_hb = 0.0
        last_monitor = 0.0
        last_revenue_monitor = 0.0
        last_case_monitor = 0.0

        while True:
            # heartbeat
            now_t = time.time()
            if now_t - last_hb >= 2.0:
                try:
                    pending_count = count_pending_events(conn)
                    _log(worker_id, f"heartbeat pending_count={pending_count}")
                except Exception as e:
                    _log(worker_id, f"heartbeat error={e}")
                last_hb = now_t

            # periodic inventory monitor tick (deduped via idempotency locks)
            if now_t - last_monitor >= max(60, monitor_interval_min * 60):
                try:
                    ts = time.strftime("%Y-%m-%d-%H")  # hourly dedupe key
                    dedupe = f"inventory_monitor:{ts}"
                    enqueue_event(
                        conn,
                        "InventoryMonitorTick",
                        {"horizon_days": 30},
                        priority=30,
                        dedupe_key=dedupe,
                    )
                    last_monitor = now_t
                except Exception as e:
                    _log(worker_id, f"monitor enqueue error={e}")
            if now_t - last_revenue_monitor >= max(60, revenue_monitor_interval_min * 60):
                try:
                    ts = time.strftime("%Y-%m-%d-%H")
                    dedupe = f"revenue_monitor:{ts}"
                    enqueue_event(
                        conn,
                        "RevenueMonitorTick",
                        {"horizon_days": 60},
                        priority=40,
                        dedupe_key=dedupe,
                    )
                    last_revenue_monitor = now_t
                except Exception as e:
                    _log(worker_id, f"revenue monitor enqueue error={e}")
            if now_t - last_case_monitor >= max(300, case_monitor_interval_min * 60):
                try:
                    ts = time.strftime("%Y-%m-%d")
                    dedupe = f"case_monitor:{ts}"
                    enqueue_event(
                        conn,
                        "CaseMonitorTick",
                        {"daysAhead": 0},
                        priority=45,
                        dedupe_key=dedupe,
                    )
                    last_case_monitor = now_t
                except Exception as e:
                    _log(worker_id, f"case monitor enqueue error={e}")

            # Ensure no stuck tx from prior loop
            safe_rollback(conn)

            # claim event
            try:
                ev = claim_next_event(conn, worker_id=worker_id, lock_seconds=lock_seconds)
            except Exception as e:
                # This is where "Transaction already in progress" used to spam.
                # We rollback and continue.
                safe_rollback(conn)
                _log(worker_id, f"TX ERROR: {repr(e)}")
                time.sleep(poll_ms / 1000.0)
                continue

            if not ev:
                time.sleep(poll_ms / 1000.0)
                continue

            event_id = int(ev["id"])
            event_type = str(ev["event_type"])
            payload: Dict[str, Any] = ev.get("payload") or {}

            _log(worker_id, f"CLAIM id={event_id} type={event_type}")

            agents = _dispatch_agents(event_type)
            try:
                if not agents:
                    mark_done(conn, event_id)
                    _log(worker_id, f"DONE id={event_id} (no agent)")
                    continue

                for agent in agents:
                    agent.handle(conn, event_type=event_type, event_id=event_id, payload=payload)

                # If agent didn't raise, mark done
                mark_done(conn, event_id)
                _log(worker_id, f"DONE id={event_id}")

            except Exception as e:
                safe_rollback(conn)
                # Include full error cause (critical for production debugging)
                err = f"{type(e).__name__}: {e}"
                mark_failed(conn, event_id, err_text=err, retry_delay_sec=retry_delay)
                _log(worker_id, f"FAIL id={event_id} err={repr(e)}")

                # Print stack trace once for debugging visibility
                tb = traceback.format_exc()
                _log(worker_id, tb)

            # tiny yield
            time.sleep(0.01)

    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
