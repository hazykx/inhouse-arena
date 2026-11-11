import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profile, user } from "@/db/schema";

/** "Kryštof 1v9" → "krystof-1v9" */
export function slugify(name: string) {
  const s = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  return s || "hrac";
}

/** Vrátí (a případně vytvoří) unikátní adresu profilu hráče */
export async function ensureSlug(userId: string): Promise<string | null> {
  const p = await db.query.profile.findFirst({ where: eq(profile.userId, userId) });
  if (p?.slug) return p.slug;
  const u = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!u) return null;
  const base = slugify(u.name);
  let slug = base;
  for (let n = 2; await db.query.profile.findFirst({ where: eq(profile.slug, slug) }); n++) slug = `${base}-${n}`;
  await db.insert(profile).values({ userId, slug }).onConflictDoUpdate({ target: profile.userId, set: { slug } });
  return slug;
}

/** Najde hráče podle adresy profilu, nebo podle starého ID */
export async function userIdFromSlug(slugOrId: string) {
  const bySlug = await db.query.profile.findFirst({ where: eq(profile.slug, slugOrId) });
  if (bySlug) return bySlug.userId;
  const byId = await db.query.user.findFirst({ where: eq(user.id, slugOrId) });
  return byId?.id ?? null;
}
