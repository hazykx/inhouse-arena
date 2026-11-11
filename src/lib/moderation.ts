import "server-only";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { queueEntry, sanction, setting } from "@/db/schema";

export type SanctionType = "BAN" | "QUEUE";
export const DURATIONS = {
  "24h": { label: "24 hodin", ms: 24 * 3600 * 1000 },
  "3d": { label: "3 dny", ms: 3 * 24 * 3600 * 1000 },
  "7d": { label: "Týden", ms: 7 * 24 * 3600 * 1000 },
  perma: { label: "Permanentně", ms: null },
} as const;
export type DurationKey = keyof typeof DURATIONS;

/** Aktivní trest hráče (BAN má přednost před pauzou ve frontě) */
export async function activeSanction(userId: string, types: SanctionType[] = ["BAN", "QUEUE"]) {
  const now = new Date();
  const rows = await db
    .select()
    .from(sanction)
    .where(and(eq(sanction.userId, userId), inArray(sanction.type, types), isNull(sanction.revokedAt), or(isNull(sanction.until), gt(sanction.until, now))))
    .orderBy(desc(sanction.createdAt));
  return rows.find((r) => r.type === "BAN") ?? rows[0] ?? null;
}

export function sanctionText(s: { type: string; until: Date | null; reason: string | null }) {
  const what = s.type === "BAN" ? "Máš ban" : "Máš pauzu ve frontě";
  const until = s.until
    ? ` do ${s.until.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" })}`
    : " natrvalo";
  return `${what}${until}${s.reason ? ` (důvod: ${s.reason})` : ""}.`;
}

/** Vyhodí chybu s textem, pokud hráč nesmí provést akci */
export async function assertAllowed(userId: string, types: SanctionType[]) {
  const s = await activeSanction(userId, types);
  if (s) throw new SanctionError(sanctionText(s));
}
export class SanctionError extends Error {}

export async function addSanction(userId: string, type: SanctionType, duration: DurationKey, reason: string, adminId: string) {
  const d = DURATIONS[duration];
  await db.insert(sanction).values({
    userId, type, reason: reason.trim().slice(0, 200) || null, createdBy: adminId,
    until: d.ms == null ? null : new Date(Date.now() + d.ms),
  });
  // Ze fronty hráče rovnou vyřadíme
  await db.delete(queueEntry).where(eq(queueEntry.userId, userId));
}

export async function revokeSanction(id: number) {
  await db.update(sanction).set({ revokedAt: new Date() }).where(eq(sanction.id, id));
}

/* ───────── Nastavení ───────── */

export async function getSetting(key: string, fallback: string) {
  const row = await db.query.setting.findFirst({ where: eq(setting.key, key) });
  return row?.value ?? fallback;
}
export async function setSetting(key: string, value: string) {
  await db.insert(setting).values({ key, value }).onConflictDoUpdate({ target: setting.key, set: { value } });
}
export const isQueueEnabled = async () => (await getSetting("queueEnabled", "1")) === "1";
