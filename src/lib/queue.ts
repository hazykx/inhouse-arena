import "server-only";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { lobby, lobbyPlayer, match, matchPlayer, profile, queueEntry, riotAccount, ROLES, user, type LobbyStatus, type ResultStats, type Role, type Team } from "@/db/schema";
import { getChampions } from "./riot";
import type { RoflData } from "./rofl";
import { activeSanction, addSanctionMs, isQueueEnabled, sanctionText } from "./moderation";
import { currentSeason } from "./season";

/* ═══════════════════════════════════════════════════════════════
   Fronta a draft
   1. Hráči se řadí do fronty na roli. Jakmile jsou na každou roli 2 → ready check.
   2. Všichni přijmou → z náhodné role se vyberou 2 kapitáni, hodí se mincí.
   3. Vítěz losu (tým A) volí: první výběr hráčů, NEBO stranu (blue/red).
      Když zvolí první výběr, poražený si vybere stranu.
   4. Draft A,B,A,B (začíná ten s prvním výběrem). Kapitán vybere hráče z role,
      druhý hráč stejné role jde automaticky soupeři.
   5. Hra → kapitán vítězů nahraje ROFL a určí výsledek → druhý kapitán potvrdí
      → zápas se uloží se statistikami z ROFL a přepočítá se MMR.
   Časové limity se vyhodnocují při každém dotazu na stav (žádný cron není potřeba).
   ═══════════════════════════════════════════════════════════════ */

export const READY_SECONDS = 30;
export const COIN_SECONDS = 4; // animace mince
export const CHOICE_SECONDS = 25;
export const PICK_SECONDS = 30;
const BOT_DELAY = 1500;
export const MISSED_READY_LIMIT = 3;
const MISSED_READY_PAUSE_MS = 30 * 60 * 1000;

const ACTIVE: LobbyStatus[] = ["READY_CHECK", "CHOICE", "SIDE", "DRAFT", "IN_GAME", "CONFIRM"];
const other = (t: Team): Team => (t === "A" ? "B" : "A");
const isBot = (userId: string) => userId.startsWith("demo-");
const botDelay = (userId: string) => 1000 + ([...userId].reduce((a, c) => a + c.charCodeAt(0), 0) % 8) * 900;
const sec = (n: number) => n * 1000;

export class QueueError extends Error {}

/* ───────── Fronta ───────── */

export async function activeLobbyOf(userId: string) {
  const rows = await db
    .select({ lobby })
    .from(lobbyPlayer)
    .innerJoin(lobby, eq(lobby.id, lobbyPlayer.lobbyId))
    .where(and(eq(lobbyPlayer.userId, userId), inArray(lobby.status, ACTIVE)));
  return rows[0]?.lobby ?? null;
}

export async function joinQueue(userId: string, role: Role) {
  if (!ROLES.includes(role)) throw new QueueError("Neznámá role.");
  if (!(await isQueueEnabled())) throw new QueueError("Fronta je teď vypnutá adminem.");
  const ban = await activeSanction(userId);
  if (ban) throw new QueueError(sanctionText(ban));
  if (await activeLobbyOf(userId)) throw new QueueError("Už jsi v rozehrané hře.");
  await db
    .insert(queueEntry)
    .values({ userId, role })
    .onConflictDoUpdate({ target: queueEntry.userId, set: { role } });
  await tryPop();
}

export async function leaveQueue(userId: string) {
  await db.delete(queueEntry).where(eq(queueEntry.userId, userId));
}

