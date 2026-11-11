"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { account, profile, riotAccount, ROLES, type Role } from "@/db/schema";
import { getSession } from "@/lib/session";
import { getAccountByRiotId, getSummoner, isPlatform, RiotError } from "@/lib/riot";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

async function requireUser() {
  const s = await getSession();
  if (!s) throw new Error("Nejsi přihlášený");
  return s.user;
}

/** Propojí LoL účet podle Riot ID (bez ověřování) */
export async function linkRiot(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const riotId = String(form.get("riotId") ?? "").trim();
  const platform = String(form.get("platform") ?? "eun1");

  const [gameName, tagLine] = riotId.split("#").map((x) => x?.trim());
  if (!gameName || !tagLine) return { error: "Zadej Riot ID ve tvaru Jméno#TAG (např. Kryštof#EUNE)." };
  if (!isPlatform(platform)) return { error: "Neznámý server." };

  try {
    const acc = await getAccountByRiotId(gameName, tagLine, platform);
    const taken = await db.query.riotAccount.findFirst({
      where: and(eq(riotAccount.puuid, acc.puuid), ne(riotAccount.userId, me.id)),
    });
    if (taken) return { error: "Tento LoL účet už má propojený jiný hráč." };

    const summ = await getSummoner(acc.puuid, platform, true);
    const values = {
      puuid: acc.puuid,
      gameName: acc.gameName,
      tagLine: acc.tagLine,
      platform,
      profileIconId: summ.profileIconId,
      summonerLevel: summ.summonerLevel,
      verified: true,
      verifyIconId: null,
      verifiedAt: new Date(),
    };
    await db
      .insert(riotAccount)
      .values({ userId: me.id, ...values })
      .onConflictDoUpdate({ target: riotAccount.userId, set: values });

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

export async function unlinkRiot() {
  const me = await requireUser();
  await db.delete(riotAccount).where(eq(riotAccount.userId, me.id));
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
