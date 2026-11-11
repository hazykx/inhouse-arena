import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { Art, hashSeed } from "@/components/Art";
import { colorFor, initials } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { DeleteButton } from "@/components/DeleteButton";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { dateRange, tourStatus } from "@/lib/tournament";
import { dateCs } from "@/lib/format";
import { deleteTournament, toggleFeatured } from "./actions";

export const dynamic = "force-dynamic";

const ORDER = { live: 0, open: 1, closed: 2, soon: 3, ended: 4 };

export default async function Tournaments({ searchParams }: { searchParams: Promise<{ typ?: string }> }) {
  const { typ } = await searchParams;
  const session = await getSession();
  const admin = await isAdmin(session?.user.id);

  const rows = await db.query.tournament.findMany({ orderBy: desc(tournament.startsAt) });
  const all = rows
    .map((t) => ({ ...t, status: tourStatus(t) }))
    .sort((a, b) => ORDER[a.status.key] - ORDER[b.status.key] || (a.status.key === "ended" ? b.startsAt.getTime() - a.startsAt.getTime() : a.startsAt.getTime() - b.startsAt.getTime()));
  const list = all.filter((t) => !typ || t.kind === (typ === "ligy" ? "LIGA" : "TURNAJ"));
  const featured = all.find((t) => t.featured && t.status.key !== "ended");

  const hues = (s: string): [number, number, number] => { const h = hashSeed(s) % 360; return [h, (h + 40) % 360, (h + 300) % 360]; };

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">PROMO</div>
          <h1>Turnaje a ligy<span className="dot">.</span></h1>
          <div className="lead">Turnaje a ligy z CZ/SK scény na jednom místě. Pořádáš turnaj? Přidej ho.</div>
        </div>
        <Link className="btn btn-primary" href="/turnaje/novy"><Icon name="plus" />Přidat turnaj</Link>
      </div>

      {featured && (
        <div className="card feature">
          <Art seed={hashSeed(featured.name)} hues={hues(featured.name)} />
          <div className="feature-body">
            <span className="tag amber">★ DOPORUČUJEME</span>
            <h2>{featured.name}</h2>
            <p>{featured.description ?? `Pořádá ${featured.organizer}.`}</p>
            <div className="facts">
              <div>DATUM<b>{dateRange(featured)}</b></div>
              <div>FORMÁT<b>{featured.format}</b></div>
              {featured.capacity && <div>KAPACITA<b>{featured.capacity}</b></div>}
              {featured.prize && <div>CENY<b>{featured.prize}</b></div>}
            </div>
            {featured.url && <a className="btn btn-primary" href={featured.url} target="_blank" rel="noreferrer">{featured.status.key === "open" ? "Registrovat tým" : "Detail turnaje"}<Icon name="arrow" /></a>}
          </div>
        </div>
      )}

      <div className={featured ? "section" : ""}>
        <div className="section-head">
          <div><h2>Všechny turnaje<span className="dot">.</span></h2><div className="lead">Probíhající a nadcházející nahoře, ukončené na konci.</div></div>
          <div className="chips">
            <Link href="/turnaje" className={`chip ${!typ ? "on" : ""}`}>Vše</Link>
            <Link href="/turnaje?typ=turnaje" className={`chip ${typ === "turnaje" ? "on" : ""}`}>Turnaje</Link>
            <Link href="/turnaje?typ=ligy" className={`chip ${typ === "ligy" ? "on" : ""}`}>Ligy</Link>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="card empty"><b>Zatím tu nejsou žádné turnaje</b>Přidej první turnaj nebo ligu tlačítkem nahoře.</div>
        ) : (
          <div className="grid g3">
            {list.map((t) => {
              const mine = t.userId === session?.user.id;
              return (
                <div className="card tour hov" key={t.id}>
                  <div className="banner">
                    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: t.status.key === "ended" ? 0.45 : 1 }}><Art seed={hashSeed(t.name)} hues={hues(t.name)} /></div>
                    <span className={`tag ${t.status.color}`}>{t.status.label}</span>
                    {t.featured && <span className="tag amber" style={{ position: "absolute", left: "auto", right: 14, top: 14 }}>★ DOPORUČENO</span>}
                    <div className="org" style={{ background: colorFor(t.organizer) }}>{initials(t.organizer)}</div>
                  </div>
                  <div className="tour-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h3>{t.name}</h3><span className="tag grey">{t.kind}</span></div>
                    <div className="by">Pořádá: {t.organizer}</div>
                    {t.description && <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.55, marginTop: 10 }}>{t.description.length > 140 ? t.description.slice(0, 140) + "…" : t.description}</p>}
                    <div className="tour-facts">
                      <div>DATUM<b>{dateRange(t)}</b></div>
                      <div>FORMÁT<b>{t.format}</b></div>
                      <div>CENY<b>{t.prize ?? "—"}</b></div>
                      <div>KAPACITA<b>{t.capacity ?? "—"}</b></div>
                      {t.registrationUntil && t.status.key === "open" && <div style={{ gridColumn: "1 / -1" }}>REGISTRACE DO<b>{dateCs(t.registrationUntil)}</b></div>}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                      {t.url ? (
                        <a className={`btn btn-sm ${t.status.key === "open" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1, justifyContent: "center" }} href={t.url} target="_blank" rel="noreferrer">
                          {t.status.key === "open" ? "Registrace" : t.status.key === "ended" ? "Výsledky" : "Detail"}<Icon name="ext" />
                        </a>
                      ) : (
                        <span className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center", opacity: 0.5 }}>Bez odkazu</span>
                      )}
                      {admin && (
                        <form action={toggleFeatured.bind(null, t.id)}><button className="btn btn-ghost btn-sm" title="Doporučit na hlavní banner">{t.featured ? "★ Zrušit" : "☆ Doporučit"}</button></form>
                      )}
                      {(mine || admin) && <DeleteButton action={deleteTournament.bind(null, t.id)} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
