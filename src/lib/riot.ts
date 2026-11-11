import "server-only";

/* ───────────── Regiony ─────────────
   platform = server hry (eun1, euw1…), regional = cluster pro Account a Match API */

export const PLATFORMS = {
  eun1: { label: "EUNE", regional: "europe" },
  euw1: { label: "EUW", regional: "europe" },
  na1: { label: "NA", regional: "americas" },
  kr: { label: "KR", regional: "asia" },
} as const;
export type Platform = keyof typeof PLATFORMS;
export const isPlatform = (p: string): p is Platform => p in PLATFORMS;

/* ───────────── Typy odpovědí ───────────── */

export type RiotAccountDto = { puuid: string; gameName: string; tagLine: string };
export type SummonerDto = { puuid: string; profileIconId: number; summonerLevel: number };
export type LeagueEntryDto = {
  queueType: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | string;
  tier: string; // IRON … CHALLENGER
  rank: string; // I–IV
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak?: boolean;
};
export type MasteryDto = {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
};

export class RiotError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const hasRiotKey = () => !!process.env.RIOT_API_KEY;

async function riotFetch<T>(url: string, revalidate: number | false = 300): Promise<T> {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new RiotError(500, "Chybí RIOT_API_KEY v .env");

  const res = await fetch(url, {
    headers: { "X-Riot-Token": key },
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
  });

  if (!res.ok) {
    const msg =
      res.status === 404
        ? "Nenalezeno"
        : res.status === 401 || res.status === 403
          ? "Neplatný nebo expirovaný Riot API klíč"
          : res.status === 429
            ? "Překročen limit Riot API, zkus to za chvíli"
            : `Riot API chyba ${res.status}`;
    throw new RiotError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

/* ───────────── Endpoints ───────────── */

export function getAccountByRiotId(gameName: string, tagLine: string, platform: Platform) {
  const r = PLATFORMS[platform].regional;
  return riotFetch<RiotAccountDto>(
    `https://${r}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    false,
  );
}

export function getAccountByPuuid(puuid: string, platform: Platform) {
  const r = PLATFORMS[platform].regional;
  return riotFetch<RiotAccountDto>(
    `https://${r}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`,
    3600,
  );
}

/** fresh=true obchází cache – aktuální ikona a úroveň při propojení */
export function getSummoner(puuid: string, platform: Platform, fresh = false) {
  return riotFetch<SummonerDto>(
    `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
    fresh ? false : 600,
  );
}

export function getLeagueEntries(puuid: string, platform: Platform) {
  return riotFetch<LeagueEntryDto[]>(
    `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
    600,
  );
}

export function getTopMasteries(puuid: string, platform: Platform, count = 8) {
  return riotFetch<MasteryDto[]>(
    `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`,
    1800,
  );
}

/* ───────────── Data Dragon (obrázky a jména šampionů, bez API klíče) ───────────── */

const DD = "https://ddragon.leagueoflegends.com";

export async function getDDVersion(): Promise<string> {
  try {
    const res = await fetch(`${DD}/api/versions.json`, { next: { revalidate: 86400 } });
    const versions = (await res.json()) as string[];
    return versions[0];
  } catch {
    return "15.1.1";
  }
}

export type ChampInfo = { id: string; key: string; name: string };

/** Mapa šampionů: podle číselného klíče ("64") i podle id ("LeeSin") */
export async function getChampions() {
  const v = await getDDVersion();
  const byKey = new Map<string, ChampInfo>();
  const byId = new Map<string, ChampInfo>();
  try {
    const res = await fetch(`${DD}/cdn/${v}/data/cs_CZ/champion.json`, { next: { revalidate: 86400 } });
    const json = (await res.json()) as { data: Record<string, ChampInfo> };
    for (const c of Object.values(json.data)) {
      byKey.set(c.key, c);
      byId.set(c.id, c);
    }
  } catch {
    /* bez internetu prostě nebudou jména */
  }
  return { version: v, byKey, byId };
}

export const champIcon = (version: string, champId: string) =>
  `${DD}/cdn/${version}/img/champion/${champId}.png`;
export const profileIcon = (version: string, iconId: number) =>
  `${DD}/cdn/${version}/img/profileicon/${iconId}.png`;

/* ───────────── Rank ───────────── */

export const TIER_CS: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
};

export const TIER_COLOR: Record<string, string> = {
  IRON: "#8b8b93",
  BRONZE: "#b0805e",
  SILVER: "#a9b4c2",
  GOLD: "#e2b85c",
  PLATINUM: "#5ec2b0",
  EMERALD: "#4fcf86",
  DIAMOND: "#7ea6ff",
  MASTER: "#c07ef0",
  GRANDMASTER: "#ef6f6f",
  CHALLENGER: "#f3d67a",
};

export const formatRank = (e: Pick<LeagueEntryDto, "tier" | "rank">) =>
  ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(e.tier)
    ? TIER_CS[e.tier]
    : `${TIER_CS[e.tier] ?? e.tier} ${e.rank}`;
