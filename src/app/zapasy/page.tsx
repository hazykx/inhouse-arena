import { MatchCard } from "@/components/MatchCard";
import { getMatches } from "@/lib/data";
import { getChampions } from "@/lib/riot";

export const dynamic = "force-dynamic";

export default async function Matches() {
  const [matches, champs] = await Promise.all([getMatches({ limit: 30 }), getChampions()]);

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">ZÁPASY</div>
          <h1>Historie zápasů<span className="dot">.</span></h1>
          <div className="lead">Všechny odehrané inhouse hry, sestavy a změny ELO.</div>
        </div>
      </div>
      {matches.length === 0 ? (
        <div className="card empty"><b>Zatím žádné zápasy</b>Spusť <code>npm run db:seed</code> pro ukázková data.</div>
      ) : (
        <div className="grid">{matches.map((m) => <MatchCard key={m.id} m={m} champs={champs} />)}</div>
      )}
    </section>
  );
}
