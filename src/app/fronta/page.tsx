import { getSession } from "@/lib/session";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { QueueRoom } from "./QueueRoom";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const session = await getSession();
  const prof = session ? await db.query.profile.findFirst({ where: eq(profile.userId, session.user.id) }) : null;
  return <QueueRoom loggedIn={!!session} defaultRole={prof?.mainRole ?? null} />;
}
