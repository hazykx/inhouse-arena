import Link from "next/link";
import { Art } from "@/components/Art";
import { Icon } from "@/components/Icon";
import { LoginButton } from "@/components/AuthButtons";
import { getCounts, getMatches, getStreamerAccounts } from "@/lib/data";
import { getSession } from "@/lib/session";
import { currentSeason } from "@/lib/season";
import { duration, when } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [session, counts, matches, streamers, season] = await Promise.all([getSession(), getCounts(), getMatches({ limit: 3 }), getStreamerAccounts(), currentSeason()]);

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">VÍTEJ V INHOUSE ARENA</div>
          <h1>Inhouse hry, jak mají být.</h1>
        </div>
        <div className="side-note">Férové týmy. Skutečná konkurence.</div>
      </div>

      <div className="hero">
        <div className="hero-art"><Art seed={7} hues={[172, 160, 262]} className="art" style={{ width: "100%", height: "100%" }} /></div>
        <div className="hero-body">
          <div className="badge"><Icon name="shield" />CZ/SK KOMUNITA <span className="sep" /><span className="ac">5V5 INHOUSE</span></div>
          <h1>Férové týmy.<span>Skutečné zápasy.</span></h1>
          <p>Zařaď se do fronty, odklikni ready check a hraj vyrovnané custom hry se svou komunitou. Každá výhra se počítá do žebříčku.</p>
          <div className="hero-ctas">
            {session ? (
              <Link className="btn btn-primary" href={`/hrac/${session.user.id}`}><Icon name="user" />Můj profil<Icon name="arrow" /></Link>
            ) : (
              <LoginButton arrow />
            )}
            <a className="btn btn-ghost" href="#jak"><Icon name="info" />Jak to funguje</a>
          </div>
          <div className="hero-foot">
            <span className="sig">Inhouse</span>
            <span className="vr" />
            <small>FRONTA · READY CHECK · ELO<br />VŠECHNO NA JEDNOM MÍSTĚ.</small>
          </div>
        </div>
        <div className="hero-tag"><div>QUEUE UP. PLAY FAIR. CLIMB.</div><small>{season.name.toUpperCase()} / INHOUSE ARENA</small></div>
      </div>

      <div className="section">
        <div className="grid g4">
          <div className="card stat"><div className="k">REGISTROVANÍ HRÁČI</div><div className="v">{counts.players.toLocaleString("cs-CZ")}</div><div className="s">{season.name}</div></div>
          <div className="card stat"><div className="k">ODEHRANÉ ZÁPASY</div><div className="v">{counts.matches.toLocaleString("cs-CZ")}</div><div className="s">{season.name}</div></div>
          <div className="card stat"><div className="k">PRÁVĚ VE FRONTĚ</div><div className="v">0 / 10</div><div className="s">Fronta přijde brzy</div></div>
          <div className="card stat"><div className="k">PROPOJENÍ STREAMEŘI</div><div className="v">{new Set(streamers.map((s) => s.userId)).size}</div><div className="s">Twitch a Kick</div></div>
        </div>
      </div>

      <div className="section" id="jak">
        <div className="section-head">
          <div><h2>Jak to funguje<span className="dot">.</span></h2><div className="lead">Od přihlášení k první hře za pár minut.</div></div>
        </div>
        <div className="grid g4">
          {[
            ["discord", "Přihlas se přes Discord", "Žádná hesla. Jedním klikem se přihlásíš a dostaneš se na náš server."],
            ["link", "Propoj LoL účet", "Zadej své Riot ID a vyber si hlavní a vedlejší roli."],
            ["swords", "Zařaď se do fronty", "Jakmile je vás deset, odklikni ready check. Týmy se sestaví podle MMR."],
            ["chart", "Hraj a stoupej", "Po hře se výsledek zapíše sám a tvoje ELO se posune v žebříčku."],
          ].map(([icon, title, text], i) => (
            <div className="card step" key={title}>
              <div className="step-num">0{i + 1}</div>
              <div className="step-ico"><Icon name={icon as "link"} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div><h2>Poslední zápasy<span className="dot">.</span></h2><div className="lead">Co se odehrálo naposledy.</div></div>
          <Link className="link-arrow" href="/zapasy">Celá historie<Icon name="arrow" /></Link>
        </div>
        {matches.length === 0 ? (
          <div className="card empty"><b>Zatím žádné zápasy</b>Spusť <code>npm run db:seed</code> pro ukázková data.</div>
        ) : (
          <div className="grid g3">
            {matches.map((m) => {
              const kb = m.players.filter((p) => p.team === "BLUE").reduce((a, p) => a + p.kills, 0);
              const kr = m.players.filter((p) => p.team === "RED").reduce((a, p) => a + p.kills, 0);
              const blueWin = m.winner === "BLUE";
              return (
                <Link className="card step" href="/zapasy" key={m.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="step-num">ZÁPAS #{m.id}</span>
                    <span className="tag grey">{when(m.playedAt)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 18px" }}>
                    <div><div style={{ color: "#7FB2FF", fontSize: 12, fontWeight: 800, letterSpacing: 1.6 }}>MODRÝ</div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>{kb}</div></div>
                    <span className={`tag ${blueWin ? "green" : "red"}`}>{blueWin ? "MODRÝ VYHRÁL" : "ČERVENÝ VYHRÁL"}</span>
                    <div style={{ textAlign: "right" }}><div style={{ color: "var(--loss)", fontSize: 12, fontWeight: 800, letterSpacing: 1.6 }}>ČERVENÝ</div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>{kr}</div></div>
                  </div>
                  <p>{m.players.slice(0, 3).map((p) => p.user.name).join(", ")} a další · {duration(m.durationSec)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
