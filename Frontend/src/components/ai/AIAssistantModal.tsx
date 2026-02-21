import React, { useEffect, useRef, useState } from "react";
import {
  XIcon,
  SendIcon,
  SparklesIcon,
  CalendarIcon,
  PackageIcon,
  LineChartIcon,
  ClipboardListIcon,
  UserIcon,
} from "lucide-react";

interface AssistantCard {
  type: string;
  title: string;
  rows: any[];
}

interface AssistantMeta {
  intent?: string;
  counts?: Record<string, number>;
  entityIds?: Array<string | number>;
}

interface Message {
  id: number;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  context: string;
  cards?: AssistantCard[];
  meta?: AssistantMeta;
}

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: "appointments" | "inventory" | "revenue" | "cases" | "general";
}

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

const gradientByContext: Record<AIAssistantModalProps["context"], string> = {
  appointments: "from-sky-600/15 via-cyan-500/10 to-transparent",
  inventory: "from-amber-500/15 via-yellow-500/10 to-transparent",
  revenue: "from-emerald-500/15 via-teal-500/10 to-transparent",
  cases: "from-violet-500/15 via-fuchsia-500/10 to-transparent",
  general: "from-slate-500/15 via-slate-400/10 to-transparent",
};

const contextTitle: Record<AIAssistantModalProps["context"], string> = {
  appointments: "Appointments Support",
  inventory: "Inventory Support",
  revenue: "Revenue Support",
  cases: "Case Tracking Support",
  general: "General Support",
};

const getContextIcon = (ctx: AIAssistantModalProps["context"]) => {
  switch (ctx) {
    case "appointments":
      return <CalendarIcon size={18} />;
    case "inventory":
      return <PackageIcon size={18} />;
    case "revenue":
      return <LineChartIcon size={18} />;
    case "cases":
      return <ClipboardListIcon size={18} />;
    default:
      return <SparklesIcon size={18} />;
  }
};

const getContextualGreeting = (ctx: AIAssistantModalProps["context"]) => {
  switch (ctx) {
    case "appointments":
      return "Ask me about today's appointments, schedule, or reminders.";
    case "inventory":
      return "Ask me about low stock, usage logs, and purchase orders.";
    case "revenue":
      return "Ask me for invoice and outstanding summaries.";
    case "cases":
      return "Ask me about case stages, summaries, and timelines.";
    default:
      return "I can help with appointments, case stages, inventory, and revenue.";
  }
};

const getAuthToken = () =>
  localStorage.getItem("authToken") || localStorage.getItem("token") || "";

