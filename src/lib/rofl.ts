import "server-only";
import type { Role } from "@/db/schema";

/* Čtení statistik z replay souboru League of Legends (.rofl).
   Starý formát ROFL i nový ROFL2 obsahují JSON s metadaty začínající {"gameLength"…,
   ve kterém je pole "statsJson" (JSON v textu) se statistikami všech 10 hráčů. */

export type RoflPlayer = {
  puuid: string | null;
  gameName: string;
  tagLine: string | null;
  champion: string;
  side: "BLUE" | "RED";
  win: boolean;
  position: Role | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damage: number;
  vision: number;
};
export type RoflData = { gameLengthMs: number; gameVersion: string; winner: "BLUE" | "RED"; players: RoflPlayer[] };

export class RoflError extends Error {}

const POSITION: Record<string, Role> = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", MID: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT", SUPPORT: "SUPPORT" };

/** Najde JSON objekt začínající na `start` a vrátí ho jako text (počítá závorky, hlídá řetězce) */
function extractJson(buf: Buffer, start: string): string | null {
  const from = buf.indexOf(start);
  if (from < 0) return null;
  let depth = 0, inStr = false, esc = false;
  const limit = Math.min(buf.length, from + 5_000_000);
  for (let i = from; i < limit; i++) {
    const c = buf[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 0x5c) esc = true; // \
      else if (c === 0x22) inStr = false; // "
      continue;
    }
    if (c === 0x22) inStr = true;
    else if (c === 0x7b) depth++; // {
    else if (c === 0x7d && --depth === 0) return buf.subarray(from, i + 1).toString("utf8"); // }
  }
  return null;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function parseRofl(buf: Buffer): RoflData {
  const head = buf.subarray(0, 4).toString("latin1");
  if (head !== "RIOT") throw new RoflError("Tohle není replay soubor League of Legends (.rofl).");

  const text = extractJson(buf, '{"gameLength"');
  if (!text) throw new RoflError("V souboru se nepodařilo najít statistiky zápasu.");

  let meta: { gameLength?: number; gameVersion?: string; statsJson?: string };
  let stats: Record<string, string>[];
  try {
    meta = JSON.parse(text);
    stats = JSON.parse(meta.statsJson ?? "[]");
  } catch {
    throw new RoflError("Statistiky v souboru jsou poškozené.");
  }
  if (!Array.isArray(stats) || stats.length !== 10) throw new RoflError(`Replay musí obsahovat 10 hráčů (obsahuje ${Array.isArray(stats) ? stats.length : 0}).`);

  const players: RoflPlayer[] = stats.map((s) => ({
    puuid: s.PUUID || null,
    gameName: s.RIOT_ID_GAME_NAME || s.NAME || s.SUMMONER_NAME || "?",
    tagLine: s.RIOT_ID_TAG_LINE || null,
    champion: s.SKIN || "",
    side: s.TEAM === "200" ? "RED" : "BLUE",
    win: s.WIN === "Win",
    position: POSITION[(s.TEAM_POSITION || s.INDIVIDUAL_POSITION || "").toUpperCase()] ?? null,
    kills: num(s.CHAMPIONS_KILLED),
    deaths: num(s.NUM_DEATHS),
    assists: num(s.ASSISTS),
    cs: num(s.MINIONS_KILLED) + num(s.NEUTRAL_MINIONS_KILLED),
    damage: num(s.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS),
    vision: num(s.VISION_SCORE),
  }));

  const blueWin = players.find((p) => p.side === "BLUE")?.win;
  return { gameLengthMs: num(meta.gameLength), gameVersion: meta.gameVersion ?? "", winner: blueWin ? "BLUE" : "RED", players };
}
