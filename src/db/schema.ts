import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date()),
};

/* ───────────────────────── Better Auth ─────────────────────────
   Tabulky, které potřebuje přihlašování (user, session, account, verification).
   Účty Discord / Twitch / Kick jsou řádky v tabulce `account`. */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
});

/* ───────────────────────── Inhouse ───────────────────────── */

export const ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

/** Herní profil hráče – MMR a preferované role. Vzniká při prvním přihlášení. */
export const profile = sqliteTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  mmr: integer("mmr").notNull().default(1500),
  mainRole: text("main_role").$type<Role>(),
  secondaryRole: text("secondary_role").$type<Role>(),
  bio: text("bio"),
  ...timestamps,
});

/** Propojený League of Legends účet. Jeden na hráče, ověřený změnou ikony. */
export const riotAccount = sqliteTable(
  "riot_account",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    puuid: text("puuid").notNull(),
    gameName: text("game_name").notNull(),
    tagLine: text("tag_line").notNull(),
    platform: text("platform").notNull(), // např. eun1, euw1
    profileIconId: integer("profile_icon_id"),
    summonerLevel: integer("summoner_level"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    verifyIconId: integer("verify_icon_id"),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("riot_user_uq").on(t.userId), index("riot_puuid_idx").on(t.puuid)],
);

/** Jeden inhouse zápas. */
export const match = sqliteTable("match", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playedAt: integer("played_at", { mode: "timestamp_ms" }).notNull(),
  durationSec: integer("duration_sec").notNull(),
  winner: text("winner").$type<"BLUE" | "RED">().notNull(),
  tournamentCode: text("tournament_code"),
  ...timestamps,
});

/** Hráč v konkrétním zápase. */
export const matchPlayer = sqliteTable(
  "match_player",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: integer("match_id")
      .notNull()
      .references(() => match.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    team: text("team").$type<"BLUE" | "RED">().notNull(),
    role: text("role").$type<Role>().notNull(),
    champion: text("champion").notNull(), // Data Dragon id, např. "LeeSin"
    kills: integer("kills").notNull().default(0),
    deaths: integer("deaths").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    // Hodnoty jako v Riot match-v5: cs = totalMinionsKilled + neutralMinionsKilled,
    // damage = totalDamageDealtToChampions, vision = visionScore
    cs: integer("cs").notNull().default(0),
    damage: integer("damage").notNull().default(0),
    vision: integer("vision").notNull().default(0),
    // false = zápas z fronty, kde zatím nejsou šampioni a KDA (doplní je turnajové kódy)
    hasStats: integer("has_stats", { mode: "boolean" }).notNull().default(true),
    mmrChange: integer("mmr_change").notNull().default(0),
    mmrAfter: integer("mmr_after").notNull().default(1500),
  },
  (t) => [index("mp_match_idx").on(t.matchId), index("mp_user_idx").on(t.userId)],
);

/* ───────────────────────── Inzeráty a turnaje ───────────────────────── */

// Časová razítka počítaná v aplikaci (nové tabulky si web umí vytvořit sám)
const appTimestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
};

export const LFG_TAGS = ["Duo", "Flex", "Inhouse", "Clash", "Turnaj", "Liga"] as const;

/** Inzerát: hráč hledá tým (PLAYER) nebo tým hledá hráče (TEAM) */
export const lfgPost = sqliteTable(
  "lfg_post",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"PLAYER" | "TEAM">().notNull(),
    teamName: text("team_name"),
    rank: text("rank"),
    roles: text("roles", { mode: "json" }).$type<Role[]>().notNull(),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    text: text("text").notNull(),
    ...appTimestamps,
  },
  (t) => [index("lfg_kind_idx").on(t.kind)],
);

/** Turnaj nebo liga na stránce Turnaje a ligy */
export const tournament = sqliteTable("tournament", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  organizer: text("organizer").notNull(),
  kind: text("kind").$type<"TURNAJ" | "LIGA">().notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  registrationUntil: integer("registration_until", { mode: "timestamp_ms" }),
  format: text("format").notNull(),
  prize: text("prize"),
  capacity: text("capacity"),
  url: text("url"),
  description: text("description"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  ...appTimestamps,
});

