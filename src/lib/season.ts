import "server-only";
import { asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lobby, match, matchPlayer, mmrAdjustment, profile, queueEntry, season, seasonResult } from "@/db/schema";

export const START_MMR = 1500;
const K = 28;

/** Aktuální sezóna (při prvním spuštění vytvoří „Sezóna 1“) */
export async function currentSeason() {
  const s = await db.query.season.findFirst({ where: isNull(season.endedAt), orderBy: desc(season.id) });
  if (s) return s;
  const [created] = await db.insert(season).values({ name: "Sezóna 1", startedAt: new Date(0) }).returning();
  return created;
}

/** Startovní MMR hráčů v sezóně (soft reset = napůl cesty k 1500 z minulé sezóny) */
async function startMmrMap(s: typeof season.$inferSelect) {
  const map = new Map<string, number>();
  if (!s.softReset) return map;
  const prev = await db.query.season.findFirst({ where: eq(season.endedAt, s.startedAt) });
  if (!prev) return map;
  const results = await db.select().from(seasonResult).where(eq(seasonResult.seasonId, prev.id));
  for (const r of results) map.set(r.userId, Math.round((r.mmr + START_MMR) / 2));
  return map;
}

/** Přepočítá MMR celé sezóny od začátku: zápasy + ruční úpravy v časovém pořadí */
export async function recomputeSeasonMmr(seasonId?: number) {
  const s = seasonId ? await db.query.season.findFirst({ where: eq(season.id, seasonId) }) : await currentSeason();
  if (!s) return;
  const start = await startMmrMap(s);
  const mmr = new Map<string, number>();
  const get = (u: string) => mmr.get(u) ?? start.get(u) ?? START_MMR;

  const matches = await db.query.match.findMany({ where: eq(match.seasonId, s.id), orderBy: asc(match.playedAt), with: { players: true } });
  const adjustments = await db.select().from(mmrAdjustment).where(eq(mmrAdjustment.seasonId, s.id)).orderBy(asc(mmrAdjustment.createdAt));

  type Ev = { at: number; kind: "match"; m: (typeof matches)[number] } | { at: number; kind: "adj"; a: (typeof adjustments)[number] };
  const events: Ev[] = [
    ...matches.map((m) => ({ at: m.playedAt.getTime(), kind: "match" as const, m })),
    ...adjustments.map((a) => ({ at: a.createdAt.getTime(), kind: "adj" as const, a })),
  ].sort((x, y) => x.at - y.at);

  for (const ev of events) {
    if (ev.kind === "adj") {
      mmr.set(ev.a.userId, get(ev.a.userId) + ev.a.delta);
      continue;
    }
    const ps = ev.m.players;
    const avg = (side: string) => {
      const t = ps.filter((p) => p.team === side);
      return t.length ? t.reduce((a, p) => a + get(p.userId), 0) / t.length : START_MMR;
    };
    const expectedBlue = 1 / (1 + 10 ** ((avg("RED") - avg("BLUE")) / 400));
    const deltaBlue = Math.round(K * ((ev.m.winner === "BLUE" ? 1 : 0) - expectedBlue));
    for (const p of ps) {
      const change = p.team === "BLUE" ? deltaBlue : -deltaBlue;
      const after = get(p.userId) + change;
      mmr.set(p.userId, after);
      if (p.mmrChange !== change || p.mmrAfter !== after) {
        await db.update(matchPlayer).set({ mmrChange: change, mmrAfter: after }).where(eq(matchPlayer.id, p.id));
      }
    }
  }

  // Uložit výsledné MMR všem hráčům
  const profiles = await db.select({ userId: profile.userId, mmr: profile.mmr }).from(profile);
  for (const p of profiles) {
    const v = get(p.userId);
    if (v !== p.mmr) await db.update(profile).set({ mmr: v }).where(eq(profile.userId, p.userId));
  }
}

/** Ukončí sezónu, uloží konečné pořadí a začne novou */
export async function startNewSeason(name: string, soft: boolean) {
  const cur = await currentSeason();
  const now = new Date();

  // Konečné pořadí (jen hráči, kteří v sezóně hráli)
  const rows = await db
    .select({ userId: matchPlayer.userId, team: matchPlayer.team, winner: match.winner })
    .from(matchPlayer)
    .innerJoin(match, eq(match.id, matchPlayer.matchId))
    .where(eq(match.seasonId, cur.id));
  const stats = new Map<string, { games: number; wins: number }>();
  for (const r of rows) {
    const st = stats.get(r.userId) ?? { games: 0, wins: 0 };
    st.games++;
    if (r.team === r.winner) st.wins++;
    stats.set(r.userId, st);
  }
  const ids = [...stats.keys()];
  const profiles = ids.length ? await db.select({ userId: profile.userId, mmr: profile.mmr }).from(profile).where(inArray(profile.userId, ids)) : [];
  const ranked = profiles.sort((a, b) => b.mmr - a.mmr);
  if (ranked.length) {
    await db.insert(seasonResult).values(ranked.map((p, i) => ({ seasonId: cur.id, userId: p.userId, position: i + 1, mmr: p.mmr, games: stats.get(p.userId)!.games, wins: stats.get(p.userId)!.wins })));
  }

  await db.update(season).set({ endedAt: now }).where(eq(season.id, cur.id));
  await db.insert(season).values({ name: name.trim().slice(0, 40) || "Nová sezóna", startedAt: now, softReset: soft });

  // Nové MMR: hard = všichni 1500, soft = napůl cesty k 1500
  const all = await db.select({ userId: profile.userId, mmr: profile.mmr }).from(profile);
  for (const p of all) {
    const v = soft ? Math.round((p.mmr + START_MMR) / 2) : START_MMR;
    await db.update(profile).set({ mmr: v }).where(eq(profile.userId, p.userId));
  }
  // Rozehrané hry a fronta se zruší
  await db.delete(queueEntry);
  await db.update(lobby).set({ status: "CANCELLED", deadline: null }).where(inArray(lobby.status, ["READY_CHECK", "CHOICE", "SIDE", "DRAFT", "IN_GAME", "CONFIRM"]));
}