/** Když jsou na každou roli aspoň 2 hráči, vytvoří lobby s ready checkem */
async function tryPop() {
  await db.transaction(async (tx) => {
    const entries = await tx.select().from(queueEntry).orderBy(asc(queueEntry.joinedAt));
    const picked: (typeof entries)[number][] = [];
    for (const r of ROLES) {
      const forRole = entries.filter((e) => e.role === r).slice(0, 2);
      if (forRole.length < 2) return;
      picked.push(...forRole);
    }
    const mmrs = await tx.select({ userId: profile.userId, mmr: profile.mmr }).from(profile).where(inArray(profile.userId, picked.map((p) => p.userId)));
    const mmrOf = new Map(mmrs.map((m) => [m.userId, m.mmr]));
    const now = new Date();
    const code = Math.floor(1000 + Math.random() * 9000);
    const [l] = await tx
      .insert(lobby)
      .values({
        status: "READY_CHECK",
        phaseStartedAt: now,
        deadline: new Date(now.getTime() + sec(READY_SECONDS)),
        lobbyName: `Inhouse Arena ${code}`,
        lobbyPassword: String(Math.floor(1000 + Math.random() * 9000)),
      })
      .returning();
    await tx.insert(lobbyPlayer).values(
      picked.map((p) => ({ lobbyId: l.id, userId: p.userId, role: p.role, mmr: mmrOf.get(p.userId) ?? 1500, joinedAt: p.joinedAt, ready: isBot(p.userId) })),
    );
    await tx.delete(queueEntry).where(inArray(queueEntry.userId, picked.map((p) => p.userId)));
  });
}

/* ───────── Načtení lobby ───────── */

async function loadLobby(id: number) {
  const l = await db.query.lobby.findFirst({ where: eq(lobby.id, id) });
  if (!l) return null;
  const players = await db.select().from(lobbyPlayer).where(eq(lobbyPlayer.lobbyId, id));
  return { l, players };
}
type Loaded = NonNullable<Awaited<ReturnType<typeof loadLobby>>>;

const teamOfCaptain = (l: Loaded["l"], userId: string): Team | null => (l.captainA === userId ? "A" : l.captainB === userId ? "B" : null);
const captainOf = (l: Loaded["l"], t: Team) => (t === "A" ? l.captainA : l.captainB);

async function setLobby(id: number, values: Partial<typeof lobby.$inferInsert>) {
  await db.update(lobby).set(values).where(eq(lobby.id, id));
}

/* ───────── Přechody mezi fázemi ───────── */

async function startCaptains({ l, players }: Loaded) {
  // Testovací hra: kapitánem je tester a los dopadne, jak si vybral
  const tester = l.isTest && l.testCaptain ? players.find((p) => p.userId === l.testCaptain) : undefined;
  const forced = process.env.QUEUE_TEST_CAPTAIN_ROLE as Role | undefined;
  const role = tester?.role ?? (forced && ROLES.includes(forced) ? forced : ROLES[Math.floor(Math.random() * ROLES.length)]);
  const pair = players.filter((p) => p.role === role);
  let [winner, loser] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
  if (tester && l.testCoin !== "random") {
    const otherCap = pair.find((p) => p.userId !== tester.userId)!;
    [winner, loser] = l.testCoin === "win" ? [tester, otherCap] : [otherCap, tester];
  }
  const now = new Date();
  await db.update(lobbyPlayer).set({ team: "A" }).where(eq(lobbyPlayer.id, winner.id));
  await db.update(lobbyPlayer).set({ team: "B" }).where(eq(lobbyPlayer.id, loser.id));
  await setLobby(l.id, {
    status: "CHOICE",
    captainRole: role,
    captainA: winner.userId,
    captainB: loser.userId,
    turn: "A",
    phaseStartedAt: now,
    deadline: new Date(now.getTime() + sec(COIN_SECONDS + CHOICE_SECONDS)),
  });
}

/** Ready check selhal: kdo nepotvrdil, vypadne; ostatní se vrátí do fronty na své místo */
async function failReadyCheck({ l, players }: Loaded, kicked: string[]) {
  await setLobby(l.id, { status: "CANCELLED", deadline: null });
  if (l.isTest) return; // testovací hra nikoho do fronty nevrací
  // 3× po sobě nepřijatý ready check = pauza 30 minut
  for (const uid of kicked) {
    if (isBot(uid)) continue;
    const prof = await db.query.profile.findFirst({ where: eq(profile.userId, uid) });
    const missed = (prof?.missedReady ?? 0) + 1;
    if (missed >= MISSED_READY_LIMIT) {
      await addSanctionMs(uid, "QUEUE", MISSED_READY_PAUSE_MS, `${MISSED_READY_LIMIT}× po sobě nepřijatý ready check`, "system");
      await db.update(profile).set({ missedReady: 0 }).where(eq(profile.userId, uid));
    } else {
      await db.update(profile).set({ missedReady: missed }).where(eq(profile.userId, uid));
    }
  }
  const back = players.filter((p) => !kicked.includes(p.userId));
  if (back.length) {
    await db.insert(queueEntry).values(back.map((p) => ({ userId: p.userId, role: p.role, joinedAt: p.joinedAt }))).onConflictDoNothing();
  }
  await tryPop();
}

