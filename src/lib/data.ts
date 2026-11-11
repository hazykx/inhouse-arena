import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { account, match, matchPlayer, profile, user, type Role } from "@/db/schema";
import { currentSeason } from "./season";
import { primaryAccounts, primaryOf } from "./riotAccounts";

export type PlayerRow = typeof matchPlayer.$inferSelect;

/* ───────── Pomocné výpočty ───────── */

export type GameRow = PlayerRow & { won: boolean; durationSec: number };

export function summarize(rows: GameRow[]) {
  const games = rows.length;
  const wins = rows.filter((r) => r.won).length;
  // Statistiky (KDA, CS…) jen ze zápasů, které je mají (zápasy z fronty bez ROFL je nemají)
  const statRows = rows.filter((r) => r.hasStats);
  const statGames = statRows.length;
  const sum = (f: (r: GameRow) => number) => statRows.reduce((a, r) => a + f(r), 0);
  const k = sum((r) => r.kills);
  const d = sum((r) => r.deaths);
  const as = sum((r) => r.assists);
  const minutes = sum((r) => r.durationSec) / 60;
  const roleCount = new Map<Role, number>();
  rows.forEach((r) => roleCount.set(r.role, (roleCount.get(r.role) ?? 0) + 1));
  const mainRole = [...roleCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    games,
    wins,
    losses: games - wins,
    winrate: games ? Math.round((wins / games) * 100) : 0,
    kda: d ? (k + as) / d : k + as,
    statGames,
    avgK: statGames ? k / statGames : 0,
    avgD: statGames ? d / statGames : 0,
    avgA: statGames ? as / statGames : 0,
    // za minutu = součet za všechny hry / celkový odehraný čas
    csPerMin: minutes ? sum((r) => r.cs) / minutes : 0,
    dmgPerMin: minutes ? sum((r) => r.damage) / minutes : 0,
    visionPerMin: minutes ? sum((r) => r.vision) / minutes : 0,
    mainRole,
    roleCount,
  };
}

/* ───────── Žebříček ───────── */

export async function getLeaderboard() {
  const players = await db
    .select({ id: user.id, name: user.name, image: user.image, mmr: profile.mmr, slug: profile.slug })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .orderBy(desc(profile.mmr));

  const byUser = await gamesByUser();
  const riot = await primaryAccounts();

  return players
    .map((p) => ({ ...p, riotName: riot.get(p.id)?.gameName ?? null, riotTag: riot.get(p.id)?.tagLine ?? null, ...summarize(byUser.get(p.id) ?? []) }))
    .filter((p) => p.games > 0);
}

/** Zápasy hráčů v aktuální sezóně */
async function gamesByUser() {
  const s = await currentSeason();
  const rows = await db
    .select({ mp: matchPlayer, winner: match.winner, durationSec: match.durationSec })
    .from(matchPlayer)
    .innerJoin(match, eq(match.id, matchPlayer.matchId))
    .where(eq(match.seasonId, s.id));
  const byUser = new Map<string, GameRow[]>();
  for (const { mp, winner, durationSec } of rows) {
    const list = byUser.get(mp.userId) ?? [];
    list.push({ ...mp, won: mp.team === winner, durationSec });
    byUser.set(mp.userId, list);
  }
  return byUser;
}

/** Průměr komunity (pro porovnání na profilu) */
export async function getCommunityAverages() {
  const all = [...(await gamesByUser()).values()].flat();
  return summarize(all);
}

/* ───────── Zápasy ───────── */

export async function getMatches(opts: { limit?: number; userId?: string } = {}) {
  let ids: number[] | undefined;
  if (opts.userId) {
    const own = await db
      .select({ id: matchPlayer.matchId })
      .from(matchPlayer)
      .innerJoin(match, eq(match.id, matchPlayer.matchId))
      .where(eq(matchPlayer.userId, opts.userId))
      .orderBy(desc(match.playedAt))
      .limit(opts.limit ?? 20);
    ids = own.map((o) => o.id);
    if (!ids.length) return [];
  }

  return db.query.match.findMany({
    where: ids ? inArray(match.id, ids) : undefined,
    orderBy: desc(match.playedAt),
    limit: opts.limit ?? 20,
    with: {
      players: {
        with: { user: { columns: { id: true, name: true, image: true } } },
      },
    },
  });
}
export type MatchWithPlayers = Awaited<ReturnType<typeof getMatches>>[number];

/* ───────── Profil hráče ───────── */

export async function getPlayer(userId: string) {
  const u = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { profile: true, riotAccounts: true, accounts: { columns: { providerId: true, accountId: true } } },
  });
  if (!u) return null;

  const rows = await db
    .select({ mp: matchPlayer, winner: match.winner, playedAt: match.playedAt, durationSec: match.durationSec })
    .from(matchPlayer)
    .innerJoin(match, eq(match.id, matchPlayer.matchId))
    .where(and(eq(matchPlayer.userId, userId), eq(match.seasonId, (await currentSeason()).id)))
    .orderBy(match.playedAt);

  const games = rows.map((r) => ({ ...r.mp, won: r.mp.team === r.winner, playedAt: r.playedAt, durationSec: r.durationSec }));
  const stats = summarize(games);

  // Inhouse champion pool
  const champMap = new Map<string, { games: number; wins: number; k: number; d: number; a: number; cs: number; min: number }>();
  for (const g of games) {
    if (!g.hasStats || !g.champion) continue;
    const c = champMap.get(g.champion) ?? { games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, min: 0 };
    c.cs += g.cs;
    c.min += g.durationSec / 60;
    c.games++;
    if (g.won) c.wins++;
    c.k += g.kills;
    c.d += g.deaths;
    c.a += g.assists;
    champMap.set(g.champion, c);
  }
  const inhouseChamps = [...champMap.entries()]
    .map(([champion, c]) => ({ champion, ...c, winrate: Math.round((c.wins / c.games) * 100), kda: c.d ? (c.k + c.a) / c.d : c.k + c.a, csPerMin: c.min ? c.cs / c.min : 0 }))
    .sort((a, b) => b.games - a.games);

  // Historie MMR pro graf
  const mmrHistory = games.map((g) => g.mmrAfter);
  const streak = (() => {
    let n = 0;
    const last = games.at(-1)?.won;
    for (let i = games.length - 1; i >= 0 && games[i].won === last; i--) n++;
    return last === undefined ? null : { won: last, count: n };
  })();

  // Pozice v žebříčku
  const all = await db.select({ id: profile.userId, mmr: profile.mmr }).from(profile).orderBy(desc(profile.mmr));
  const position = all.findIndex((p) => p.id === userId) + 1;

  return {
    user: u,
    primaryRiot: primaryOf(u.riotAccounts),
    stats,
    inhouseChamps,
    mmrHistory,
    streak,
    position,
    totalPlayers: all.length,
    twitch: u.accounts.find((a) => a.providerId === "twitch") ?? null,
    kick: u.accounts.find((a) => a.providerId === "kick") ?? null,
  };
}

/* ───────── Streameři ───────── */

export async function getStreamerAccounts() {
  return db
    .select({ userId: user.id, name: user.name, image: user.image, providerId: account.providerId, accountId: account.accountId })
    .from(account)
    .innerJoin(user, eq(user.id, account.userId))
    .where(inArray(account.providerId, ["twitch", "kick"]));
}

/* ───────── Přehled ───────── */

export async function getCounts() {
  const s = await currentSeason();
  const [players, matches] = await Promise.all([
    db.$count(profile),
    db.$count(match, eq(match.seasonId, s.id)),
  ]);
  return { players, matches };
}
