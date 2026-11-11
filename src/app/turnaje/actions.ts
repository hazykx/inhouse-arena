"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { activeSanction, sanctionText } from "@/lib/moderation";

export type FormState = { error?: string } | null;

const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const date = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "");
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
};

export async function createTournament(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) return { error: "Pro přidání turnaje se přihlas." };
  const ban = await activeSanction(s.user.id, ["BAN"]);
  if (ban) return { error: sanctionText(ban) };

  const name = str(form, "name", 80);
  const organizer = str(form, "organizer", 60);
  const kind = form.get("kind") === "LIGA" ? "LIGA" : "TURNAJ";
  const format = str(form, "format", 60);
  const prize = str(form, "prize", 80);
  const capacity = str(form, "capacity", 40);
  const url = str(form, "url", 300);
  const description = str(form, "description", 600);
  const startsAt = date(form, "startsAt");
  const endsAt = date(form, "endsAt");
  const registrationUntil = date(form, "registrationUntil");

  if (name.length < 3) return { error: "Vyplň název turnaje." };
  if (!organizer) return { error: "Vyplň pořadatele." };
  if (!format) return { error: "Vyplň formát (např. 5v5 · Bo3)." };
  if (!startsAt) return { error: "Vyplň datum začátku." };
  if (endsAt && endsAt < startsAt) return { error: "Konec nemůže být před začátkem." };
  if (url && !/^https?:\/\//i.test(url)) return { error: "Odkaz musí začínat http:// nebo https://" };

  const admin = await isAdmin(s.user.id);
  await db.insert(tournament).values({
    userId: s.user.id, name, organizer, kind, format, startsAt,
    endsAt, registrationUntil,
    prize: prize || null, capacity: capacity || null, url: url || null, description: description || null,
    featured: admin && form.get("featured") === "on",
    approved: admin, // turnaj od admina je schválený hned, ostatní čekají
  });

  revalidatePath("/turnaje");
  redirect(admin ? "/turnaje" : "/turnaje?odeslano=1");
}

export async function deleteTournament(id: number) {
  const s = await getSession();
  if (!s) return;
  const t = await db.query.tournament.findFirst({ where: eq(tournament.id, id) });
  if (!t) return;
  if (t.userId !== s.user.id && !(await isAdmin(s.user.id))) return;
  await db.delete(tournament).where(eq(tournament.id, id));
  revalidatePath("/turnaje");
}

export async function approveTournament(id: number) {
  const s = await getSession();
  if (!s || !(await isAdmin(s.user.id))) return;
  await db.update(tournament).set({ approved: true }).where(eq(tournament.id, id));
  revalidatePath("/turnaje");
  revalidatePath("/admin");
}

export async function toggleFeatured(id: number) {
  const s = await getSession();
  if (!s || !(await isAdmin(s.user.id))) return;
  const t = await db.query.tournament.findFirst({ where: eq(tournament.id, id) });
  if (!t) return;
  await db.update(tournament).set({ featured: !t.featured }).where(eq(tournament.id, id));
  revalidatePath("/turnaje");
}
