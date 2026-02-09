// src/lib/appointmentStatus.ts
export type AptNormStatus =
  | "CONFIRMED"
  | "PENDING"
  | "CANCELLED"
  | "COMPLETED"
  | "OVERDUE"
  | "SCHEDULED"
  | "CHECKED_IN"
  | "IN_PROGRESS";

export function normStatus(raw: any): AptNormStatus {
  const s = String(raw || "").trim().toUpperCase();
  if (s === "CHECKED IN") return "CHECKED_IN";
  if (s === "IN PROGRESS") return "IN_PROGRESS";
  if (s === "CONFIRMED") return "CONFIRMED";
  if (s === "PENDING") return "PENDING";
  if (s === "CANCELLED") return "CANCELLED";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "OVERDUE") return "OVERDUE";
  if (s === "SCHEDULED") return "SCHEDULED";
  return "PENDING";
}

export function isUpcomingStatus(st: any) {
  const s = normStatus(st);
  return s !== "COMPLETED" && s !== "CANCELLED";
}

export function isPastStatus(st: any) {
  const s = normStatus(st);
  return s === "COMPLETED" || s === "CANCELLED";
}
