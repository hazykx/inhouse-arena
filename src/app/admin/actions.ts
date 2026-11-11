"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { lfgPost, queueEntry, tournament } from "@/db/schema";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { addSanction, DURATIONS, revokeSanction, setSetting, type DurationKey } from "@/lib/moderation";
import { adminCancel, adminResolve, resetQueue } from "@/lib/queue";

async function requireAdmin() {
  const s = await getSession();
  if (!s || !(await isAdmin(s.user.id))) throw new Error("Jen pro adminy.");
  return s.user.id;
}
const done = () => revalidatePath("/admin");

/* Fronta */
export async function setQueueEnabled(enabled: boolean) {
  await requireAdmin();
  await setSetting("queueEnabled", enabled ? "1" : "0");
  if (!enabled) await db.delete(queueEntry);
  done();
}
export async function resetQueueAction() {
  await requireAdmin();
  await resetQueue();
  done();
}
export async function kickFromQueue(userId: string) {
  await requireAdmin();
  await db.delete(queueEntry).where(eq(queueEntry.userId, userId));
  done();
}
export async function cancelLobby(id: number) {
  await requireAdmin();
  await adminCancel(id);
  done();
}
export async function resolveLobby(id: number, winner: "BLUE" | "RED") {
  await requireAdmin();
  await adminResolve(id, winner);
  done();
}

/* Hráči */
export async function sanctionPlayer(userId: string, form: FormData) {
  const adminId = await requireAdmin();
  const type = form.get("type") === "BAN" ? "BAN" : "QUEUE";
  const duration = String(form.get("duration")) as DurationKey;
  if (!(duration in DURATIONS)) return;
  await addSanction(userId, type, duration, String(form.get("reason") ?? ""), adminId);
  done();
}
export async function revokeSanctionAction(id: number) {
  await requireAdmin();
  await revokeSanction(id);
  done();
}

/* Inzeráty a turnaje */
export async function deletePost(id: number) {
  await requireAdmin();
  await db.delete(lfgPost).where(eq(lfgPost.id, id));
  revalidatePath("/hledam-tym");
  done();
}
export async function approveTournamentAdmin(id: number) {
  await requireAdmin();
  await db.update(tournament).set({ approved: true }).where(eq(tournament.id, id));
  revalidatePath("/turnaje");
  done();
}
export async function deleteTournamentAdmin(id: number) {
  await requireAdmin();
  await db.delete(tournament).where(eq(tournament.id, id));
  revalidatePath("/turnaje");
  done();
}
export async function featureTournamentAdmin(id: number, featured: boolean) {
  await requireAdmin();
  await db.update(tournament).set({ featured }).where(eq(tournament.id, id));
  revalidatePath("/turnaje");
  done();
}
