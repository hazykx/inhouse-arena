"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { LFG_TAGS, lfgPost, ROLES, type Role } from "@/db/schema";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

export type FormState = { error?: string } | null;

export async function createLfgPost(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) return { error: "Pro přidání inzerátu se přihlas." };

  const kind = form.get("kind") === "TEAM" ? "TEAM" : "PLAYER";
  const teamName = String(form.get("teamName") ?? "").trim().slice(0, 60);
  const rank = String(form.get("rank") ?? "").trim().slice(0, 40);
  const text = String(form.get("text") ?? "").trim();
  const roles = [...new Set(form.getAll("roles").map(String))].filter((r): r is Role => ROLES.includes(r as Role));
  const tags = [...new Set(form.getAll("tags").map(String))].filter((t) => (LFG_TAGS as readonly string[]).includes(t));

  if (kind === "TEAM" && !teamName) return { error: "Vyplň název týmu." };
  if (!roles.length) return { error: kind === "TEAM" ? "Vyber role, které hledáte." : "Vyber aspoň jednu roli." };
  if (text.length < 10) return { error: "Napiš pár slov o sobě nebo týmu (aspoň 10 znaků)." };
  if (text.length > 500) return { error: "Text může mít nejvýš 500 znaků." };

  // Jeden aktivní inzerát daného typu na hráče – starý nahradíme
  await db.delete(lfgPost).where(and(eq(lfgPost.userId, s.user.id), eq(lfgPost.kind, kind)));
  await db.insert(lfgPost).values({ userId: s.user.id, kind, teamName: kind === "TEAM" ? teamName : null, rank: rank || null, roles, tags, text });

  revalidatePath("/hledam-tym");
  redirect(`/hledam-tym${kind === "TEAM" ? "?typ=tymy" : ""}`);
}

export async function deleteLfgPost(id: number) {
  const s = await getSession();
  if (!s) return;
  const post = await db.query.lfgPost.findFirst({ where: eq(lfgPost.id, id) });
  if (!post) return;
  if (post.userId !== s.user.id && !(await isAdmin(s.user.id))) return;
  await db.delete(lfgPost).where(eq(lfgPost.id, id));
  revalidatePath("/hledam-tym");
}
