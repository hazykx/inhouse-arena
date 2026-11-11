import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/schema";

/** Admin = hráč, jehož Discord ID je v ADMIN_DISCORD_IDS (čárkami oddělený seznam) */
export async function isAdmin(userId: string | undefined | null) {
  if (!userId) return false;
  const ids = (process.env.ADMIN_DISCORD_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return false;
  const acc = await db.query.account.findFirst({ where: and(eq(account.userId, userId), eq(account.providerId, "discord")) });
  return !!acc && ids.includes(acc.accountId);
}

/** Discord ID hráčů (pro odkaz „Napsat na Discordu“) */
export async function discordIds(userIds: string[]) {
  if (!userIds.length) return new Map<string, string>();
  const rows = await db.query.account.findMany({ where: eq(account.providerId, "discord"), columns: { userId: true, accountId: true } });
  return new Map(rows.filter((r) => userIds.includes(r.userId)).map((r) => [r.userId, r.accountId]));
}
