import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { riotAccount } from "@/db/schema";

type Acc = typeof riotAccount.$inferSelect;

/** Hlavní účet: označený, jinak první z EUNE, jinak první propojený */
export function primaryOf<T extends Pick<Acc, "isPrimary" | "platform" | "createdAt">>(accs: T[]): T | null {
  if (!accs.length) return null;
  return accs.find((a) => a.isPrimary) ?? accs.find((a) => a.platform === "eun1") ?? [...accs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

/** Mapa userId → hlavní Riot účet */
export async function primaryAccounts(userIds?: string[]) {
  const rows = await db.select().from(riotAccount).where(userIds ? inArray(riotAccount.userId, userIds.length ? userIds : ["-"]) : undefined);
  const byUser = new Map<string, Acc[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  return new Map([...byUser].map(([u, accs]) => [u, primaryOf(accs)!]));
}
