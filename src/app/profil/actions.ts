"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { account, profile, riotAccount, ROLES, type Role } from "@/db/schema";
import { getSession } from "@/lib/session";
import { MAX_RIOT_ACCOUNTS } from "@/lib/format";
import { getAccountByRiotId, getSummoner, isPlatform, RiotError } from "@/lib/riot";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

async function requireUser() {
  const s = await getSession();
  if (!s) throw new Error("Nejsi přihlášený");
  return s.user;
}

/** Přidá LoL účet podle Riot ID. Max 3 účty, první musí být z EUNE. */
export async function linkRiot(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const riotId = String(form.get("riotId") ?? "").trim();
  const platform = String(form.get("platform") ?? "eun1");

  const [gameName, tagLine] = riotId.split("#").map((x) => x?.trim());
  if (!gameName || !tagLine) return { error: "Zadej Riot ID ve tvaru Jméno#TAG (např. Kryštof#EUNE)." };
  if (!isPlatform(platform)) return { error: "Neznámý server." };

  const mine = await db.select().from(riotAccount).where(eq(riotAccount.userId, me.id));
  if (mine.length >= MAX_RIOT_ACCOUNTS) return { error: `Můžeš mít propojené nejvýš ${MAX_RIOT_ACCOUNTS} účty.` };
  if (!mine.some((a) => a.platform === "eun1") && platform !== "eun1") return { error: "První propojený účet musí být z EUNE." };

  try {
    const acc = await getAccountByRiotId(gameName, tagLine, platform);
    const existing = await db.query.riotAccount.findFirst({ where: eq(riotAccount.puuid, acc.puuid) });
    if (existing && existing.userId !== me.id) return { error: "Tento LoL účet už má propojený jiný hráč." };
    if (existing) return { error: "Tento účet už máš propojený." };

    const summ = await getSummoner(acc.puuid, platform, true);
    await db.insert(riotAccount).values({
      userId: me.id, puuid: acc.puuid, gameName: acc.gameName, tagLine: acc.tagLine, platform,
      profileIconId: summ.profileIconId, summonerLevel: summ.summonerLevel,
      verified: true, verifiedAt: new Date(), isPrimary: mine.length === 0,
    });
    revalidatePath("/profil");
    revalidatePath(`/hrac/${me.id}`);
    return { ok: true, message: `Propojeno: ${acc.gameName}#${acc.tagLine}` };
  } catch (e) {
    if (e instanceof RiotError) {
      return { error: e.status === 404 ? "Účet s tímto Riot ID jsme na zvoleném serveru nenašli." : e.message };
    }
    throw e;
  }
}

/** Odpojí jeden účet. Poslední EUNE účet nejde odpojit, dokud jsou propojené jiné. */
export async function unlinkRiot(id: number): Promise<ActionState> {
  const me = await requireUser();
  const mine = await db.select().from(riotAccount).where(eq(riotAccount.userId, me.id));
  const target = mine.find((a) => a.id === id);
  if (!target) return { error: "Účet nenalezen." };
  const rest = mine.filter((a) => a.id !== id);
  if (target.platform === "eun1" && rest.length && !rest.some((a) => a.platform === "eun1")) {
    return { error: "Aspoň jeden účet musí být z EUNE. Nejdřív odpoj ostatní účty, nebo přidej jiný EUNE účet." };
  }
  await db.delete(riotAccount).where(eq(riotAccount.id, id));
  if (target.isPrimary && rest.length) {
    const next = rest.find((a) => a.platform === "eun1") ?? rest[0];
    await db.update(riotAccount).set({ isPrimary: true }).where(eq(riotAccount.id, next.id));
  }
  revalidatePath("/profil");
  revalidatePath(`/hrac/${me.id}`);
  return { ok: true };
}

/** Nastaví hlavní účet (jeho rank a mastery se ukazují na profilu) */
export async function setPrimaryRiot(id: number) {
  const me = await requireUser();
  const mine = await db.select().from(riotAccount).where(eq(riotAccount.userId, me.id));
  if (!mine.some((a) => a.id === id)) return;
  await db.update(riotAccount).set({ isPrimary: false }).where(eq(riotAccount.userId, me.id));
  await db.update(riotAccount).set({ isPrimary: true }).where(eq(riotAccount.id, id));
  revalidatePath("/profil");
  revalidatePath(`/hrac/${me.id}`);
}

export async function updateRoles(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parse = (v: FormDataEntryValue | null) => (ROLES.includes(v as Role) ? (v as Role) : null);
  const mainRole = parse(form.get("mainRole"));
  const secondaryRole = parse(form.get("secondaryRole"));
  if (mainRole && mainRole === secondaryRole) return { error: "Hlavní a vedlejší role musí být rozdílné." };

  await db
    .insert(profile)
    .values({ userId: me.id, mainRole, secondaryRole })
    .onConflictDoUpdate({ target: profile.userId, set: { mainRole, secondaryRole } });
  revalidatePath(`/hrac/${me.id}`);
  return { ok: true, message: "Role uloženy." };
}

/** Odpojí Twitch nebo Kick (Discord odpojit nejde – je to hlavní účet) */
export async function unlinkSocial(provider: "twitch" | "kick") {
  const me = await requireUser();
  if (provider !== "twitch" && provider !== "kick") return;
  await db.delete(account).where(and(eq(account.userId, me.id), eq(account.providerId, provider)));
  revalidatePath("/profil");
  revalidatePath("/streamy");
  revalidatePath(`/hrac/${me.id}`);
}