async function applyChoice(L: Loaded, option: "PICK" | "SIDE", side?: "BLUE" | "RED") {
  const now = new Date();
  if (option === "PICK") {
    await setLobby(L.l.id, { status: "SIDE", firstPick: "A", turn: "B", phaseStartedAt: now, deadline: new Date(now.getTime() + sec(CHOICE_SECONDS)) });
  } else {
    await setLobby(L.l.id, { status: "DRAFT", firstPick: "B", blueTeam: side === "RED" ? "B" : "A", turn: "B", phaseStartedAt: now, deadline: new Date(now.getTime() + sec(PICK_SECONDS)) });
  }
}

async function applySide(L: Loaded, side: "BLUE" | "RED") {
  const now = new Date();
  // stranu volí tým B (poražený v losu)
  await setLobby(L.l.id, { status: "DRAFT", blueTeam: side === "BLUE" ? "B" : "A", turn: L.l.firstPick ?? "A", phaseStartedAt: now, deadline: new Date(now.getTime() + sec(PICK_SECONDS)) });
}

async function applyPick(L: Loaded, team: Team, targetUserId: string) {
  const target = L.players.find((p) => p.userId === targetUserId);
  if (!target || target.team) throw new QueueError("Tohoto hráče nelze vybrat.");
  const partner = L.players.find((p) => p.role === target.role && p.userId !== target.userId)!;
  const order = L.players.filter((p) => p.pickOrder != null).length + 1;
  await db.update(lobbyPlayer).set({ team, pickOrder: order }).where(eq(lobbyPlayer.id, target.id));
  await db.update(lobbyPlayer).set({ team: other(team) }).where(eq(lobbyPlayer.id, partner.id));

  const remaining = L.players.filter((p) => !p.team && p.id !== target.id && p.id !== partner.id).length;
  const now = new Date();
  if (remaining === 0) {
    await setLobby(L.l.id, { status: "IN_GAME", turn: null, phaseStartedAt: now, deadline: null });
  } else {
    await setLobby(L.l.id, { turn: other(team), phaseStartedAt: now, deadline: new Date(now.getTime() + sec(PICK_SECONDS)) });
  }
}

/** Nejvyšší MMR z nevybraných – použije se při vypršení času a u botů */
const autoPickTarget = (L: Loaded) => L.players.filter((p) => !p.team).sort((a, b) => b.mmr - a.mmr)[0]?.userId;

/* ───────── Vyhodnocení výsledku a MMR ───────── */

async function finishMatch(L: Loaded, winnerSide: "BLUE" | "RED", stats?: ResultStats | null) {
  const { l, players } = L;
  if (l.isTest) {
    // Testovací hra se neukládá
    await setLobby(l.id, { status: "DONE", resultWinner: winnerSide, deadline: null });
    return;
  }
  const sideOf = (t: Team) => (t === l.blueTeam ? "BLUE" : "RED");
  const avg = (side: "BLUE" | "RED") => {
    const ps = players.filter((p) => sideOf(p.team!) === side);
    return ps.reduce((a, p) => a + p.mmr, 0) / ps.length;
  };
  const expectedBlue = 1 / (1 + 10 ** ((avg("RED") - avg("BLUE")) / 400));
  const K = 28;
  const deltaBlue = Math.round(K * ((winnerSide === "BLUE" ? 1 : 0) - expectedBlue));
  const now = new Date();
  const durationSec = stats?.gameLengthSec || Math.max(600, Math.round((now.getTime() - l.phaseStartedAt.getTime()) / 1000));

  await db.transaction(async (tx) => {
    const [m] = await tx.insert(match).values({ playedAt: now, durationSec, winner: winnerSide, seasonId: (await currentSeason()).id }).returning({ id: match.id });
    for (const p of players) {
      const side = sideOf(p.team!);
      const change = side === "BLUE" ? deltaBlue : -deltaBlue;
      const prof = await tx.query.profile.findFirst({ where: eq(profile.userId, p.userId) });
      const after = (prof?.mmr ?? 1500) + change;
      await tx.insert(profile).values({ userId: p.userId, mmr: after }).onConflictDoUpdate({ target: profile.userId, set: { mmr: after } });
      const st = stats?.players[p.userId];
      await tx.insert(matchPlayer).values({
        matchId: m.id, userId: p.userId, team: side, role: p.role, mmrChange: change, mmrAfter: after,
        ...(st ? { champion: st.champion, kills: st.kills, deaths: st.deaths, assists: st.assists, cs: st.cs, damage: st.damage, vision: st.vision, hasStats: true } : { champion: "", hasStats: false }),
      });
    }
    await tx.update(lobby).set({ status: "DONE", matchId: m.id, deadline: null }).where(eq(lobby.id, l.id));
  });
}

