import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { match, ROLES } from "@/db/schema";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getChampions } from "@/lib/riot";
import { ROLE_CS, when } from "@/lib/format";
import { updateMatch } from "../../actions";

export const dynamic = "force-dynamic";
const ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

export default async function EditMatch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s || !(await isAdmin(s.user.id))) notFound();
  const m = await db.query.match.findFirst({ where: eq(match.id, Number(id)), with: { players: { with: { user: { columns: { name: true } } } } } });
  if (!m) notFound();
  const champs = await getChampions();
  const sorted = (side: string) => m.players.filter((p) => p.team === side).sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));

  const table = (side: "BLUE" | "RED") => (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="panel-head" style={{ padding: "18px 20px 6px" }}><h3 style={{ color: side === "BLUE" ? "#7FB2FF" : "var(--loss)" }}>{side} SIDE</h3></div>
      <div className="table-wrap">
        <table className="edit-table">
          <thead><tr><th>HRÁČ</th><th>ROLE</th><th>ŠAMPION</th><th>K</th><th>D</th><th>A</th><th>CS</th><th>DMG</th><th>VISION</th><th>STATISTIKY</th></tr></thead>
          <tbody>
            {sorted(side).map((p) => (
              <tr key={p.id}>
                <td><b>{p.user.name}</b></td>
                <td><select className="select sm" name={`role_${p.id}`} defaultValue={p.role}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_CS[r]}</option>)}</select></td>
                <td><input className="input sm" name={`champion_${p.id}`} defaultValue={p.champion} list="champs" style={{ width: 120 }} /></td>
                {(["kills", "deaths", "assists", "cs", "damage", "vision"] as const).map((f) => (
                  <td key={f}><input className="input sm" type="number" min={0} name={`${f}_${p.id}`} defaultValue={p[f]} style={{ width: f === "damage" ? 90 : 64 }} /></td>
                ))}
                <td style={{ textAlign: "center" }}><input type="checkbox" name={`hasStats_${p.id}`} defaultChecked={p.hasStats} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href="/admin?tab=zapasy">ADMIN · ZÁPASY</Link></div>
          <h1>Upravit zápas #{m.id}<span className="dot">.</span></h1>
          <div className="lead">{when(m.playedAt)}. Změna vítěze přepočítá MMR celé sezóny.</div>
        </div>
      </div>
      <form action={updateMatch.bind(null, m.id)} className="grid" style={{ gap: 20 }}>
        <div className="card panel">
          <div className="form-row" style={{ gap: 28 }}>
            <div className="field" style={{ flex: "none" }}>
              <label>VÍTĚZ</label>
              <div className="tag-picker">
                <label><input type="radio" name="winner" value="BLUE" defaultChecked={m.winner === "BLUE"} /><span>BLUE side</span></label>
                <label><input type="radio" name="winner" value="RED" defaultChecked={m.winner === "RED"} /><span>RED side</span></label>
              </div>
            </div>
            <div className="field" style={{ flex: "none", width: 160 }}>
              <label>DÉLKA (MINUTY)</label>
              <input className="input" type="number" step="0.1" min={1} name="minutes" defaultValue={(m.durationSec / 60).toFixed(1)} />
            </div>
          </div>
        </div>
        {table("BLUE")}
        {table("RED")}
        <datalist id="champs">{[...champs.byId.values()].map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</datalist>
        <div className="conn-actions">
          <button className="btn btn-primary"><Icon name="check" />Uložit změny</button>
          <Link className="btn btn-ghost" href="/admin?tab=zapasy">Zrušit</Link>
        </div>
      </form>
    </section>
  );
}
