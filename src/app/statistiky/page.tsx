import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getLeaderboard } from "@/lib/data";
import { fmt } from "@/lib/format";
import { RoleIcon } from "@/components/RoleIcon";

export const dynamic = "force-dynamic";

type Player = Awaited<ReturnType<typeof getLeaderboard>>[number];

/** Sloupce tabulky: klíč v URL, popisek, hodnota, formát a jestli je lepší nižší číslo */
const COLS: { key: string; label: string; title: string; get: (p: Player) => number; show: (p: Player) => React.ReactNode; lowerIsBetter?: boolean }[] = [
  { key: "mmr", label: "MMR", title: "Inhouse MMR", get: (p) => p.mmr, show: (p) => <b className="mmr">{p.mmr}</b> },
  { key: "games", label: "ZÁPASY", title: "Odehrané zápasy", get: (p) => p.games, show: (p) => p.games },
  { key: "winrate", label: "WINRATE", title: "Procento výher", get: (p) => p.winrate, show: (p) => <>{p.winrate} %<small className="sub">{p.wins}V {p.losses}P</small></> },
  { key: "kda", label: "KDA", title: "(Kills + Assists) / Deaths", get: (p) => p.kda, show: (p) => <b>{fmt(p.kda, 2)}</b> },
  { key: "kills", label: "KILLS", title: "Průměr zabití na zápas", get: (p) => p.avgK, show: (p) => fmt(p.avgK) },
  { key: "deaths", label: "DEATHS", title: "Průměr smrtí na zápas", get: (p) => p.avgD, show: (p) => fmt(p.avgD), lowerIsBetter: true },
  { key: "assists", label: "ASSISTS", title: "Průměr asistencí na zápas", get: (p) => p.avgA, show: (p) => fmt(p.avgA) },
  { key: "cs", label: "CS/MIN", title: "Creep score za minutu", get: (p) => p.csPerMin, show: (p) => fmt(p.csPerMin) },
  { key: "dmg", label: "DMG/MIN", title: "Poškození šampionům za minutu", get: (p) => p.dmgPerMin, show: (p) => Math.round(p.dmgPerMin).toLocaleString("cs-CZ") },
  { key: "vision", label: "VISION/MIN", title: "Vision score za minutu", get: (p) => p.visionPerMin, show: (p) => fmt(p.visionPerMin, 2) },
];

export default async function Stats({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort = "mmr" } = await searchParams;
  const players = await getLeaderboard();
  const col = COLS.find((c) => c.key === sort) ?? COLS[0];
  const sorted = [...players].sort((a, b) => (col.lowerIsBetter ? col.get(a) - col.get(b) : col.get(b) - col.get(a)));
  const byMmr = [...players].sort((a, b) => b.mmr - a.mmr);

  // Nejlepší hodnota v každém sloupci (zvýrazní se)
  const best = new Map(COLS.map((c) => [c.key, players.length ? (c.lowerIsBetter ? Math.min(...players.map(c.get)) : Math.max(...players.map(c.get))) : 0]));

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">ŽEBŘÍČEK</div>
          <h1>Statistiky<span className="dot">.</span></h1>
          <div className="lead">Průměrné statistiky hráčů v aktuální sezóně. Kliknutím na sloupec seřadíš tabulku.</div>
        </div>
        <div className="chips"><button className="chip on">Sezóna 1</button></div>
      </div>

      {players.length === 0 ? (
        <div className="card empty"><b>Zatím nikdo neodehrál zápas</b>Spusť <code>npm run db:seed</code> pro ukázková data.</div>
      ) : (
        <>
          <div className="podium">
            {byMmr.slice(0, 3).map((p, i) => (
              <Link href={`/hrac/${p.id}`} className={`card pod ${i === 0 ? "first" : ""}`} key={p.id}>
                <div className="place">{i + 1}</div>
                <div className="who">
                  <Avatar name={p.name} image={p.image} />
                  <div><b>{p.name}</b><small style={{ display: "flex", alignItems: "center", gap: 6 }}><RoleIcon role={p.mainRole} size={14} />{p.games} zápasů</small></div>
                </div>
                <div className="pod-stats">
                  <div>MMR<b>{p.mmr}</b></div>
                  <div>WINRATE<b>{p.winrate} %</b></div>
                  <div>KDA<b>{fmt(p.kda, 2)}</b></div>
                  <div>CS/MIN<b>{fmt(p.csPerMin)}</b></div>
                </div>
              </Link>
            ))}
          </div>

          <div className="card table-card"><div className="table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>HRÁČ</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="num">
                      <Link href={c.key === "mmr" ? "/statistiky" : `/statistiky?sort=${c.key}`} className={`th-sort ${col.key === c.key ? "on" : ""}`} title={c.title} scroll={false}>
                        {c.label}<span className="arr">{c.lowerIsBetter ? "↑" : "↓"}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.id}>
                    <td className="rank">{i + 1}</td>
                    <td>
                      <Link href={`/hrac/${p.id}`} className="who">
                        <Avatar name={p.name} image={p.image} size="sm" />
                        <div><b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>{p.name}<RoleIcon role={p.mainRole} size={14} /></b>{p.riotName && <small>{p.riotName}#{p.riotTag}</small>}</div>
                      </Link>
                    </td>
                    {COLS.map((c) => (
                      <td key={c.key} className={`num ${col.key === c.key ? "sorted" : ""} ${players.length > 1 && c.get(p) === best.get(c.key) && c.key !== "games" ? "best" : ""}`}>{c.show(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
          <div className="note">Kills, Deaths a Assists jsou průměry na zápas. Hodnoty za minutu se počítají z celkového odehraného času. Zeleně je nejlepší hodnota ve sloupci.</div>
        </>
      )}
    </section>
  );
}
