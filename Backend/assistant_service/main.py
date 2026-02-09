from __future__ import annotations

import os
import re
import json
from datetime import date, timedelta, datetime
from typing import Any, Dict, List, Optional, Tuple

import jwt
import joblib
import mysql.connector
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_ENV = os.path.abspath(os.path.join(BASE_DIR, "..", ".env"))

# Load shared repo-level env first, then allow assistant_service/.env to override if needed
load_dotenv(dotenv_path=ROOT_ENV)
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# ----------------------------
# Env
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "dental_clinic")

JWT_SECRET = os.getenv("JWT_SECRET", "")  # must match Node server.js

MODEL_PATH = os.getenv("ASSISTANT_MODEL_PATH", os.path.join(BASE_DIR, "assistant_intent_model.joblib"))
TRAIN_CSV_PATH = os.getenv("ASSISTANT_TRAINING_CSV", os.path.join(BASE_DIR, "assistant_intent_training.csv"))

MODEL_VERSION = 3  # bump when changing model format/training


# ----------------------------
# JSON helpers (Decimal-safe)
# ----------------------------
class SafeJSONEncoder(json.JSONEncoder):
    def default(self, o: Any):
        try:
            import decimal
            if isinstance(o, decimal.Decimal):
                return float(o)
        except Exception:
            pass
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return str(o)


def dumps_safe(obj: Any) -> str:
    return json.dumps(obj, cls=SafeJSONEncoder, ensure_ascii=False)


# ----------------------------
# API contracts
# ----------------------------
class CardRow(BaseModel):
    cols: List[str]


class Card(BaseModel):
    type: str  # "table" | "list" | "stats"
    title: str
    columns: Optional[List[str]] = None
    rows: Optional[List[CardRow]] = None
    bullets: Optional[List[str]] = None
    stats: Optional[Dict[str, Any]] = None


class AssistantRequest(BaseModel):
    context: str = "general"  # appointments|inventory|revenue|cases|general
    message: str
    meta: Optional[Dict[str, Any]] = None


class AssistantResponse(BaseModel):
    replyText: str
    intent: str
    confidence: float
    cards: List[Card] = []
    quickActions: List[str] = []


# ----------------------------
# DB
# ----------------------------
def get_conn():
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
    )


def q(sql: str, params: Tuple = ()) -> List[Dict[str, Any]]:
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        return cur.fetchall()
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ----------------------------
# JWT verify
# ----------------------------
def verify_jwt_or_401(auth_header: Optional[str]):
    # If you really want strict production: if not JWT_SECRET -> 500
    if not JWT_SECRET:
        return  # dev permissive
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization token")
    token = auth_header.split(" ", 1)[1].strip()
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ----------------------------
# ML Intent model (small helper)
# ----------------------------
INTENTS = [
    "GREET", "THANKS", "GOODBYE", "SMALLTALK", "HELP",
    "APPT_TODAY", "APPT_NEXT",
    "INV_LOW_STOCK", "INV_SEARCH_ITEM",
    "REV_SUMMARY_30D",  # default 30d, we override range dynamically from message
    "CASE_OPEN_LIST", "CASE_NEEDS_ATTENTION",
    "UNKNOWN",
]

SEED_TRAINING: List[Tuple[str, str]] = [
    ("show today's appointments", "APPT_TODAY"),
    ("show today appointments", "APPT_TODAY"),
    ("today schedule", "APPT_TODAY"),
    ("appointments for today", "APPT_TODAY"),

    ("next appointment", "APPT_NEXT"),
    ("upcoming appointments", "APPT_NEXT"),
    ("show upcoming appointments", "APPT_NEXT"),

    ("inventory alerts", "INV_LOW_STOCK"),
    ("check inventory alerts", "INV_LOW_STOCK"),
    ("low stock items", "INV_LOW_STOCK"),

    ("search gloves", "INV_SEARCH_ITEM"),
    ("find gloves in inventory", "INV_SEARCH_ITEM"),

    ("revenue summary", "REV_SUMMARY_30D"),
    ("last 30 days revenue", "REV_SUMMARY_30D"),

    ("list open cases", "CASE_OPEN_LIST"),
    ("open cases", "CASE_OPEN_LIST"),
    ("active cases", "CASE_OPEN_LIST"),

    ("cases needing attention", "CASE_NEEDS_ATTENTION"),
    ("cases need follow up", "CASE_NEEDS_ATTENTION"),

    ("help", "HELP"),
    ("what can you do", "HELP"),

    ("hi", "GREET"),
    ("hello", "GREET"),
    ("hey", "GREET"),

    ("thanks", "THANKS"),
    ("thank you", "THANKS"),

    ("bye", "GOODBYE"),
    ("goodbye", "GOODBYE"),

    ("how are you", "SMALLTALK"),
    ("what's up", "SMALLTALK"),
]

