"use server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { report, REPORT_CATEGORIES, user } from "@/db/schema";
import { getSession } from "@/lib/session";

export type ReportState = { ok?: boolean; error?: string } | null;

export async function createReport(targetId: string, _: ReportState, form: FormData): Promise<ReportState> {
  const s = await getSession();
  if (!s) return { error: "Pro nahlášení se přihlas." };
  if (s.user.id === targetId) return { error: "Nemůžeš nahlásit sám sebe." };
  const target = await db.query.user.findFirst({ where: eq(user.id, targetId) });
  if (!target) return { error: "Hráč neexistuje." };

  const category = String(form.get("category") ?? "");
  const text = String(form.get("text") ?? "").trim();
  const matchId = Number(form.get("matchId")) || null;
  if (!(REPORT_CATEGORIES as readonly string[]).includes(category)) return { error: "Vyber důvod." };
  if (text.length < 10) return { error: "Popiš, co se stalo (aspoň 10 znaků)." };

  // Ochrana proti spamu
  const dayAgo = new Date(Date.now() - 86400000);
  const recent = await db.select({ id: report.id }).from(report).where(and(eq(report.reporterId, s.user.id), gt(report.createdAt, dayAgo)));
  if (recent.length >= 5) return { error: "Za 24 hodin můžeš poslat nejvýš 5 nahlášení." };
  const open = await db.query.report.findFirst({ where: and(eq(report.reporterId, s.user.id), eq(report.targetId, targetId), eq(report.status, "OPEN")) });
  if (open) return { error: "Tohoto hráče už máš nahlášeného, admin to řeší." };

  await db.insert(report).values({ reporterId: s.user.id, targetId, matchId, category, text: text.slice(0, 1000) });
  return { ok: true };
}
