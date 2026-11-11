import "server-only";
import { db } from "@/db";
import { adminLog } from "@/db/schema";

/** Zapíše akci admina do logu */
export async function logAdmin(adminId: string, action: string, targetUserId?: string | null, details?: string) {
  await db.insert(adminLog).values({ adminId, action, targetUserId: targetUserId ?? null, details: details?.slice(0, 500) ?? null });
}