/* ───────── Tick: časové limity a boti ───────── */

async function tick(id: number) {
  // Smyčka: jeden tick může projít víc fází (např. boti rychle za sebou)
  for (let i = 0; i < 6; i++) {
    const L = await loadLobby(id);
    if (!L) return;
    const { l, players } = L;
    const now = Date.now();
    const elapsed = now - l.phaseStartedAt.getTime();
    const late = l.deadline != null && now > l.deadline.getTime();

    if (l.status === "READY_CHECK") {
      // Boti přijímají postupně (1–8 s), ať je ready check vidět
      const lateBots = players.filter((p) => !p.ready && isBot(p.userId) && elapsed > botDelay(p.userId));
      if (lateBots.length) {
        await db.update(lobbyPlayer).set({ ready: true }).where(inArray(lobbyPlayer.id, lateBots.map((p) => p.id)));
        continue;
      }
      if (players.every((p) => p.ready)) { await startCaptains(L); continue; }
      if (late) { await failReadyCheck(L, players.filter((p) => !p.ready).map((p) => p.userId)); return; }
      return;
    }
    if (l.status === "CHOICE") {
      const botTurn = isBot(l.captainA!) && elapsed > sec(COIN_SECONDS) + BOT_DELAY;
      if (botTurn || late) { await applyChoice(L, "PICK"); continue; }
      return;
    }
    if (l.status === "SIDE") {
      const botTurn = isBot(l.captainB!) && elapsed > BOT_DELAY;
      if (botTurn || late) { await applySide(L, "BLUE"); continue; }
      return;
    }
    if (l.status === "DRAFT") {
      const cap = captainOf(l, l.turn!)!;
      if ((isBot(cap) && elapsed > BOT_DELAY) || late) { await applyPick(L, l.turn!, autoPickTarget(L)!); continue; }
      return;
    }
    if (l.status === "IN_GAME") {
      // Testovací boti: když jsou kapitány, po 20 s nahlásí výsledek (bez ROFL)
      if (elapsed > sec(l.isTest ? 45 : 20)) {
        const botTeam = isBot(l.captainA!) ? "A" : isBot(l.captainB!) ? "B" : null;
        if (botTeam) {
          const side = botTeam === l.blueTeam ? "BLUE" : "RED";
          await setLobby(l.id, { status: "CONFIRM", resultWinner: side, resultBy: botTeam, resultStats: null, phaseStartedAt: new Date() });
          continue;
        }
      }
      return;
    }
    if (l.status === "CONFIRM") {
      const confirmer = l.resultBy === "A" ? l.captainB! : l.captainA!;
      if (isBot(confirmer) && elapsed > BOT_DELAY) { await finishMatch(L, l.resultWinner!, l.resultStats); return; }
      return;
    }
    return;
  }
}

/* ───────── Akce hráčů ───────── */

async function requireLobby(userId: string) {
  const l = await activeLobbyOf(userId);
  if (!l) throw new QueueError("Nejsi v žádné hře.");
  await tick(l.id);
  const L = await loadLobby(l.id);
  if (!L) throw new QueueError("Hra neexistuje.");
  return L;
}

export async function setReady(userId: string, accept: boolean) {
  const L = await requireLobby(userId);
  if (L.l.status !== "READY_CHECK") return;
  if (!accept) return failReadyCheck(L, [userId]);
  await db.update(lobbyPlayer).set({ ready: true }).where(and(eq(lobbyPlayer.lobbyId, L.l.id), eq(lobbyPlayer.userId, userId)));
  if (!L.l.isTest) await db.update(profile).set({ missedReady: 0 }).where(eq(profile.userId, userId));
  await tick(L.l.id);
}

