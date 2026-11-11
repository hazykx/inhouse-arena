"use server";
import { eq, inArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { lfgPost, lobbyPlayer, match, matchPlayer, mmrAdjustment, profile, queueEntry, report, ROLES, tournament, user, type Role } from "@/db/schema";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { logAdmin } from "@/lib/adminLog";
import { addSanction, DURATIONS, revokeSanction, setSetting, type DurationKey } from "@/lib/moderation";
import { adminCancel, adminResolve, resetQueue, fillWithBots } from "@/lib/queue";
import { currentSeason, recomputeSeasonMmr, startNewSeason } from "@/lib/season";
import { ensureSlug } from "@/lib/slug";

async function requireAdmin() {
  const s = await getSession();
  if (!s || !(await isAdmin(s.user.id))) throw new Error("Jen pro adminy.");
  return s.user.id;
}
const done = (...paths: string[]) => {
  revalidatePath("/admin");
  paths.forEach((p) => revalidatePath(p));
};

/* ═════════ Fronta ═════════ */

export async function setQueueEnabled(enabled: boolean) {
  const a = await requireAdmin();
  await setSetting("queueEnabled", enabled ? "1" : "0");
  if (!enabled) await db.delete(queueEntry);
  await logAdmin(a, enabled ? "Zapnul frontu" : "Vypnul frontu");
  done("/fronta");
}
export async function resetQueueAction() {
  const a = await requireAdmin();
  await resetQueue();
  await logAdmin(a, "Resetoval frontu a zrušil rozehrané hry");
  done("/fronta");
}
export async function kickFromQueue(userId: string) {
  const a = await requireAdmin();
  await db.delete(queueEntry).where(eq(queueEntry.userId, userId));
  await logAdmin(a, "Vyhodil hráče z fronty", userId);
  done();
}
export async function cancelLobby(id: number) {
  const a = await requireAdmin();
  await adminCancel(id);
  await logAdmin(a, `Zrušil hru #${id}`);
  done();
}
export async function resolveLobby(id: number, winner: "BLUE" | "RED") {
  const a = await requireAdmin();
  await adminResolve(id, winner);
  await logAdmin(a, `Rozhodl hru #${id}: vyhrál ${winner}`);
  done("/zapasy", "/statistiky");
}

/* ═════════ Hráči ═════════ */

export async function sanctionPlayer(userId: string, form: FormData) {
  const a = await requireAdmin();
  const type = form.get("type") === "BAN" ? "BAN" : "QUEUE";
  const duration = String(form.get("duration")) as DurationKey;
  if (!(duration in DURATIONS)) return;
  const reason = String(form.get("reason") ?? "");
  await addSanction(userId, type, duration, reason, a);
  await logAdmin(a, `${type === "BAN" ? "Ban" : "Pauza ve frontě"}: ${DURATIONS[duration].label}`, userId, reason);
  done();
}
export async function revokeSanctionAction(id: number, userId: string) {
  const a = await requireAdmin();
  await revokeSanction(id);
  await logAdmin(a, "Zrušil trest", userId);
  done();
}
/** Ruční nastavení MMR – uloží se jako úprava a sezóna se přepočítá */
export async function adjustMmr(userId: string, form: FormData) {
  const a = await requireAdmin();
  const target = Number(form.get("mmr"));
  if (!Number.isFinite(target) || target < 0 || target > 5000) return;
  const prof = await db.query.profile.findFirst({ where: eq(profile.userId, userId) });
  const delta = Math.round(target) - (prof?.mmr ?? 1500);
  if (!delta) return;
  const s = await currentSeason();
  const reason = String(form.get("reason") ?? "").slice(0, 200);
  await db.insert(mmrAdjustment).values({ seasonId: s.id, userId, delta, reason: reason || null, createdBy: a });
  await recomputeSeasonMmr(s.id);
  await logAdmin(a, `Upravil MMR o ${delta > 0 ? "+" : ""}${delta} (na ${Math.round(target)})`, userId, reason);
  done("/statistiky");
}

/* ═════════ Zápasy ═════════ */

export async function deleteMatch(id: number) {
  const a = await requireAdmin();
  const m = await db.query.match.findFirst({ where: eq(match.id, id) });
  if (!m) return;
  await db.delete(matchPlayer).where(eq(matchPlayer.matchId, id));
  await db.delete(match).where(eq(match.id, id));
  await recomputeSeasonMmr(m.seasonId);
  await logAdmin(a, `Smazal zápas #${id}`);
  done("/zapasy", "/statistiky");
}

export async function updateMatch(id: number, form: FormData) {
  const a = await requireAdmin();
  const m = await db.query.match.findFirst({ where: eq(match.id, id), with: { players: true } });
  if (!m) return;
  const winner = form.get("winner") === "RED" ? "RED" : "BLUE";
  const minutes = Number(form.get("minutes"));
  const durationSec = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : m.durationSec;
  await db.update(match).set({ winner, durationSec }).where(eq(match.id, id));

  const n = (k: string) => Math.max(0, Math.round(Number(form.get(k)) || 0));
  for (const p of m.players) {
    const k = (f: string) => `${f}_${p.id}`;
    const hasStats = form.get(k("hasStats")) === "on";
    const role = ROLES.includes(form.get(k("role")) as Role) ? (form.get(k("role")) as Role) : p.role;
    await db.update(matchPlayer).set({
      role, hasStats,
      champion: String(form.get(k("champion")) ?? "").trim().slice(0, 30),
      kills: n(k("kills")), deaths: n(k("deaths")), assists: n(k("assists")),
      cs: n(k("cs")), damage: n(k("damage")), vision: n(k("vision")),
    }).where(eq(matchPlayer.id, p.id));
  }
  if (winner !== m.winner) await recomputeSeasonMmr(m.seasonId);
  await logAdmin(a, `Upravil zápas #${id}${winner !== m.winner ? ` (vítěz změněn na ${winner})` : ""}`);
  done("/zapasy", "/statistiky");
  redirect("/admin?tab=zapasy");
}

/* ═════════ Reporty ═════════ */

export async function resolveReport(id: number, status: "RESOLVED" | "REJECTED", form?: FormData) {
  const a = await requireAdmin();
  const r = await db.query.report.findFirst({ where: eq(report.id, id) });
  if (!r) return;
  const note = String(form?.get("note") ?? "").slice(0, 300);
  await db.update(report).set({ status, note: note || null, resolvedBy: a, resolvedAt: new Date() }).where(eq(report.id, id));
  await logAdmin(a, `${status === "RESOLVED" ? "Vyřešil" : "Zamítl"} nahlášení #${id} (${r.category})`, r.targetId, note);
  done();
}

/* ═════════ Inzeráty a turnaje ═════════ */

export async function deletePost(id: number) {
  const a = await requireAdmin();
  const p = await db.query.lfgPost.findFirst({ where: eq(lfgPost.id, id) });
  await db.delete(lfgPost).where(eq(lfgPost.id, id));
  await logAdmin(a, "Smazal inzerát", p?.userId, p?.text);
  done("/hledam-tym");
}
export async function approveTournamentAdmin(id: number) {
  const a = await requireAdmin();
  const t = await db.query.tournament.findFirst({ where: eq(tournament.id, id) });
  await db.update(tournament).set({ approved: true }).where(eq(tournament.id, id));
  await logAdmin(a, `Schválil turnaj „${t?.name}“`, t?.userId);
  done("/turnaje");
}
export async function deleteTournamentAdmin(id: number) {
  const a = await requireAdmin();
  const t = await db.query.tournament.findFirst({ where: eq(tournament.id, id) });
  await db.delete(tournament).where(eq(tournament.id, id));
  await logAdmin(a, `${t?.approved ? "Smazal" : "Zamítl"} turnaj „${t?.name}“`, t?.userId);
  done("/turnaje");
}
export async function featureTournamentAdmin(id: number, featured: boolean) {
  const a = await requireAdmin();
  const t = await db.query.tournament.findFirst({ where: eq(tournament.id, id) });
  await db.update(tournament).set({ featured }).where(eq(tournament.id, id));
  await logAdmin(a, `${featured ? "Doporučil" : "Zrušil doporučení"} turnaj „${t?.name}“`);
  done("/turnaje");
}

/* ═════════ Sezóna ═════════ */

export async function newSeason(form: FormData) {
  const a = await requireAdmin();
  if (String(form.get("confirm")).trim().toUpperCase() !== "RESET") return;
  const name = String(form.get("name") ?? "");
  const soft = form.get("mode") === "soft";
  const cur = await currentSeason();
  await startNewSeason(name, soft);
  await logAdmin(a, `Ukončil sezónu „${cur.name}“ a začal „${name}“ (${soft ? "soft" : "hard"} reset)`);
  done("/statistiky", "/");
}

/* ═════════ Testování ═════════ */

const BOT_NAMES = ["Kryštof", "Vlkodlak", "Nerf Pls", "Bára", "Toplane Tom", "Smajlík", "Ondra 1v9", "Hookmaster", "Gankoš", "Pepa Kapr", "Lucinka", "Baron Steal"];

/** Vytvoří 12 testovacích botů (demo-1 … demo-12), pokud chybí */
export async function createBots() {
  const a = await requireAdmin();
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const id = `demo-${i + 1}`;
    await db.insert(user).values({ id, name: BOT_NAMES[i], email: `demo${i + 1}@demo.inhouse`, emailVerified: true }).onConflictDoNothing();
    await db.insert(profile).values({ userId: id, mainRole: ROLES[i % 5] }).onConflictDoNothing();
    await ensureSlug(id);
  }
  await logAdmin(a, "Vytvořil testovací boty");
  done();
}

