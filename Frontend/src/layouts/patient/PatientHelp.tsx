import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Info,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CalendarDays,
  CreditCard,
  ClipboardList,
} from "lucide-react";
import { PatientLayout } from "./PatientLayout";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: "appointments" | "billing" | "profile" | "general";
};

const FAQS: FaqItem[] = [
  {
    id: "how-book-appointment",
    category: "appointments",
    question: "How do I book an appointment",
    answer:
      "Go to the Appointments page, click Book new appointment, choose your preferred doctor, date, and time slot, then confirm. You will receive an in-app confirmation and optionally an email or SMS if your clinic has that enabled.",
  },
  {
    id: "reschedule-appointment",
    category: "appointments",
    question: "Can I reschedule or cancel an appointment",
    answer:
      "Yes. Open the Appointments page, select the upcoming appointment, and choose Reschedule or Cancel. Some clinics restrict changes within a few hours of the scheduled time; if you do not see the option, please call the clinic.",
  },
  {
    id: "view-treatment-history",
    category: "profile",
    question: "Where can I see my treatment history",
    answer:
      "Open the Treatments page from the sidebar. You can see completed procedures, notes from your doctor (if shared), and upcoming planned treatments.",
  },
  {
    id: "billing-summary",
    category: "billing",
    question: "How do I view my bills and payments",
    answer:
      "Go to the Billing page. You will see a list of invoices, their status (Paid, Pending, or Overdue), and any outstanding balance. You can also download receipts if your clinic has enabled that feature.",
  },
  {
    id: "update-contact-details",
    category: "profile",
    question: "How can I update my phone number or address",
    answer:
      "Navigate to your Profile or Account settings. From there, you can update your contact details. If something is locked, contact the clinic so they can update it for you.",
  },
  {
    id: "data-privacy",
    category: "general",
    question: "Who can see my data inside the clinic",
    answer:
      "Only authorized clinic staff (such as your doctor and front-desk/admin team) can view your data. Access is controlled by roles, and everything is tracked in the clinic system for audit and compliance.",
  },
];

export const PatientHelp: React.FC = () => {
  const [activeFaqId, setActiveFaqId] = useState<string | null>(
    "how-book-appointment"
  );
  const [selectedCategory, setSelectedCategory] = useState<
    FaqItem["category"] | "all"
  >("all");

  const filteredFaqs = FAQS.filter(
    (f) => selectedCategory === "all" || f.category === selectedCategory
  );

  return (
    <PatientLayout current="help">
      <div className="flex flex-col gap-6">
        <section className="surface rounded-2xl px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-title flex items-center gap-2">
                <MessageCircle size={14} className="text-brand" />
                Patient support
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-ink">
                How can we help you today
              </h1>
              <p className="mt-1 text-sm text-ink-muted max-w-xl">
                Quick answers about appointments, bills, and your profile.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <p className="text-xs text-ink-muted">
                Still stuck Reach our clinic support team.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/help/contact" className="btn btn-primary text-xs">
                  <Mail size={14} className="mr-1" />
                  Contact support
                </Link>
                <button type="button" className="btn btn-secondary text-xs">
                  <Phone size={14} className="mr-1" />
                  Call clinic
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setSelectedCategory("appointments")}
            className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${
              selectedCategory === "appointments"
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-line bg-surface"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <CalendarDays size={16} />
              <span>Appointments and visits</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Booking, rescheduling, cancellations, and reminders.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("billing")}
            className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${
              selectedCategory === "billing"
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-line bg-surface"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <CreditCard size={16} />
              <span>Billing and payments</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Invoices, pending balance, and payment confirmations.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("profile")}
            className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${
              selectedCategory === "profile"
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-line bg-surface"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <ClipboardList size={16} />
              <span>Profile and records</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Personal info, treatment history, and privacy.
            </p>
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-xs text-ink-muted">
          <AlertCircle size={14} className="mt-0.5 text-amber-600" />
          <p>
            Dental Clinic AI is a digital front-desk assistant. It helps manage
            appointments and records, but it does not replace medical advice from
            your dentist. Always follow recommendations given by your clinic.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-brand" />
              <div>
                <p className="text-sm font-medium text-ink">
                  Frequently asked questions
                </p>
                <p className="text-[11px] text-ink-muted">
                  Click a question to expand the answer.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setActiveFaqId("how-book-appointment");
              }}
              className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-ink hover:bg-surface-muted"
            >
              Reset filters
            </button>
          </div>

          <div className="divide-y divide-[color:var(--line)]">
            {filteredFaqs.map((faq) => {
              const isActive = activeFaqId === faq.id;
              return (
                <button
                  key={faq.id}
                  type="button"
                  onClick={() =>
                    setActiveFaqId((prev) => (prev === faq.id ? null : faq.id))
                  }
                  className="w-full text-left px-4 py-3 hover:bg-surface-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">
                        {faq.question}
                      </p>
                      {isActive && (
                        <p className="mt-1.5 text-xs text-ink-muted">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                    <div className="mt-0.5 text-ink-muted">
                      {isActive ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2 text-[11px] text-ink-muted">
          Need urgent help about pain, swelling, or an emergency Please call
          your clinic directly rather than using the app or email.
        </div>
      </div>
    </PatientLayout>
  );
};