def load_training_pairs() -> List[Tuple[str, str]]:
    pairs = list(SEED_TRAINING)
    # optional csv: text,label
    try:
        if os.path.exists(TRAIN_CSV_PATH):
            import csv
            with open(TRAIN_CSV_PATH, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    t = (row.get("text") or "").strip()
                    y = (row.get("label") or "").strip()
                    if t and y and y in INTENTS:
                        pairs.append((t, y))
    except Exception:
        pass
    return pairs


class IntentModel:
    def __init__(self):
        if SKLEARN_AVAILABLE:
            self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
            self.clf = LogisticRegression(max_iter=800)
        else:
            self.vectorizer = None
            self.clf = None

    def train(self, pairs: List[Tuple[str, str]]):
        if not SKLEARN_AVAILABLE:
            return
        X = [t.lower().strip() for t, _ in pairs]
        y = [l for _, l in pairs]
        if not X:
            return
        Xv = self.vectorizer.fit_transform(X)
        self.clf.fit(Xv, y)

    def predict(self, text: str) -> Tuple[str, float]:
        if not SKLEARN_AVAILABLE:
            return "UNKNOWN", 0.0
        
        t = (text or "").lower().strip()
        if not t:
            return "UNKNOWN", 0.0
        
        try:
            Xv = self.vectorizer.transform([t])
            probs = self.clf.predict_proba(Xv)[0]
            classes = list(self.clf.classes_)
            best_i = int(probs.argmax())
            return classes[best_i], float(probs[best_i])
        except Exception:
            return "UNKNOWN", 0.0


def load_or_train_model() -> IntentModel:
    if os.path.exists(MODEL_PATH):
        try:
            loaded = joblib.load(MODEL_PATH)
            if isinstance(loaded, tuple) and len(loaded) == 2:
                model, version = loaded
                if version == MODEL_VERSION:
                    return model
        except Exception:
            pass

    m = IntentModel()
    m.train(load_training_pairs())
    joblib.dump((m, MODEL_VERSION), MODEL_PATH)
    return m


MODEL = load_or_train_model()


# ----------------------------
# Deterministic intent fallback (THIS fixes your issue)
# ----------------------------
def keyword_intent(msg: str) -> Optional[Tuple[str, float]]:
    s = (msg or "").lower().strip()

    # greetings / smalltalk
    if s in {"hi", "hello", "hey", "yo"}:
        return ("GREET", 0.99)
    if any(w in s for w in ["thanks", "thank you", "thx"]):
        return ("THANKS", 0.99)
    if any(w in s for w in ["bye", "goodbye", "see you"]):
        return ("GOODBYE", 0.99)
    if s in {"oye", "hmm", "ok", "okay"}:
        return ("SMALLTALK", 0.70)

    # key clinic intents (strict)
    if ("appointment" in s or "appointments" in s or "schedule" in s) and ("today" in s or "todays" in s):
        return ("APPT_TODAY", 0.99)
    if ("appointment" in s or "appointments" in s or "schedule" in s) and any(w in s for w in ["next", "upcoming", "tomorrow", "future"]):
        return ("APPT_NEXT", 0.99)

    if ("inventory" in s or "stock" in s) and any(w in s for w in ["low", "alert", "threshold", "reorder"]):
        return ("INV_LOW_STOCK", 0.99)
    if any(w in s for w in ["search", "find", "lookup"]) and ("inventory" in s or "stock" in s):
        return ("INV_SEARCH_ITEM", 0.95)
    # allow "search gloves" without word inventory
    if s.startswith("search ") or s.startswith("find "):
        return ("INV_SEARCH_ITEM", 0.80)

    if "revenue" in s or ("last 30" in s and ("day" in s or "days" in s)):
        return ("REV_SUMMARY_30D", 0.99)

    if ("case" in s or "cases" in s) and any(w in s for w in ["open", "active", "list"]):
        return ("CASE_OPEN_LIST", 0.99)
    if ("case" in s or "cases" in s) and any(w in s for w in ["attention", "follow", "review", "urgent"]):
        return ("CASE_NEEDS_ATTENTION", 0.99)

    if "help" in s or "what can you do" in s:
        return ("HELP", 0.99)

    return None


def predict_intent(msg: str) -> Tuple[str, float]:
    kw = keyword_intent(msg)
    if kw:
        return kw

    intent, conf = MODEL.predict(msg)
    # If ML unsure, degrade to UNKNOWN
    if conf < 0.40:
        return "UNKNOWN", conf
    return intent, conf


# ----------------------------
# Handlers (STRICTLY match your schema)
# ----------------------------
def handle_greet(ctx: str) -> Tuple[str, List[Card], List[str]]:
    if ctx == "cases":
        return ("Hi! Try: “list open cases”, “cases needing attention”.", [], ["List open cases", "Cases needing attention"])
    if ctx == "appointments":
        return ("Hi! Try: “show today appointments”, “upcoming appointments”.", [], ["Show today appointments", "Upcoming appointments"])
    if ctx == "inventory":
        return ("Hi! Try: “check inventory alerts”, “search gloves”.", [], ["Check inventory alerts", "Search gloves"])
    if ctx == "revenue":
        return ("Hi! Try: “revenue summary”.", [], ["Revenue summary"])
    return (
        "Hi! Try: “show today appointments”, “check inventory alerts”, “revenue summary”, “list open cases”.",
        [],
        ["Show today appointments", "Check inventory alerts", "Revenue summary", "List open cases"],
    )


def handle_help(ctx: str) -> Tuple[str, List[Card], List[str]]:
    bullets = [
        "Appointments: show today, show upcoming",
        "Inventory: low-stock alerts, search item",
        "Revenue: summary for any range (e.g., last 10/30 days)",
        "Cases: list open cases, cases needing attention",
    ]
    return (
        "I can help with these quick actions:",
        [Card(type="list", title="What I can do", bullets=bullets)],
        ["Show today appointments", "Upcoming appointments", "Check inventory alerts", "Search gloves", "Revenue summary", "List open cases"],
    )


def handle_unknown(ctx: str) -> Tuple[str, List[Card], List[str]]:
    return (
        "I didn’t catch that. Try: “show today appointments”, “check inventory alerts”, “revenue summary”, “list open cases”.",
        [],
        ["Show today appointments", "Check inventory alerts", "Revenue summary", "List open cases"],
    )


def handle_appt_today() -> Tuple[str, List[Card], List[str]]:
    today = date.today().isoformat()

    rows = q(
        """
        SELECT
          a.id AS dbId,
          a.appointment_uid AS appointmentUid,
          a.appointment_code AS appointmentCode,
          a.scheduled_date AS scheduledDate,
          a.scheduled_time AS scheduledTime,
          a.status AS status,
          p.full_name AS patientName,
          d.full_name AS doctorName
        FROM appointments a
        JOIN users p ON p.id = a.patient_id
        JOIN users d ON d.id = a.doctor_id
        WHERE a.scheduled_date = %s
        ORDER BY a.scheduled_time ASC
        LIMIT 30
        """,
        (today,),
    )

    if not rows:
        return ("You have no appointments scheduled for today.", [], ["Upcoming appointments", "Check inventory alerts"])

    card_rows: List[CardRow] = []
    for r in rows:
        card_rows.append(
            CardRow(
                cols=[
                    str(r.get("scheduledTime") or ""),
                    str(r.get("patientName") or ""),
                    str(r.get("doctorName") or ""),
                    str(r.get("status") or ""),
                ]
            )
        )

    card = Card(
        type="table",
        title="Today’s appointments",
        columns=["Time", "Patient", "Doctor", "Status"],
        rows=card_rows,
    )
    return (f"Here are today’s appointments ({len(rows)}):", [card], ["Revenue summary", "List open cases"])


def handle_appt_next() -> Tuple[str, List[Card], List[str]]:
    today = date.today().isoformat()

    rows = q(
        """
        SELECT
          a.id AS dbId,
          a.appointment_uid AS appointmentUid,
          a.appointment_code AS appointmentCode,
          a.scheduled_date AS scheduledDate,
          a.scheduled_time AS scheduledTime,
          a.status AS status,
          p.full_name AS patientName,
          d.full_name AS doctorName
        FROM appointments a
        JOIN users p ON p.id = a.patient_id
        JOIN users d ON d.id = a.doctor_id
        WHERE a.scheduled_date >= %s
        ORDER BY a.scheduled_date ASC, a.scheduled_time ASC
        LIMIT 20
        """,
        (today,),
    )

    if not rows:
        return ("No upcoming appointments found.", [], ["Show today appointments", "Check inventory alerts"])

    card_rows: List[CardRow] = []
    for r in rows:
        card_rows.append(
            CardRow(
                cols=[
                    str(r.get("scheduledDate") or "")[:10],
                    str(r.get("scheduledTime") or ""),
                    str(r.get("patientName") or ""),
                    str(r.get("doctorName") or ""),
                    str(r.get("status") or ""),
                ]
            )
        )

    card = Card(
        type="table",
        title="Upcoming appointments",
        columns=["Date", "Time", "Patient", "Doctor", "Status"],
        rows=card_rows,
    )
    return (f"Here are upcoming appointments ({len(rows)}):", [card], ["Show today appointments", "Revenue summary"])


def handle_inv_low_stock() -> Tuple[str, List[Card], List[str]]:
    rows = q(
        """
        SELECT item_code AS itemCode, name, stock, reorder_threshold AS reorderThreshold, expiry_date AS expiryDate
        FROM inventory_items
        WHERE COALESCE(reorder_threshold, 0) > 0
          AND stock <= reorder_threshold
        ORDER BY (reorder_threshold - stock) DESC, stock ASC
        LIMIT 20
        """
    )

    if not rows:
        return ("No low-stock alerts found.", [], ["Search gloves", "Show today appointments"])

    card_rows: List[CardRow] = []
    for r in rows:
        card_rows.append(
            CardRow(
                cols=[
                    str(r.get("itemCode") or ""),
                    str(r.get("name") or ""),
                    str(r.get("stock") or 0),
                    str(r.get("reorderThreshold") or 0),
                    str((r.get("expiryDate") or "") or ""),
                ]
            )
        )

    card = Card(
        type="table",
        title="Low stock items",
        columns=["Code", "Item", "Stock", "Reorder at", "Expiry"],
        rows=card_rows,
    )
    return (f"I found {len(rows)} low-stock items:", [card], ["Search gloves", "Revenue summary"])


def extract_search_term(msg: str) -> str:
    s = (msg or "").strip()
    s_low = s.lower()
    # "search gloves", "find gloves", "search inventory gloves"
    m = re.match(r"^(search|find|lookup)\s+(inventory|stock)?\s*(.*)$", s_low)
    if m:
        term = (m.group(3) or "").strip()
        return term
    # fallback: last word-ish
    parts = s.split()
    if len(parts) >= 2:
        return " ".join(parts[1:])
    return ""


def handle_inv_search_item(msg: str) -> Tuple[str, List[Card], List[str]]:
    term = extract_search_term(msg)
    term = term.strip()
    if not term:
        return ("Tell me an item name. Example: “search gloves”.", [], ["Search gloves", "Check inventory alerts"])

    like = f"%{term}%"
    rows = q(
        """
        SELECT item_code AS itemCode, name, stock, reorder_threshold AS reorderThreshold, expiry_date AS expiryDate, status
        FROM inventory_items
        WHERE name LIKE %s OR item_code LIKE %s
        ORDER BY name ASC
        LIMIT 20
        """,
        (like, like),
    )

    if not rows:
        return (f"I couldn’t find any inventory items matching “{term}”.", [], ["Check inventory alerts", "Search composite"])

    card_rows: List[CardRow] = []
    for r in rows:
        card_rows.append(
            CardRow(
                cols=[
                    str(r.get("itemCode") or ""),
                    str(r.get("name") or ""),
                    str(r.get("stock") or 0),
                    str(r.get("reorderThreshold") or 0),
                    str(r.get("status") or ""),
                ]
            )
        )

    card = Card(
        type="table",
        title=f"Inventory results: {term}",
        columns=["Code", "Item", "Stock", "Reorder at", "Status"],
        rows=card_rows,
    )
    return (f"Here are items matching “{term}” ({len(rows)}):", [card], ["Check inventory alerts", "Show today appointments"])


def handle_rev_summary_30d() -> Tuple[str, List[Card], List[str]]:
    return handle_rev_summary_range(days=30)


def _parse_revenue_days(msg: str) -> int:
    m = re.search(r"(last|past)\s+(\d+)\s+day", msg, flags=re.IGNORECASE)
    if m:
        try:
            n = int(m.group(2))
            if 1 <= n <= 365:
                return n
        except Exception:
            pass
    return 30


def handle_rev_summary_range(days: int = 30) -> Tuple[str, List[Card], List[str]]:
    days = max(1, min(int(days or 30), 365))
    start = (date.today() - timedelta(days=days)).isoformat()
    row = q(
        """
        SELECT
          COUNT(*) AS invoiceCount,
          COALESCE(SUM(amount), 0) AS revenue,
          SUM(CASE WHEN status='Paid' THEN amount ELSE 0 END) AS paidRevenue,
          SUM(CASE WHEN status='Pending' THEN amount ELSE 0 END) AS pendingRevenue,
          SUM(CASE WHEN status='Overdue' THEN amount ELSE 0 END) AS overdueRevenue
        FROM invoices
        WHERE issue_date >= %s
        """,
        (start,),
    )

    stats = row[0] if row else {"invoiceCount": 0, "revenue": 0, "paidRevenue": 0, "pendingRevenue": 0, "overdueRevenue": 0}
    card = Card(
        type="stats",
        title=f"Revenue (last {days} days)",
        stats={
            "From": start,
            "Invoices": int(stats.get("invoiceCount") or 0),
            "Revenue": float(stats.get("revenue") or 0),
            "Paid": float(stats.get("paidRevenue") or 0),
            "Pending": float(stats.get("pendingRevenue") or 0),
            "Overdue": float(stats.get("overdueRevenue") or 0),
        },
    )
    return (f"Here’s your revenue summary for the last {days} days:", [card], ["Show today appointments", "Check inventory alerts"])


def handle_cases_open() -> Tuple[str, List[Card], List[str]]:
    rows = q(
        """
        SELECT
          c.id AS dbId,
          c.case_uid AS caseUid,
          c.stage AS stage,
          c.updated_at AS updatedAt,
          p.full_name AS patientName,
          d.full_name AS doctorName
        FROM cases c
        JOIN users p ON p.id = c.patient_id
        LEFT JOIN users d ON d.id = c.doctor_id
        WHERE UPPER(c.stage) NOT IN ('CLOSED','COMPLETED')
        ORDER BY c.updated_at DESC
        LIMIT 20
        """
    )

    if not rows:
        return ("No open cases found.", [], ["Show today appointments", "Revenue summary"])

    card_rows: List[CardRow] = []
    for r in rows:
        card_rows.append(
            CardRow(
                cols=[
                    str(r.get("caseUid") or f"CASE-{r.get('dbId')}"),
                    str(r.get("patientName") or ""),
                    str(r.get("doctorName") or ""),
                    str(r.get("stage") or ""),
                    str(r.get("updatedAt") or "")[:10],
                ]
            )
        )

    card = Card(
        type="table",
        title="Open cases",
        columns=["Case", "Patient", "Doctor", "Stage", "Updated"],
        rows=card_rows,
    )
    return (f"Here are open cases ({len(rows)}):", [card], ["Cases needing attention", "Revenue summary"])


def handle_cases_needing_attention() -> Tuple[str, List[Card], List[str]]:
    today = date.today().isoformat()

    rows = q(
        """
        SELECT
          c.id AS dbId,
          c.case_uid AS caseUid,
          c.stage AS stage,
          c.risk_score AS riskScore,
          c.next_review_date AS nextReviewDate,
          c.updated_at AS updatedAt,
          p.full_name AS patientName
        FROM cases c
        JOIN users p ON p.id = c.patient_id
        WHERE UPPER(c.stage) NOT IN ('CLOSED','COMPLETED')
          AND (
            (c.next_review_date IS NOT NULL AND c.next_review_date <= %s)
            OR (c.risk_score >= 70)
            OR (UPPER(c.stage) IN ('WAITING_ON_PATIENT'))
          )
        ORDER BY
          (c.next_review_date IS NULL) ASC,
          c.next_review_date ASC,
          c.risk_score DESC,
          c.updated_at DESC
        LIMIT 20
        """,
        (today,),
    )

    if not rows:
        return ("No cases currently flagged for attention.", [], ["List open cases", "Show today appointments"])

    card_rows: List[CardRow] = []
    for r in rows:
        card_rows.append(
            CardRow(
                cols=[
                    str(r.get("caseUid") or f"CASE-{r.get('dbId')}"),
                    str(r.get("patientName") or ""),
                    str(r.get("stage") or ""),
                    str(r.get("riskScore") or 0),
                    str(r.get("nextReviewDate") or ""),
                ]
            )
        )

    card = Card(
        type="table",
        title="Cases needing attention",
        columns=["Case", "Patient", "Stage", "Risk", "Next review"],
        rows=card_rows,
    )
    return (f"I found {len(rows)} cases that need attention:", [card], ["List open cases", "Revenue summary"])


def route_intent(intent: str, conf: float, ctx: str, msg: str) -> Tuple[str, List[Card], List[str], float]:
    # deterministic smalltalk
    if intent == "GREET":
        reply, cards, actions = handle_greet(ctx)
        return reply, cards, actions, conf
    if intent == "THANKS":
        return ("You're welcome. Want me to show appointments or inventory alerts?", [], ["Show today appointments", "Check inventory alerts"], conf)
    if intent == "GOODBYE":
        return ("Okay. Come back anytime.", [], ["Help"], conf)
    if intent == "SMALLTALK":
        return ("Tell me what you want: appointments, inventory, revenue, or cases.", [], ["Show today appointments", "Check inventory alerts", "Revenue summary", "List open cases"], conf)
    if intent == "HELP":
        reply, cards, actions = handle_help(ctx)
        return reply, cards, actions, conf

    # clinic actions
    if intent == "APPT_TODAY":
        reply, cards, actions = handle_appt_today()
        return reply, cards, actions, conf
    if intent == "APPT_NEXT":
        reply, cards, actions = handle_appt_next()
        return reply, cards, actions, conf

    if intent == "INV_LOW_STOCK":
        reply, cards, actions = handle_inv_low_stock()
        return reply, cards, actions, conf
    if intent == "INV_SEARCH_ITEM":
        reply, cards, actions = handle_inv_search_item(msg)
        return reply, cards, actions, conf

    if intent == "REV_SUMMARY_30D":
        days = _parse_revenue_days(msg)
        reply, cards, actions = handle_rev_summary_range(days=days)
        return reply, cards, actions, conf

    if intent == "CASE_OPEN_LIST":
        reply, cards, actions = handle_cases_open()
        return reply, cards, actions, conf
    if intent == "CASE_NEEDS_ATTENTION":
        reply, cards, actions = handle_cases_needing_attention()
        return reply, cards, actions, conf

    # fallback
    reply, cards, actions = handle_unknown(ctx)
    return reply, cards, actions, conf


# ----------------------------
# FastAPI
# ----------------------------
app = FastAPI(title="Clinic ML Assistant", version="1.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local dev ok
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/assistant/message", response_model=AssistantResponse)
def assistant_message(req: AssistantRequest, authorization: Optional[str] = Header(default=None)):
    verify_jwt_or_401(authorization)

    msg = (req.message or "").strip()
    if not msg:
        return AssistantResponse(
            replyText="Ask me something. Example: “show today appointments”.",
            intent="UNKNOWN",
            confidence=0.0,
            cards=[],
            quickActions=["Show today appointments", "Check inventory alerts", "Revenue summary", "List open cases"],
        )

    intent, conf = predict_intent(msg)
    reply, cards, actions, conf2 = route_intent(intent, conf, req.context or "general", msg)

    return AssistantResponse(
        replyText=reply,
        intent=intent,
        confidence=conf2,
        cards=cards,
        quickActions=actions,
    )

@app.get("/assistant/health")
def health():
    # quick sanity checks
    try:
        _ = q("SELECT 1 AS ok")
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "ok": True,
        "db": DB_NAME,
        "db_ok": db_ok,
        "model_path": os.path.basename(MODEL_PATH),
        "training_csv_present": os.path.exists(TRAIN_CSV_PATH),
        "version": MODEL_VERSION,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("ASSISTANT_PORT", os.getenv("PORT", "8010")))
    host = os.getenv("ASSISTANT_HOST", "127.0.0.1")
    uvicorn.run("main:app", host=host, port=port)
