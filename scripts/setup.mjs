// Příprava před spuštěním: vytvoří .env, vygeneruje tajný klíč,
// zkontroluje vyplněné klíče a připraví databázi.
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` };

// 1) .env
let created = false;
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  created = true;
}
let env = readFileSync(".env", "utf8");
if (/^BETTER_AUTH_SECRET=\s*$/m.test(env)) {
  env = env.replace(/^BETTER_AUTH_SECRET=\s*$/m, `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
  writeFileSync(".env", env);
}
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim();

console.log(c.b("\n  Inhouse Arena – kontrola nastavení\n"));
if (created) console.log(c.g("  ✓ Vytvořen soubor .env s tajným klíčem"));

// 2) kontrola klíčů
const checks = [
  ["Discord (přihlášení)", ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"], true],
  ["Riot API (rank, mastery)", ["RIOT_API_KEY"], false],
  ["Twitch", ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"], false],
  ["Kick", ["KICK_CLIENT_ID", "KICK_CLIENT_SECRET"], false],
];
let missingRequired = false;
for (const [label, keys, required] of checks) {
  const ok = keys.every((k) => get(k));
  if (ok) console.log(c.g(`  ✓ ${label}`));
  else if (required) { console.log(c.r(`  ✗ ${label} – vyplň ${keys.join(" a ")} v souboru .env`)); missingRequired = true; }
  else console.log(c.y(`  – ${label} – nevyplněno (volitelné)`));
}

// Časté chyby při kopírování Discord klíčů
const dId = get("DISCORD_CLIENT_ID"), dSecret = get("DISCORD_CLIENT_SECRET");
if (dId && !/^\d{17,20}$/.test(dId)) {
  console.log(c.r("  ✗ DISCORD_CLIENT_ID vypadá špatně – má to být jen číslo (17–20 číslic), bez mezer a uvozovek."));
}
if (dSecret && /^[0-9a-f]{64}$/i.test(dSecret)) {
  console.log(c.r("  ✗ DISCORD_CLIENT_SECRET je ve skutečnosti „Public Key“! Správný secret najdeš v záložce OAuth2 → Client Secret → Reset Secret."));
} else if (dSecret && (/["'\s]/.test(dSecret) || dSecret.length < 20)) {
  console.log(c.r("  ✗ DISCORD_CLIENT_SECRET vypadá špatně – vlož ho celý, bez mezer a uvozovek."));
}

// 3) databáze
try {
  execSync("npx drizzle-kit push", { stdio: ["inherit", "ignore", "inherit"] });
  console.log(c.g("  ✓ Databáze připravena"));
} catch {
  console.log(c.r("  ✗ Databázi se nepodařilo připravit (viz chyba výše)"));
  process.exit(1);
}

if (missingRequired) {
  console.log(c.y("\n  Web se spustí, ale přihlášení nebude fungovat, dokud nedoplníš Discord klíče."));
  console.log(c.y("  Návod: README.md, sekce „Získání klíčů“.\n"));
} else {
  console.log("");
}