const defaultSuggestionsByContext: Record<AIAssistantModalProps["context"], string[]> = {
  appointments: ["Show today's appointments", "Any delayed visits?", "Upcoming schedule"],
  inventory: ["Check inventory alerts", "Recent usage logs", "Any PO drafts?"],
  revenue: ["View revenue report", "Outstanding invoices", "Latest billing summary"],
  cases: ["Show case stages", "Pending summaries", "Show timeline updates"],
  general: ["Show today's appointments", "Show case stages", "Check inventory alerts", "View revenue report"],
};

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  context = "general",
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestionsByContext[context]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    requestAnimationFrame(scrollToBottom);
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 1,
          type: "assistant",
          content: getContextualGreeting(context),
          timestamp: new Date(),
          context,
        },
      ]);
      setSuggestions(defaultSuggestionsByContext[context] || defaultSuggestionsByContext.general);
    }
  }, [isOpen, context, messages.length]);

  const sendPrompt = async (promptText: string) => {
    const prompt = String(promptText || "").trim();
    if (!prompt || isSending) return;

    const userMessage: Message = {
      id: Date.now(),
      type: "user",
      content: prompt,
      timestamp: new Date(),
      context,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);

    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/assistant/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          context,
          message: prompt,
          meta: { source: "ai_modal" },
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || "Assistant request failed");
      }

      const assistantMessage: Message = {
        id: Date.now() + 1,
        type: "assistant",
        content: String(body.reply || "I could not generate a response."),
        timestamp: new Date(),
        context,
        cards: Array.isArray(body.cards) ? body.cards : [],
        meta: body.meta || {},
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (Array.isArray(body.suggestions) && body.suggestions.length) {
        setSuggestions(body.suggestions.map((s: any) => String(s)).filter(Boolean));
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          type: "assistant",
          content: "Could not fetch data right now. Please try again.",
          timestamp: new Date(),
          context,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = () => sendPrompt(inputValue);
  const quickActions = (suggestions.length ? suggestions : defaultSuggestionsByContext[context]).map((label) => ({
    label,
    icon: label.toLowerCase().includes("inventory")
      ? <PackageIcon size={14} />
      : label.toLowerCase().includes("revenue") || label.toLowerCase().includes("invoice")
      ? <LineChartIcon size={14} />
      : label.toLowerCase().includes("case")
      ? <ClipboardListIcon size={14} />
      : <CalendarIcon size={14} />,
  }));
  const matchingQuickActions = inputValue.trim()
    ? quickActions.filter((q) => q.label.toLowerCase().includes(inputValue.toLowerCase()))
    : quickActions;

  const renderCard = (card: AssistantCard, idx: number) => {
    const rows = Array.isArray(card.rows) ? card.rows : [];
    return (
      <div key={`${card.type}-${idx}`} className="mt-2 rounded-xl border border-line bg-surface p-2.5">
        <div className="text-[11px] font-semibold text-ink mb-1">{card.title || card.type}</div>
        {rows.length === 0 ? (
          <div className="text-[11px] text-ink-muted">No records found.</div>
        ) : (
          <div className="space-y-1.5">
            {rows.slice(0, 4).map((r, i) => (
              <div key={i} className="rounded-lg border border-line bg-surface-muted px-2 py-1.5 text-[11px] text-ink">
                {card.type === "appointments" && (
                  <div>
                    <div className="font-medium">{r.appointment_code || `#${r.id}`}</div>
                    <div className="text-ink-muted">{String(r.scheduled_date || "")} {String(r.scheduled_time || "")} - {r.status || "--"}</div>
                  </div>
                )}
                {card.type === "cases" && (
                  <div>
                    <div className="font-medium">{r.case_uid || `Case #${r.id}`}</div>
                    <div className="text-ink-muted">{r.stage || "--"} - {String(r.updated_at || "").slice(0, 16).replace("T", " ")}</div>
                  </div>
                )}
                {card.type === "cases_pending" && (
                  <div>
                    <div className="font-medium">{r.case_uid || `Case #${r.case_id || r.id}`}</div>
                    <div className="text-ink-muted">
                      {r.status || "PENDING_REVIEW"} - {String(r.created_at || "").slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                )}
                {card.type === "inventory" && (
                  <div>
                    <div className="font-medium">{r.item_code || r.name || `Item #${r.id}`}</div>
                    <div className="text-ink-muted">Stock: {r.stock ?? "--"} / Threshold: {r.reorder_threshold ?? "--"}</div>
                  </div>
                )}
                {card.type === "inventory_usage" && (
                  <div>
                    <div className="font-medium">{r.item_code || r.item_name || `Usage #${r.id}`}</div>
                    <div className="text-ink-muted">Qty used: {r.qty_used ?? "--"} - {String(r.created_at || "").slice(0, 16).replace("T", " ")}</div>
                  </div>
                )}
                {card.type === "revenue" && (
                  <div>
                    <div className="font-medium">Invoices: {r.totalInvoices ?? 0}</div>
                    <div className="text-ink-muted">Outstanding: {r.outstandingAmount ?? 0}</div>
                  </div>
                )}
                {card.type === "invoices" && (
                  <div>
                    <div className="font-medium">Invoice #{r.id}</div>
                    <div className="text-ink-muted">{r.status || "--"} - {r.amount ?? 0} ({String(r.issue_date || "")})</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative h-full w-full flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-3xl h-[90vh] sm:h-auto sm:max-h-[88vh] rounded-2xl border border-line bg-surface shadow-card flex flex-col overflow-hidden">
          <div className="relative border-b border-line px-4 sm:px-5 py-4">
            <div className={`absolute inset-0 bg-gradient-to-r ${gradientByContext[context]} pointer-events-none`} />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-surface-muted border border-line flex items-center justify-center text-ink">
                  {getContextIcon(context)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink leading-tight">AI Assistant</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                    <span>{contextTitle[context]}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-xl border border-line bg-surface hover:bg-surface-muted text-ink inline-flex items-center justify-center"
                aria-label="Close assistant"
              >
                <XIcon size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[90%] flex items-start gap-2">
                  {message.type === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-surface-muted text-ink border border-line flex items-center justify-center flex-shrink-0">
                      <SparklesIcon size={14} />
                    </div>
                  )}
                  <div>
                    <div
                      className={
                        message.type === "user"
                          ? "rounded-2xl px-4 py-2.5 bg-ink text-surface"
                          : "rounded-2xl px-4 py-2.5 bg-surface-muted text-ink border border-line"
                      }
                    >
                      <p className="text-sm leading-6 whitespace-pre-line">{message.content}</p>
                      {message.type === "assistant" && Array.isArray(message.cards)
                        ? message.cards.map(renderCard)
                        : null}
                      {import.meta.env.DEV && import.meta.env.VITE_ASSISTANT_SHOW_META === "true" && message.meta ? (
                        <pre className="mt-2 text-[10px] text-ink-muted whitespace-pre-wrap">{JSON.stringify(message.meta, null, 2)}</pre>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {message.type === "user" && (
                    <div className="h-8 w-8 rounded-full bg-ink text-surface flex items-center justify-center flex-shrink-0">
                      <UserIcon size={14} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <SparklesIcon size={14} />
                Assistant is checking live data...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-line px-4 sm:px-5 py-4">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-ink-muted">Suggestions</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {matchingQuickActions.slice(0, 6).map((action, index) => (
                  <button
                    key={`${action.label}-${index}`}
                    onClick={() => {
                      setInputValue(action.label);
                      sendPrompt(action.label);
                    }}
                    disabled={isSending}
                    className="rounded-full border border-line bg-surface-muted hover:bg-surface px-3 py-1.5 text-xs text-ink inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <span className="text-ink-muted">{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                placeholder="Ask the assistant..."
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-sky-500/25"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending}
                className="h-10 px-4 rounded-xl bg-ink text-surface font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
              >
                <SendIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