/* ───────────────────────── Fronta a draft ───────────────────────── */

export type Team = "A" | "B";
/** Statistiky přiřazené k hráčům lobby (z ROFL souboru) */
export type ResultStats = {
  gameLengthSec: number;
  players: Record<string, { champion: string; kills: number; deaths: number; assists: number; cs: number; damage: number; vision: number }>;
};
export type LobbyStatus = "READY_CHECK" | "CHOICE" | "SIDE" | "DRAFT" | "IN_GAME" | "CONFIRM" | "DONE" | "CANCELLED";

/** Hráč čekající ve frontě na konkrétní roli */
export const queueEntry = sqliteTable("queue_entry", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").$type<Role>().notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Nalezená hra: ready check → los → volba → draft → hra → výsledek.
 *  Tým A = kapitán, který vyhrál los mincí. */
export const lobby = sqliteTable("lobby", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").$type<LobbyStatus>().notNull(),
  captainRole: text("captain_role").$type<Role>(),
  captainA: text("captain_a"),
  captainB: text("captain_b"),
  firstPick: text("first_pick").$type<Team>(),
  blueTeam: text("blue_team").$type<Team>(),
  turn: text("turn").$type<Team>(),
  phaseStartedAt: integer("phase_started_at", { mode: "timestamp_ms" }).notNull(),
  deadline: integer("deadline", { mode: "timestamp_ms" }),
  lobbyName: text("lobby_name").notNull(),
  lobbyPassword: text("lobby_password").notNull(),
  // Výsledek: kapitán vítězů nahraje ROFL a určí vítěze, druhý kapitán potvrdí
  resultWinner: text("result_winner").$type<"BLUE" | "RED">(),
  resultBy: text("result_by").$type<Team>(),
  resultStats: text("result_stats", { mode: "json" }).$type<ResultStats | null>(),
  disputed: integer("disputed", { mode: "boolean" }).notNull().default(false),
  draftUrl: text("draft_url"), // odkaz na draft šampionů od kapitána RED
  // Testovací hra s boty: neukládá se do statistik ani MMR
  isTest: integer("is_test", { mode: "boolean" }).notNull().default(false),
  testCaptain: text("test_captain"),
  testCoin: text("test_coin").$type<"win" | "lose" | "random">(),
  matchId: integer("match_id"),
  ...appTimestamps,
});

export const lobbyPlayer = sqliteTable(
  "lobby_player",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lobbyId: integer("lobby_id")
      .notNull()
      .references(() => lobby.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    mmr: integer("mmr").notNull(),
    ready: integer("ready", { mode: "boolean" }).notNull().default(false),
    team: text("team").$type<Team>(),
    pickOrder: integer("pick_order"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("lp_lobby_idx").on(t.lobbyId), index("lp_user_idx").on(t.userId)],
);

/* ───────────────────────── Relace ───────────────────────── */

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(profile, { fields: [user.id], references: [profile.userId] }),
  riotAccount: one(riotAccount, { fields: [user.id], references: [riotAccount.userId] }),
  accounts: many(account),
  matches: many(matchPlayer),
}));

export const matchRelations = relations(match, ({ many }) => ({
  players: many(matchPlayer),
}));

export const matchPlayerRelations = relations(matchPlayer, ({ one }) => ({
  match: one(match, { fields: [matchPlayer.matchId], references: [match.id] }),
  user: one(user, { fields: [matchPlayer.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const lfgPostRelations = relations(lfgPost, ({ one }) => ({
  user: one(user, { fields: [lfgPost.userId], references: [user.id] }),
}));

export const tournamentRelations = relations(tournament, ({ one }) => ({
  user: one(user, { fields: [tournament.userId], references: [user.id] }),
}));