export async function choose(userId: string, option: "PICK" | "SIDE", side?: "BLUE" | "RED") {
  const L = await requireLobby(userId);
  if (L.l.status !== "CHOICE" || L.l.captainA !== userId) throw new QueueError("Teď nevolíš ty.");
  if (Date.now() - L.l.phaseStartedAt.getTime() < sec(COIN_SECONDS) - 500) throw new QueueError("Mince ještě padá.");
  if (option === "SIDE" && side !== "BLUE" && side !== "RED") throw new QueueError("Vyber stranu.");
  await applyChoice(L, option, side);
  await tick(L.l.id);
}

export async function chooseSide(userId: string, side: "BLUE" | "RED") {
  const L = await requireLobby(userId);
  if (L.l.status !== "SIDE" || L.l.captainB !== userId) throw new QueueError("Teď nevolíš ty.");
  await applySide(L, side);
  await tick(L.l.id);
}

export async function pick(userId: string, targetUserId: string) {
  const L = await requireLobby(userId);
  const team = teamOfCaptain(L.l, userId);
  if (L.l.status !== "DRAFT" || !team || L.l.turn !== team) throw new QueueError("Teď nevybíráš ty.");
  await applyPick(L, team, targetUserId);
  await tick(L.l.id);
}

/** Přiřadí hráče z ROFL k hráčům lobby: PUUID → Riot ID → role na stejné straně → zbytek */
async function matchRoflPlayers(L: Loaded, rofl: RoflData): Promise<ResultStats> {
  const sideOf = (t: Team) => (t === L.l.blueTeam ? "BLUE" : "RED");
  const accounts = await db.select().from(riotAccount).where(inArray(riotAccount.userId, L.players.map((p) => p.userId)));
  const accsOf = (uid: string) => accounts.filter((a) => a.userId === uid);
  const champs = await getChampions();
  const champId = (skin: string) => [...champs.byId.keys()].find((id) => id.toLowerCase() === skin.toLowerCase()) ?? skin;

  const free = [...rofl.players];
  const take = (pred: (r: (typeof free)[number]) => boolean) => {
    const i = free.findIndex(pred);
    return i >= 0 ? free.splice(i, 1)[0] : undefined;
  };
  const result: ResultStats = { gameLengthSec: Math.round(rofl.gameLengthMs / 1000), players: {} };
  const assigned = new Map<string, (typeof free)[number]>();
  const steps: ((p: Loaded["players"][number]) => ((r: (typeof free)[number]) => boolean))[] = [
    (p) => (r) => accsOf(p.userId).some((a) => r.puuid === a.puuid),
    (p) => (r) => accsOf(p.userId).some((a) => r.gameName.toLowerCase() === a.gameName.toLowerCase()),
    (p) => (r) => r.side === sideOf(p.team!) && r.position === p.role,
    (p) => (r) => r.side === sideOf(p.team!),
  ];
  for (const step of steps) {
    for (const p of L.players) {
      if (assigned.has(p.userId)) continue;
      const r = take(step(p));
      if (r) assigned.set(p.userId, r);
    }
  }
  for (const [userId, r] of assigned) {
    result.players[userId] = { champion: champId(r.champion), kills: r.kills, deaths: r.deaths, assists: r.assists, cs: r.cs, damage: r.damage, vision: r.vision };
  }
  return result;
}

/** Vymyšlený replay pro testovací hru */
function simulateRofl(L: Loaded, winner: "BLUE" | "RED"): RoflData {
  const champs: Record<Role, string[]> = { TOP: ["Ornn", "Garen", "Darius"], JUNGLE: ["LeeSin", "Vi", "Viego"], MID: ["Ahri", "Syndra", "Yone"], ADC: ["Jinx", "Kaisa", "Ezreal"], SUPPORT: ["Thresh", "Lulu", "Nautilus"] };
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    gameLengthMs: (25 + r(12)) * 60000,
    gameVersion: "test",
    winner,
    players: L.players.map((p) => {
      const side = p.team === L.l.blueTeam ? "BLUE" : "RED";
      return { puuid: null, gameName: p.userId, tagLine: null, champion: champs[p.role][r(3)], side, win: side === winner, position: p.role, kills: r(12), deaths: r(8), assists: r(15), cs: p.role === "SUPPORT" ? 30 + r(30) : 150 + r(120), damage: 8000 + r(25000), vision: 15 + r(50) };
    }),
  };
}