/** Smaže boty i zápasy, ve kterých hráli, a přepočítá MMR */
export async function deleteBots() {
  const a = await requireAdmin();
  const bots = (await db.select({ id: user.id }).from(user).where(like(user.id, "demo-%"))).map((b) => b.id);
  if (!bots.length) return;
  const mids = [...new Set((await db.select({ m: matchPlayer.matchId }).from(matchPlayer).where(inArray(matchPlayer.userId, bots))).map((r) => r.m))];
  if (mids.length) {
    await db.delete(matchPlayer).where(inArray(matchPlayer.matchId, mids));
    await db.delete(match).where(inArray(match.id, mids));
  }
  await db.delete(queueEntry).where(inArray(queueEntry.userId, bots));
  await db.delete(lobbyPlayer).where(inArray(lobbyPlayer.userId, bots));
  await db.delete(lfgPost).where(inArray(lfgPost.userId, bots));
  await db.delete(tournament).where(inArray(tournament.userId, bots));
  await db.delete(profile).where(inArray(profile.userId, bots));
  await db.delete(user).where(inArray(user.id, bots));
  await recomputeSeasonMmr();
  await logAdmin(a, `Smazal testovací boty (a ${mids.length} zápasů s nimi)`);
  done("/zapasy", "/statistiky");
}

export async function fillQueueWithBots() {
  const a = await requireAdmin();
  await fillWithBots();
  await logAdmin(a, "Doplnil frontu boty");
  done("/fronta");
}
