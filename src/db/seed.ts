/**
 * Ukázková data: 12 demo hráčů a 40 zápasů, aby žebříček, historie
 * a profily nebyly prázdné. Spuštění: npm run db:seed
 *
 * Pokud už ses přihlásil přes Discord, zařadí seed do zápasů i tebe,
 * takže uvidíš svůj profil se statistikami.
 * Opakované spuštění smaže staré zápasy a demo hráče a vytvoří nové.
 */
import "dotenv/config";
import { eq, like, notLike } from "drizzle-orm";
import { db } from "./index";
import { lfgPost, lobby, lobbyPlayer, match, matchPlayer, profile, queueEntry, tournament, user, type Role } from "./schema";

const DEMO = [
  "Kryštof", "Vlkodlak", "Nerf Pls", "Bára", "Toplane Tom", "Smajlík",
  "Ondra 1v9", "Hookmaster", "Gankoš", "Pepa Kapr", "Lucinka", "Baron Steal",
];
const CHAMPS: Record<Role, string[]> = {
  TOP: ["Ornn", "Renekton", "Garen", "KSante", "Darius", "Camille", "Gwen"],
  JUNGLE: ["LeeSin", "Vi", "Sejuani", "Viego", "Graves", "Kayn", "JarvanIV"],
  MID: ["Ahri", "Syndra", "Orianna", "Azir", "Sylas", "Viktor", "Yone"],
  ADC: ["Jinx", "Kaisa", "Ezreal", "Caitlyn", "Ashe", "Xayah", "Varus"],
  SUPPORT: ["Thresh", "Nautilus", "Lulu", "Rakan", "Leona", "Nami", "Braum"],
};
const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
// Typické hodnoty za minutu podle role: [CS, poškození, vision]
const PER_MIN: Record<Role, [number, number, number]> = {
  TOP: [7.0, 620, 0.6],
  JUNGLE: [5.8, 470, 1.0],
  MID: [7.6, 760, 0.7],
  ADC: [8.2, 820, 0.6],
  SUPPORT: [1.2, 260, 2.3],
};

let s = 42;
const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const shuffle = <T,>(a: T[]) => [...a].sort(() => rnd() - 0.5);

