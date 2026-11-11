import type { tournament } from "@/db/schema";

type T = typeof tournament.$inferSelect;
export type TourStatus = { key: "open" | "closed" | "live" | "soon" | "ended"; label: string; color: string };

/** Stav turnaje podle dat */
export function tourStatus(t: Pick<T, "startsAt" | "endsAt" | "registrationUntil">, now = new Date()): TourStatus {
  const end = t.endsAt ?? new Date(t.startsAt.getTime() + 86400000);
  if (now > end) return { key: "ended", label: "UKONČENO", color: "grey" };
  if (now >= t.startsAt) return { key: "live", label: "PROBÍHÁ", color: "" };
  if (t.registrationUntil && now > new Date(t.registrationUntil.getTime() + 86400000)) return { key: "closed", label: "REGISTRACE UZAVŘENA", color: "amber" };
  return { key: "open", label: "REGISTRACE OTEVŘENÁ", color: "green" };
}

export function dateRange(t: Pick<T, "startsAt" | "endsAt">) {
  const f = (d: Date, y = true) => d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", ...(y ? { year: "numeric" } : {}), timeZone: "Europe/Prague" });
  if (!t.endsAt || t.endsAt.toDateString() === t.startsAt.toDateString()) return f(t.startsAt);
  return `${f(t.startsAt, false)} – ${f(t.endsAt)}`;
}