/** Kapitán vítězného týmu nahraje ROFL a určí výsledek */
export async function submitResult(userId: string, winner: "BLUE" | "RED", roflIn: RoflData | null) {
  let rofl = roflIn;
  const L = await requireLobby(userId);
  const team = teamOfCaptain(L.l, userId);
  if (L.l.status !== "IN_GAME" || !team) throw new QueueError("Výsledek nahlašuje kapitán.");
  const mySide = team === L.l.blueTeam ? "BLUE" : "RED";
  if (winner !== mySide) throw new QueueError("Výsledek nahrává kapitán týmu, který vyhrál.");
  if (!rofl && L.l.isTest) rofl = simulateRofl(L, winner);
  if (!rofl) throw new QueueError("Nahraj replay soubor (.rofl).");
  if (rofl.winner !== winner) throw new QueueError(`Podle replaye vyhrál tým ${rofl.winner}. Zkontroluj, že nahráváš správný zápas.`);
  const stats = await matchRoflPlayers(L, rofl);
  await setLobby(L.l.id, { status: "CONFIRM", resultWinner: winner, resultBy: team, resultStats: stats, disputed: false, phaseStartedAt: new Date() });
  await tick(L.l.id);
}

/** Druhý kapitán potvrdí, nebo rozporuje výsledek */
export async function confirmResult(userId: string, accept: boolean) {
  const L = await requireLobby(userId);
  const team = teamOfCaptain(L.l, userId);
  if (L.l.status !== "CONFIRM" || !team || team === L.l.resultBy) throw new QueueError("Výsledek potvrzuje kapitán soupeře.");
  if (accept) await finishMatch(L, L.l.resultWinner!, L.l.resultStats);
  else await setLobby(L.l.id, { status: "IN_GAME", disputed: true, phaseStartedAt: new Date() });
}