async function main() {
  console.log("🧹 Mažu staré zápasy a demo hráče…");
  await db.delete(lobbyPlayer);
  await db.delete(lobby);
  await db.delete(queueEntry);
  await db.delete(matchPlayer);
  await db.delete(match);
  await db.delete(lfgPost).where(like(lfgPost.userId, "demo-%"));
  await db.delete(tournament).where(like(tournament.userId, "demo-%"));
  await db.delete(user).where(like(user.email, "%@demo.inhouse"));

  console.log("👥 Vytvářím demo hráče…");
  const demoUsers = DEMO.map((name, i) => ({
    id: `demo-${i + 1}`,
    name,
    email: `demo${i + 1}@demo.inhouse`,
    emailVerified: true,
  }));
  await db.insert(user).values(demoUsers);

  const real = await db.select({ id: user.id, name: user.name }).from(user).where(notLike(user.email, "%@demo.inhouse"));
  if (real.length) console.log(`⭐ Přidávám do zápasů i skutečné hráče: ${real.map((r) => r.name).join(", ")}`);

  const everyone = [...demoUsers.map((u) => ({ id: u.id, name: u.name })), ...real];
  // preferovaná role každého hráče
  const prefRole = new Map(everyone.map((p, i) => [p.id, ROLES[i % 5]]));
  const mmr = new Map(everyone.map((p) => [p.id, 1500]));

  await db
    .insert(profile)
    .values(everyone.map((p) => ({ userId: p.id, mmr: 1500, mainRole: prefRole.get(p.id)! })))
    .onConflictDoUpdate({ target: profile.userId, set: { mmr: 1500 } });

  console.log("⚔️  Generuju zápasy…");
  const now = Date.now();
  for (let m = 0; m < 40; m++) {
    // skuteční hráči hrají skoro každý zápas, ostatní se střídají
    const pool = shuffle(everyone.filter((p) => !real.some((r) => r.id === p.id)));
    const ten = [...real.filter(() => rnd() < 0.8), ...pool].slice(0, 10);
    const blue = ten.slice(0, 5);
    const red = ten.slice(5, 10);

    const avg = (t: typeof blue) => t.reduce((a, p) => a + mmr.get(p.id)!, 0) / t.length;
    const blueAvg = avg(blue);
    const redAvg = avg(red);
    const expectedBlue = 1 / (1 + 10 ** ((redAvg - blueAvg) / 400));
    // trochu "skillu": hráči s nižším id (Kryštof…) vyhrávají častěji
    const skill = (t: typeof blue) => t.reduce((a, p) => a + (p.id.startsWith("demo-") ? 13 - Number(p.id.slice(5)) : 9), 0);
    const blueWins = rnd() < 0.5 + (skill(blue) - skill(red)) / 120;
    const winner = blueWins ? "BLUE" : "RED";
    const K = 28;
    const delta = Math.round(K * ((blueWins ? 1 : 0) - expectedBlue));

    const playedAt = new Date(now - (40 - m) * 1000 * 60 * 60 * (5 + rnd() * 10));
    const durationSec = 1400 + Math.floor(rnd() * 900);
    const minutes = durationSec / 60;
    const [row] = await db
      .insert(match)
      .values({ playedAt, durationSec, winner })
      .returning({ id: match.id });

    const assignRoles = (team: typeof blue) => {
      // každý dostane svou roli, pokud je volná
      const free = new Set(ROLES);
      const out = new Map<string, Role>();
      for (const p of team) {
        const r = prefRole.get(p.id)!;
        if (free.has(r)) { out.set(p.id, r); free.delete(r); }
      }
      for (const p of team) if (!out.has(p.id)) { const r = [...free][0]; out.set(p.id, r); free.delete(r); }
      return out;
    };

    for (const [team, players] of [["BLUE", blue], ["RED", red]] as const) {
      const roles = assignRoles(players);
      const won = team === winner;
      const change = team === "BLUE" ? delta : -delta;
      for (const p of players) {
        const role = roles.get(p.id)!;
        const after = mmr.get(p.id)! + change;
        mmr.set(p.id, after);
        await db.insert(matchPlayer).values({
          matchId: row.id,
          userId: p.id,
          team,
          role,
          champion: pick(CHAMPS[role]),
          kills: Math.floor(rnd() * (won ? 12 : 8)) + (role === "SUPPORT" ? 0 : 1),
          deaths: Math.floor(rnd() * (won ? 5 : 9)),
          assists: Math.floor(rnd() * 14) + (role === "SUPPORT" ? 5 : 1),
          cs: Math.round(PER_MIN[role][0] * (0.75 + rnd() * 0.5) * minutes),
          damage: Math.round(PER_MIN[role][1] * (0.7 + rnd() * 0.6) * (won ? 1.08 : 0.95) * minutes),
          vision: Math.round(PER_MIN[role][2] * (0.7 + rnd() * 0.6) * minutes),
          mmrChange: change,
          mmrAfter: after,
        });
      }
    }
  }

  for (const [id, value] of mmr) {
    await db.update(profile).set({ mmr: value }).where(eq(profile.userId, id));
  }
  console.log("📋 Přidávám ukázkové inzeráty a turnaje…");
  const h = (hours: number) => new Date(now - hours * 3600000);
  await db.insert(lfgPost).values([
    { userId: "demo-6", kind: "PLAYER", rank: "Emerald", roles: ["MID", "TOP"], tags: ["Flex", "Turnaj"], text: "Hledám tým na víkendové turnaje. Hraju hlavně večer, mám mic a Discord.", createdAt: h(0.3) },
    { userId: "demo-10", kind: "PLAYER", rank: "Platinum", roles: ["TOP"], tags: ["Duo"], text: "Hledám jungle duo do ranked a inhouse. Pohoda, žádný tilt.", createdAt: h(1) },
    { userId: "demo-11", kind: "PLAYER", rank: "Diamond", roles: ["SUPPORT", "MID"], tags: ["Clash", "Turnaj"], text: "Support se shotcallingem hledá ambiciózní tým na Clash a CZ/SK ligy.", createdAt: h(3) },
    { userId: "demo-12", kind: "PLAYER", rank: "Gold", roles: ["JUNGLE"], tags: ["Flex", "Inhouse"], text: "Chci se zlepšit, hledám lidi na flex a review zápasů.", createdAt: h(20) },
    { userId: "demo-7", kind: "PLAYER", rank: "Diamond", roles: ["ADC"], tags: ["Duo"], text: "ADC hledá supporta na duo. Cíl: Master do konce sezóny.", createdAt: h(26) },
    { userId: "demo-8", kind: "PLAYER", rank: "Emerald", roles: ["SUPPORT"], tags: ["Clash"], text: "Blitz/Thresh main, volný na Clash každý víkend.", createdAt: h(50) },
    { userId: "demo-1", kind: "TEAM", teamName: "Praha Wolves", rank: "Plat – Emerald", roles: ["JUNGLE", "SUPPORT"], tags: ["Turnaj"], text: "Amatérský tým hledá jungle a supporta na turnaje. Tréninky Po a St večer.", createdAt: h(0.8) },
    { userId: "demo-2", kind: "TEAM", teamName: "Brno Baroni", rank: "Diamond+", roles: ["MID"], tags: ["Liga"], text: "Hledáme midlanera do ligy. Tréninky Út a Čt 19:00.", createdAt: h(5) },
    { userId: "demo-3", kind: "TEAM", teamName: "Ostrava Drakes", rank: "Gold – Plat", roles: ["ADC", "TOP"], tags: ["Clash", "Inhouse"], text: "Chill tým na Clash a inhouse, hlavně ať je sranda.", createdAt: h(28) },
  ]);
  const d = (days: number) => new Date(now + days * 86400000);
  await db.insert(tournament).values([
    { userId: "demo-1", name: "Inhouse Arena Cup #1", organizer: "Inhouse Arena", kind: "TURNAJ", startsAt: d(30), endsAt: d(31), registrationUntil: d(25), format: "5v5 · Double elim · Bo3", prize: "Trofej + merch", capacity: "16 / 32 týmů", url: "https://example.com", description: "Náš první komunitní turnaj pro týmy z inhouse ligy. Finále se streamem a komentátory.", featured: true },
    { userId: "demo-2", name: "CZ/SK Amateur League", organizer: "Komunitní liga", kind: "LIGA", startsAt: d(55), endsAt: d(140), registrationUntil: d(45), format: "5v5 · Bo1 liga", prize: "Ceny od partnerů", capacity: "24 / 40 týmů", url: "https://example.com" },
    { userId: "demo-3", name: "Winter Clash Open", organizer: "Esport klub", kind: "TURNAJ", startsAt: d(9), registrationUntil: d(7), format: "Single elim · Bo1", prize: "Herní periferie", capacity: "12 / 16 týmů", url: "https://example.com" },
    { userId: "demo-4", name: "Univerzitní liga", organizer: "Studentský spolek", kind: "LIGA", startsAt: d(-40), endsAt: d(35), format: "Skupiny + playoff", prize: "Trofej + merch", capacity: "16 týmů" },
    { userId: "demo-5", name: "ARAM Fun Cup", organizer: "Komunita Discord", kind: "TURNAJ", startsAt: d(80), format: "5v5 ARAM · Bo3", prize: "Discord role", capacity: "32 týmů", description: "Odpočinkový turnaj v ARAMu, přihlásit se může kdokoliv." },
    { userId: "demo-6", name: "Podzimní LAN turnaj", organizer: "Gaming festival", kind: "TURNAJ", startsAt: d(-14), endsAt: d(-13), format: "LAN · Bo3", prize: "Vítěz: Praha Wolves", capacity: "32 týmů", url: "https://example.com" },
  ]);

  console.log("✅ Hotovo! Spusť npm run dev a otevři http://localhost:3000");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
