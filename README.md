# Inhouse Arena

Web pro League of Legends inhouse hry: přihlášení přes Discord, profily hráčů s rankem, statistikami, historií zápasů a champion poolem, propojení Twitch/Kick a živé streamy.

**Technologie:** Next.js 16 · Better Auth · Drizzle ORM · SQLite (libSQL) · Riot Games API

---

## 1. Spuštění

Potřebuješ [Node.js](https://nodejs.org) verze 20 nebo novější (verze LTS).

**Nejjednodušší způsob:** dvakrát klikni na `start.bat` (Windows) nebo `start.command` (Mac).
Skript sám nainstaluje balíčky, vytvoří `.env` s tajným klíčem, připraví databázi, spustí web a otevře prohlížeč.
Pak doplň klíče do `.env` (návod níže) a spusť ho znovu.

Ručně v terminálu:

```bash
npm install
node scripts/setup.mjs   # vytvoří .env, zkontroluje klíče, připraví databázi
npm run dev              # web běží na http://localhost:3000
```

### Ukázková data
Dvojklik na `ukazkova-data.bat` (Mac: `ukazkova-data.command`), nebo `npm run db:seed`.
Vytvoří 12 demo hráčů a 40 zápasů. **Tip:** nejdřív se na webu přihlas přes Discord a až potom spusť seed. Zařadí do zápasů i tebe, takže uvidíš svůj profil plný statistik.

---

## 2. Získání klíčů

### Discord (přihlášení) – povinné
1. Otevři https://discord.com/developers/applications → **New Application**
2. Záložka **OAuth2**: zkopíruj *Client ID* a *Client Secret* do `.env`
3. Do **Redirects** přidej: `http://localhost:3000/api/auth/callback/discord`

### Riot Games API (rank, mastery, propojení účtu)
1. Přihlas se na https://developer.riotgames.com
2. Zkopíruj **Development API Key** do `RIOT_API_KEY`
3. ⚠️ Vývojový klíč **platí jen 24 hodin**, pak ho musíš obnovit. Pro ostrý provoz zažádej o *Production key* (Riot chce vidět hotový web, Terms of Service a Privacy Policy).

### Twitch (propojení + live stav)
1. https://dev.twitch.tv/console/apps → **Register Your Application**
2. OAuth Redirect URL: `http://localhost:3000/api/auth/callback/twitch`
3. Category: *Website Integration*, zkopíruj Client ID a vygeneruj Client Secret

### Kick (propojení + live stav)
1. Na Kicku: **Settings → Developer → Create App** (je potřeba zapnuté 2FA)
2. Redirect URL: `http://localhost:3000/api/auth/callback/kick`
3. Zkopíruj Client ID a Client Secret

Twitch a Kick jsou volitelné. Bez klíčů jsou tlačítka pro propojení jen neaktivní.

---

## 3. Jak to funguje

| Funkce | Jak |
|---|---|
| **Přihlášení** | Discord OAuth přes Better Auth. Nový hráč automaticky dostane profil s 1500 MMR. |
| **Propojení LoL účtu** | Hráč zadá Riot ID a server, web účet najde přes Riot API a hned ho propojí. Jeden LoL účet může mít jen jeden hráč. |
| **Rank a mastery** | Načítá se živě z Riot API (cache 10–30 min). |
| **Statistiky, historie, champion pool** | Počítají se z inhouse zápasů v databázi: KDA, průměrné kills/deaths/assists a CS, poškození a vision za minutu. Hodnoty odpovídají polím z Riot match-v5 (`totalMinionsKilled + neutralMinionsKilled`, `totalDamageDealtToChampions`, `visionScore`), takže je půjde plnit automaticky z turnajových kódů. |
| **Fronta a draft** | Hráč se zařadí na roli. Když jsou na každou roli 2 hráči → ready check (30 s). Pak se z náhodné role vyberou 2 kapitáni a hodí se mincí. Vítěz volí první výběr hráčů, nebo stranu (blue/red). Kapitáni draftují A, B, A, B, druhý hráč ze stejné role jde automaticky soupeři. Po draftu web ukáže soupisky, název a heslo custom hry (zakládá kapitán BLUE), kapitán RED vloží odkaz na draft šampionů. Po zápase kapitán vítězů nahraje replay (.rofl), druhý kapitán potvrdí a statistiky (šampion, KDA, CS, poškození, vision) se načtou z replaye. Časové limity: výběr 25–30 s, po vypršení volí web automaticky. |
| **Testovací hra** | Na stránce Fronta (při spuštění přes start.bat, nebo pro adminy) je panel „Testovací hra“: vybereš roli a jestli los mincí vyhraješ/prohraješ a spustíš hru s 9 boty, ve které jsi vždy kapitán. Boti přijímají ready check postupně, volí a draftují sami. Místo replaye jde výsledek simulovat. Testovací hry se neukládají do statistik ani MMR. Potřebuje ukázková data (ukazkova-data.bat). |
| **Další testování** | Tlačítko „Doplnit frontu ukázkovými hráči“ doplní skutečnou frontu boty (kapitáni náhodně). Admin může hru zrušit nebo rozhodnout spor. |
| **Hledám tým** | Inzeráty v databázi: hráč hledá tým, nebo tým hledá hráče. Filtry podle role a typu, kontakt přes Discord profil. Každý hráč má jeden inzerát od každého typu, inzeráty platí 30 dní. |
| **Turnaje a ligy** | Přidat může každý přihlášený. Stav (registrace, probíhá, ukončeno) se počítá z dat. Admini (`ADMIN_DISCORD_IDS` v `.env`) mohou mazat cizí příspěvky a vybrat doporučený turnaj na banner. |
| **Admin panel** (`/admin`) | Jen pro adminy (`ADMIN_DISCORD_IDS`). Fronta: vypnout/zapnout, reset (vyprázdní frontu a zruší rozehrané hry), vyhodit hráče, rozhodnout spor. Hráči: pauza ve frontě nebo ban na 24 h / 3 dny / týden / natrvalo s důvodem, zrušení trestu, historie. Inzeráty: mazání. Turnaje: schvalování (turnaje od běžných hráčů se zobrazí až po schválení), doporučení na banner, mazání. |
| **Twitch / Kick** | Propojení přes OAuth. Live stav se zjišťuje přes API (app token, cache 1 min). |

### Struktura
```
src/
  app/
    page.tsx              Přehled
    fronta/               Fronta (výběr role, kdo čeká, admin panel)
    statistiky/           Žebříček
    zapasy/               Historie zápasů
    streamy/              Živé streamy (Twitch + Kick)
    hledam-tym/           Inzeráty (seznam, novy/ = formulář, actions.ts)
    turnaje/              Turnaje a ligy (seznam, novy/ = formulář, actions.ts)
    profil/               Propojené účty (nastavení) + serverové akce
    hrac/[id]/            Veřejný profil hráče
    api/auth/[...all]/    Better Auth endpointy
  components/             UI komponenty (ikony, avatar, rank, graf…)
  db/schema.ts            Databázové tabulky
  db/seed.ts              Ukázková data
  lib/auth.ts             Nastavení přihlašování
  lib/riot.ts             Riot API + Data Dragon
  lib/streams.ts          Twitch a Kick API
  lib/queue.ts          Logika fronty, draftu a výsledků
  lib/rofl.ts           Čtení statistik z replay souboru (.rofl)
  components/queue/     Modální okno hry a plovoucí ukazatel fronty
  lib/data.ts             Dotazy do databáze a výpočty statistik
```

### Užitečné příkazy
- `npm run db:studio`: prohlížeč databáze v prohlížeči
- `npm run db:push`: po změně `schema.ts` aktualizuje databázi

---

## 4. Nasazení na internet (Railway)

Web běží na [Railway](https://railway.com) napojeném na GitHub repozitář. Každá změna nahraná do větve `main` se automaticky nasadí.

- **Volume** (trvalé úložiště) připojené na `/data`
- Proměnné prostředí: stejné jako v `.env`, ale `DATABASE_URL=file:/data/local.db` a `BETTER_AUTH_URL=https://<tvoje-adresa>`
- Při startu (`npm start`) se databáze sama převede na aktuální verzi (`drizzle-kit push`)
- Ukázková data (`db:seed`) na serveru nespouštěj – maže zápasy

## 5. Jiné možnosti hostingu

- **Hosting:** Vercel, Railway nebo vlastní VPS
- **Databáze:** [Turso](https://turso.tech) (stejné SQLite/libSQL, stačí změnit `DATABASE_URL` a `DATABASE_AUTH_TOKEN`)
- V `.env` změň `BETTER_AUTH_URL` na svou doménu a ve všech OAuth aplikacích přidej redirect URL s doménou místo `localhost:3000`

---

*Inhouse Arena isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.*