/** Kapitán RED vloží odkaz na draft šampionů (pick & ban) */
export async function setDraftUrl(userId: string, url: string) {
  const L = await requireLobby(userId);
  const team = teamOfCaptain(L.l, userId);
  if (L.l.status !== "IN_GAME" || !team || team === L.l.blueTeam) throw new QueueError("Draft zakládá kapitán RED.");
  const clean = url.trim().slice(0, 300);
  if (clean && !/^https?:\/\//i.test(clean)) throw new QueueError("Odkaz musí začínat http:// nebo https://");
  await setLobby(L.l.id, { draftUrl: clean || null });
}

/* ───────── Admin ───────── */

export async function adminCancel(lobbyId: number) {
  await setLobby(lobbyId, { status: "CANCELLED", deadline: null });
}

export async function adminResolve(lobbyId: number, winner: "BLUE" | "RED") {
  const L = await loadLobby(lobbyId);
  if (!L || (L.l.status !== "IN_GAME" && L.l.status !== "CONFIRM")) throw new QueueError("Hru nelze vyhodnotit.");
  await finishMatch(L, winner, L.l.status === "CONFIRM" && L.l.resultWinner === winner ? L.l.resultStats : null);
}

/** Doplní frontu ukázkovými hráči (demo-*) tak, aby byly 2 na každou roli – na testování */
export async function fillWithBots() {
  const busy = await db.select({ userId: lobbyPlayer.userId }).from(lobbyPlayer).innerJoin(lobby, eq(lobby.id, lobbyPlayer.lobbyId)).where(inArray(lobby.status, ACTIVE));
  const queued = await db.select().from(queueEntry);
  const exclude = [...busy.map((b) => b.userId), ...queued.map((q) => q.userId)];
  const bots = await db.select({ id: user.id }).from(user).where(exclude.length ? notInArray(user.id, exclude) : undefined);
  const free = bots.map((b) => b.id).filter(isBot);
  if (!free.length) throw new QueueError("Nejsou volní ukázkoví hráči – spusť ukazkova-data.bat.");
  const base = Date.now();
  for (const r of ROLES) {
    const need = 2 - queued.filter((q) => q.role === r).length;
    for (let i = 0; i < need; i++) {
      const id = free.shift();
      if (!id) throw new QueueError("Málo ukázkových hráčů.");
      await db.insert(queueEntry).values({ userId: id, role: r, joinedAt: new Date(base + 1000) });
    }
  }
  await tryPop();
}

/** Testovací hra: tester + 9 botů, tester je vždy kapitán, výsledek se neukládá */
export async function createTestGame(userId: string, role: Role, coin: "win" | "lose" | "random") {
  if (!ROLES.includes(role)) throw new QueueError("Vyber roli.");
  if (await activeLobbyOf(userId)) throw new QueueError("Už jsi v rozehrané hře.");
  await db.delete(queueEntry).where(eq(queueEntry.userId, userId));

  const busy = await db.select({ userId: lobbyPlayer.userId }).from(lobbyPlayer).innerJoin(lobby, eq(lobby.id, lobbyPlayer.lobbyId)).where(inArray(lobby.status, ACTIVE));
  const queued = await db.select({ userId: queueEntry.userId }).from(queueEntry);
  const exclude = new Set([...busy, ...queued].map((x) => x.userId));
  const bots = (await db.select({ id: user.id }).from(user)).map((u) => u.id).filter((id) => isBot(id) && !exclude.has(id));
  if (bots.length < 9) throw new QueueError("Chybí ukázkoví hráči – spusť nejdřív ukazkova-data.bat.");

  const slots: { userId: string; role: Role }[] = [{ userId, role }];
  for (const r of ROLES) {
    for (let i = 0; i < (r === role ? 1 : 2); i++) slots.push({ userId: bots.shift()!, role: r });
  }
  const mmrs = await db.select({ userId: profile.userId, mmr: profile.mmr }).from(profile).where(inArray(profile.userId, slots.map((x) => x.userId)));
  const mmrOf = new Map(mmrs.map((m) => [m.userId, m.mmr]));
  const now = new Date();
  const [l] = await db
    .insert(lobby)
    .values({
      status: "READY_CHECK", phaseStartedAt: now, deadline: new Date(now.getTime() + sec(READY_SECONDS)),
      lobbyName: `Inhouse Arena TEST ${Math.floor(1000 + Math.random() * 9000)}`, lobbyPassword: String(Math.floor(1000 + Math.random() * 9000)),
      isTest: true, testCaptain: userId, testCoin: coin,
    })
    .returning();
  await db.insert(lobbyPlayer).values(slots.map((x) => ({ lobbyId: l.id, userId: x.userId, role: x.role, mmr: mmrOf.get(x.userId) ?? 1500, joinedAt: now, ready: false })));
}

/** Tester může svou testovací hru kdykoliv ukončit */
export async function endTestGame(userId: string) {
  const l = await activeLobbyOf(userId);
  if (!l || !l.isTest || l.testCaptain !== userId) throw new QueueError("Nejsi v testovací hře.");
  await setLobby(l.id, { status: "CANCELLED", deadline: null });
}

/** Testovací nástroje: admin, nebo web spuštěný ve vývojovém režimu (start.bat) */
export const testToolsEnabled = (admin: boolean) => admin || process.env.NODE_ENV !== "production";

/* ───────── Stav pro klienta ───────── */

export async function getQueueState(userId: string | null) {
  // Vyhodnotit časové limity u všech aktivních lobby (je jich málo)
  const actives = await db.select({ id: lobby.id }).from(lobby).where(inArray(lobby.status, ACTIVE));
  for (const a of actives) await tick(a.id);

  const entries = await db
    .select({ userId: queueEntry.userId, role: queueEntry.role, joinedAt: queueEntry.joinedAt, name: user.name, image: user.image })
    .from(queueEntry)
    .innerJoin(user, eq(user.id, queueEntry.userId))
    .orderBy(asc(queueEntry.joinedAt));
  const counts = Object.fromEntries(ROLES.map((r) => [r, entries.filter((e) => e.role === r).length])) as Record<Role, number>;
  const me = userId ? entries.find((e) => e.userId === userId) : undefined;
  const inGame = (await db.select({ id: lobby.id }).from(lobby).where(inArray(lobby.status, ["DRAFT", "IN_GAME"]))).length;

  let lobbyState = null;
  const myLobby = userId ? await activeLobbyOf(userId) : null;
  // Po skončení ukážeme výsledek ještě chvíli
  const recent = !myLobby && userId
    ? (await db.select({ lobby }).from(lobbyPlayer).innerJoin(lobby, eq(lobby.id, lobbyPlayer.lobbyId)).where(and(eq(lobbyPlayer.userId, userId), inArray(lobby.status, ["DONE", "CANCELLED"]))).orderBy(asc(lobby.updatedAt))).at(-1)?.lobby
    : null;
  const showLobby = myLobby ?? (recent && Date.now() - recent.updatedAt.getTime() < 15000 ? recent : null);

  if (showLobby) {
    const L = (await loadLobby(showLobby.id))!;
    const users = await db.select({ id: user.id, name: user.name, image: user.image }).from(user).where(inArray(user.id, L.players.map((p) => p.userId)));
    const uOf = new Map(users.map((u) => [u.id, u]));
    const myTeam = L.players.find((p) => p.userId === userId)?.team ?? null;
    const amCaptain = userId ? teamOfCaptain(L.l, userId) : null;
    const inPostDraft = ["IN_GAME", "CONFIRM", "DONE"].includes(L.l.status);
    lobbyState = {
      id: L.l.id,
      meId: userId,
      status: L.l.status,
      phaseStartedAt: L.l.phaseStartedAt.getTime(),
      deadline: L.l.deadline?.getTime() ?? null,
      captainRole: L.l.captainRole,
      captainA: L.l.captainA,
      captainB: L.l.captainB,
      firstPick: L.l.firstPick,
      blueTeam: L.l.blueTeam,
      turn: L.l.turn,
      resultWinner: L.l.resultWinner,
      resultBy: L.l.resultBy,
      disputed: L.l.disputed,
      resultStats: L.l.resultStats
        ? Object.entries(L.l.resultStats.players).map(([uid, st]) => ({ userId: uid, ...st }))
        : null,
      matchId: L.l.matchId,
      draftUrl: L.l.draftUrl,
      isTest: L.l.isTest,
      myTeam,
      amCaptain,
      lobbyName: inPostDraft ? L.l.lobbyName : null,
      lobbyPassword: inPostDraft ? L.l.lobbyPassword : null,
      players: L.players
        .map((p) => ({ id: p.userId, name: uOf.get(p.userId)?.name ?? "?", image: uOf.get(p.userId)?.image ?? null, role: p.role, mmr: p.mmr, ready: p.ready, team: p.team, pickOrder: p.pickOrder }))
        .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)),
    };
  }

  return {
    now: Date.now(),
    queue: { counts, players: entries.map((e) => ({ id: e.userId, name: e.name, image: e.image, role: e.role })), inGame },
    me: me ? { role: me.role, joinedAt: me.joinedAt.getTime() } : null,
    lobby: lobbyState,
    timings: { READY_SECONDS, COIN_SECONDS, CHOICE_SECONDS, PICK_SECONDS },
    queueEnabled: await isQueueEnabled(),
    sanction: userId ? await activeSanction(userId).then((s) => (s ? { type: s.type, text: sanctionText(s) } : null)) : null,
  };
}

export type QueueState = Awaited<ReturnType<typeof getQueueState>>;

/** Admin: vyprázdní frontu a zruší všechny rozehrané hry (před ukončením zápasu) */
export async function resetQueue() {
  await db.delete(queueEntry);
  await db.update(lobby).set({ status: "CANCELLED", deadline: null }).where(inArray(lobby.status, ACTIVE));
}

/** Přehled rozehraných her pro admina */
export async function listActiveLobbies() {
  const ls = await db.select().from(lobby).where(inArray(lobby.status, ACTIVE));
  const out = [];
  for (const l of ls) {
    const ps = await db.select({ userId: lobbyPlayer.userId, name: user.name }).from(lobbyPlayer).innerJoin(user, eq(user.id, lobbyPlayer.userId)).where(eq(lobbyPlayer.lobbyId, l.id));
    out.push({ id: l.id, status: l.status, disputed: l.disputed, resultWinner: l.resultWinner, createdAt: l.createdAt.getTime(), players: ps.map((p) => p.name) });
  }
  return out;
}
