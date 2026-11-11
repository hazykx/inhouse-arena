"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { RoleIcon, RoleSvg } from "../RoleIcon";
import { ROLE_CS } from "@/lib/format";
import { useCountdown, useElapsed, useQueue, type ClientState } from "./QueueProvider";

type Lobby = NonNullable<ClientState["lobby"]>;
type P = Lobby["players"][number];
type Team = "A" | "B";
const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

/* ───────── Pomocné ───────── */

function Timer({ deadline }: { deadline: number | null }) {
  const left = useCountdown(deadline);
  if (left == null) return null;
  return <span className={`q-timer ${left <= 5 ? "hot" : ""}`}><Icon name="clock" />{left}s</span>;
}

const sideOfTeam = (l: Lobby, t: Team | null) => (!t || !l.blueTeam ? null : t === l.blueTeam ? "BLUE" : "RED");
const captain = (l: Lobby, t: Team) => l.players.find((p) => p.id === (t === "A" ? l.captainA : l.captainB))!;
const teamPlayers = (l: Lobby, t: Team) => l.players.filter((p) => p.team === t).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));

function PlayerRow({ p, captainBadge, right }: { p: P; captainBadge?: boolean; right?: React.ReactNode }) {
  return (
    <div className="q-player">
      <RoleIcon role={p.role} size={18} />
      <Avatar name={p.name} image={p.image} size="sm" />
      <div className="nm"><b>{p.name}{captainBadge && <span className="cap" title="Kapitán"><Icon name="crown" /></span>}</b><small>{p.mmr} MMR</small></div>
      {right}
    </div>
  );
}

/* ───────── Hlavní komponenta ───────── */

export function QueueModal() {
  const { state, hidden, setHidden, error, setError } = useQueue();
  const l = state?.lobby;
  // Ukončenou hru po chvíli zavřeme
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => setError(null), [l?.status, setError]);
  if (!l || dismissed === l.id) return null;

  const canHide = ["IN_GAME", "CONFIRM", "DONE", "CANCELLED"].includes(l.status);
  if (hidden && canHide) return null;

  return (
    <div className="q-overlay">
      <div className={`q-modal ${l.status === "DRAFT" || l.status === "IN_GAME" || l.status === "CONFIRM" ? "wide" : ""}`}>
        {canHide && (
          <button className="q-close" onClick={() => (l.status === "DONE" || l.status === "CANCELLED" ? setDismissed(l.id) : setHidden(true))} title="Skrýt">
            <Icon name="x" />
          </button>
        )}
        {l.isTest && <TestBar l={l} />}
        {l.status === "READY_CHECK" && <ReadyCheck l={l} />}
        {l.status === "CHOICE" && <Choice l={l} />}
        {l.status === "SIDE" && <SideChoice l={l} />}
        {l.status === "DRAFT" && <Draft l={l} />}
        {(l.status === "IN_GAME" || l.status === "CONFIRM") && <InGame l={l} />}
        {l.status === "DONE" && <Done l={l} close={() => setDismissed(l.id)} />}
        {l.status === "CANCELLED" && <Cancelled close={() => setDismissed(l.id)} />}
        {error && <div className="msg err" style={{ marginTop: 16 }}>{error}</div>}
      </div>
    </div>
  );
}

/* ───────── Testovací lišta ───────── */

function TestBar({ l }: { l: Lobby }) {
  const { act } = useQueue();
  const active = !["DONE", "CANCELLED"].includes(l.status);
  return (
    <div className="q-testbar">
      <span className="tag amber">TESTOVACÍ HRA</span>
      <small>Boti hrají sami, výsledek se neukládá.</small>
      {active && <button className="btn btn-ghost btn-sm" onClick={() => act({ action: "testEnd" })}>Ukončit test</button>}
    </div>
  );
}

/* ───────── Ready check ───────── */

function ReadyCheck({ l }: { l: Lobby }) {
  const { act } = useQueue();
  const mine = l.players.find((p) => p.id === l.meId);
  const readyCount = l.players.filter((p) => p.ready).length;
  return (
    <div className="q-center">
      <div className="eyebrow" style={{ justifyContent: "center" }}>HRA NALEZENA</div>
      <h2 className="q-title">Jsi připraven?</h2>
      <Timer deadline={l.deadline} />
      <div className="q-ready-grid">
        {l.players.map((p) => (
          <div key={p.id} className={`q-ready ${p.ready ? "ok" : ""}`} title={`${p.name} – ${ROLE_CS[p.role]}`}>
            <Avatar name={p.name} image={p.image} size="sm" />
            <RoleSvg role={p.role} size={14} />
          </div>
        ))}
      </div>
      <div className="q-sub">{readyCount} / 10 připraveno</div>
      {mine && !mine.ready ? (
        <div className="q-actions">
          <button className="btn btn-primary q-big" onClick={() => act({ action: "accept" })}><Icon name="check" />Přijmout</button>
          <button className="btn btn-ghost" onClick={() => act({ action: "decline" })}>Odmítnout</button>
        </div>
      ) : (
        <div className="q-sub" style={{ color: "var(--win)" }}>Přijato, čekáme na ostatní…</div>
      )}
    </div>
  );
}

/* ───────── Los mincí a volba ───────── */

function Coin({ l }: { l: Lobby }) {
  const elapsed = useElapsed(l.phaseStartedAt);
  const spinning = elapsed < (4000 - 300);
  const a = captain(l, "A"), b = captain(l, "B");
  return (
    <div className="q-coin-wrap">
      <div className={`q-coin ${spinning ? "spin" : "done"}`}>
        <div className="face front"><Avatar name={a.name} image={a.image} /></div>
        <div className="face back"><Avatar name={b.name} image={b.image} /></div>
      </div>
      <div className="q-sub">{spinning ? "Házím mincí…" : <><b style={{ color: "var(--accent)" }}>{a.name}</b> vyhrál los!</>}</div>
    </div>
  );
}

function CaptainsHeader({ l }: { l: Lobby }) {
  const a = captain(l, "A"), b = captain(l, "B");
  return (
    <div className="q-captains">
      <div className="q-cap"><Avatar name={a.name} image={a.image} /><b>{a.name}</b><small>Kapitán</small></div>
      <div className="q-vs"><RoleIcon role={l.captainRole} size={22} /><small>{l.captainRole ? ROLE_CS[l.captainRole] : ""}</small></div>
      <div className="q-cap"><Avatar name={b.name} image={b.image} /><b>{b.name}</b><small>Kapitán</small></div>
    </div>
  );
}

function Choice({ l }: { l: Lobby }) {
  const { act } = useQueue();
  const elapsed = useElapsed(l.phaseStartedAt);
  const coinDone = elapsed > 3700;
  const a = captain(l, "A");
  return (
    <div className="q-center">
      <div className="eyebrow" style={{ justifyContent: "center" }}>LOS MINCÍ</div>
      <CaptainsHeader l={l} />
      <Coin l={l} />
      {coinDone && (
        l.amCaptain === "A" ? (
          <>
            <div className="q-sub">Vyber si výhodu: <Timer deadline={l.deadline} /></div>
            <div className="q-choice">
              <button className="q-opt" onClick={() => act({ action: "choose", option: "PICK" })}>
                <Icon name="users" /><b>První výběr</b><small>Vybíráš hráče jako první, soupeř si zvolí stranu</small>
              </button>
              <button className="q-opt blue" onClick={() => act({ action: "choose", option: "SIDE", side: "BLUE" })}>
                <span className="side-dot blue" /><b>Blue side</b><small>Soupeř bude vybírat hráče první</small>
              </button>
              <button className="q-opt red" onClick={() => act({ action: "choose", option: "SIDE", side: "RED" })}>
                <span className="side-dot red" /><b>Red side</b><small>Soupeř bude vybírat hráče první</small>
              </button>
            </div>
          </>
        ) : (
          <div className="q-sub">{a.name} vybírá: první výběr hráčů, nebo stranu… <Timer deadline={l.deadline} /></div>
        )
      )}
    </div>
  );
}

function SideChoice({ l }: { l: Lobby }) {
  const { act } = useQueue();
  const a = captain(l, "A"), b = captain(l, "B");
  return (
    <div className="q-center">
      <div className="eyebrow" style={{ justifyContent: "center" }}>VOLBA STRANY</div>
      <CaptainsHeader l={l} />
      <div className="q-sub"><b>{a.name}</b> si vzal první výběr hráčů. <Timer deadline={l.deadline} /></div>
      {l.amCaptain === "B" ? (
        <div className="q-choice two">
          <button className="q-opt blue" onClick={() => act({ action: "side", side: "BLUE" })}><span className="side-dot blue" /><b>Blue side</b><small>Spodní základna, první ban/pick</small></button>
          <button className="q-opt red" onClick={() => act({ action: "side", side: "RED" })}><span className="side-dot red" /><b>Red side</b><small>Horní základna, poslední pick</small></button>
        </div>
      ) : (
        <div className="q-sub">{b.name} vybírá stranu…</div>
      )}
    </div>
  );
}

/* ───────── Draft hráčů ───────── */

function TeamColumn({ l, t, highlight }: { l: Lobby; t: Team; highlight: boolean }) {
  const side = sideOfTeam(l, t);
  const cap = captain(l, t);
  const list = teamPlayers(l, t);
  return (
    <div className={`q-team ${side?.toLowerCase() ?? ""} ${highlight ? "turn" : ""}`}>
      <div className="q-team-head">
        <span className={`side-dot ${side?.toLowerCase() ?? ""}`} />
        <b>{side ? `${side} SIDE` : `Tým ${cap.name}`}</b>
        {l.firstPick === t && <span className="tag grey">1. VÝBĚR</span>}
      </div>
      {ROLE_ORDER.map((r) => {
        const p = list.find((x) => x.role === r);
        return p ? <PlayerRow key={r} p={p} captainBadge={p.id === cap.id} /> : (
          <div key={r} className="q-player empty"><RoleSvg role={r as P["role"]} size={18} /><span>čeká na výběr</span></div>
        );
      })}
    </div>
  );
}

function Draft({ l }: { l: Lobby }) {
  const { act } = useQueue();
  const myTurn = l.amCaptain && l.turn === l.amCaptain;
  const turnCap = l.turn ? captain(l, l.turn) : null;
  const pool = ROLE_ORDER.map((r) => ({ role: r, players: l.players.filter((p) => p.role === r && !p.team) })).filter((g) => g.players.length);
  const picksLeft = pool.length;

  return (
    <div>
      <div className="q-draft-head">
        <div>
          <div className="eyebrow">DRAFT HRÁČŮ</div>
          <h2 className="q-title" style={{ textAlign: "left", margin: 0 }}>{myTurn ? "Tvůj výběr!" : `Vybírá ${turnCap?.name}`}</h2>
          <div className="q-sub" style={{ textAlign: "left" }}>Vyber hráče, druhý hráč ze stejné role jde automaticky soupeři. Zbývá {picksLeft} {picksLeft === 1 ? "výběr" : "výběry"}.</div>
        </div>
        <Timer deadline={l.deadline} />
      </div>
      <div className="q-draft">
        <TeamColumn l={l} t="A" highlight={l.turn === "A"} />
        <div className="q-pool">
          {pool.map((g) => (
            <div className="q-pool-role" key={g.role}>
              <div className="q-pool-label"><RoleSvg role={g.role as P["role"]} size={20} /></div>
              {g.players.map((p) => (
                <button key={p.id} className={`q-pick ${myTurn ? "can" : ""}`} disabled={!myTurn} onClick={() => act({ action: "pick", target: p.id })}>
                  <Avatar name={p.name} image={p.image} size="sm" />
                  <div><b>{p.name}</b><small>{p.mmr} MMR</small></div>
                </button>
              ))}
            </div>
          ))}
        </div>
        <TeamColumn l={l} t="B" highlight={l.turn === "B"} />
      </div>
    </div>
  );
}

/* ───────── Hra: soupisky, lobby, draft šampionů, výsledek ───────── */

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="q-copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}>
      <b>{text}</b><Icon name={ok ? "check" : "link"} />
    </button>
  );
}

function InGame({ l }: { l: Lobby }) {
  const { act, upload } = useQueue();
  const blue: Team = l.blueTeam ?? "A";
  const red: Team = blue === "A" ? "B" : "A";
  const blueCap = captain(l, blue), redCap = captain(l, red);
  const mySide = sideOfTeam(l, l.amCaptain);
  const [url, setUrl] = useState(l.draftUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const roster = (t: Team, side: "BLUE" | "RED") => (
    <div className={`q-team ${side.toLowerCase()}`}>
      <div className="q-team-head"><span className={`side-dot ${side.toLowerCase()}`} /><b>{side} SIDE</b>{l.status === "CONFIRM" && l.resultWinner === side && <span className="tag green">VÍTĚZ</span>}</div>
      {teamPlayers(l, t).map((p) => {
        const st = l.resultStats?.find((s) => s.userId === p.id);
        return <PlayerRow key={p.id} p={p} captainBadge={p.id === captain(l, t).id} right={st ? <span className="q-st">{st.champion} · {st.kills}/{st.deaths}/{st.assists}</span> : undefined} />;
      })}
    </div>
  );

  return (
    <div>
      <div className="q-draft-head">
        <div>
          <div className="eyebrow">{l.status === "CONFIRM" ? "POTVRZENÍ VÝSLEDKU" : "HRA PŘIPRAVENA"}</div>
          <h2 className="q-title" style={{ textAlign: "left", margin: 0 }}>{l.status === "CONFIRM" ? `Vyhrál ${l.resultWinner} side?` : "Soupisky týmů"}</h2>
        </div>
      </div>

      <div className="q-rosters">
        {roster(blue, "BLUE")}
        {roster(red, "RED")}
      </div>

      {l.status === "IN_GAME" && (
        <>
          <div className="q-info-grid">
            <div className="card q-info">
              <div className="k">CUSTOM HRA</div>
              <Copy text={l.lobbyName ?? ""} />
              <div className="k" style={{ marginTop: 12 }}>HESLO</div>
              <Copy text={l.lobbyPassword ?? ""} />
              <p><span className="side-dot blue" /> <b>{blueCap.name}</b> (kapitán BLUE) zakládá custom lobby. Ostatní se připojí podle názvu a hesla.</p>
            </div>
            <div className="card q-info">
              <div className="k">DRAFT ŠAMPIONŮ</div>
              <p><span className="side-dot red" /> <b>{redCap.name}</b> (kapitán RED) založí draft šampionů a vloží sem odkaz.</p>
              {mySide === "RED" ? (
                <div className="form-row" style={{ marginTop: 8 }}>
                  <input className="input" style={{ flex: 1 }} placeholder="https://draftlol.dawe.gg/…" value={url} onChange={(e) => setUrl(e.target.value)} />
                  <button className="btn btn-outline btn-sm" onClick={() => act({ action: "draftUrl", url })}>Uložit</button>
                </div>
              ) : l.draftUrl ? (
                <a className="btn btn-primary btn-sm" href={l.draftUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}><Icon name="ext" />Otevřít draft</a>
              ) : (
                <div className="q-sub" style={{ textAlign: "left" }}>Odkaz zatím nebyl vložen.</div>
              )}
            </div>
          </div>

          {l.disputed && <div className="msg err" style={{ marginTop: 16 }}>Kapitán soupeře výsledek rozporoval. Nahrajte správný replay, nebo kontaktujte admina.</div>}

          {l.amCaptain && mySide && (
            <div className="card q-info" style={{ marginTop: 16 }}>
              <div className="k">PO ZÁPASE</div>
              <p>Pokud vyhrál tvůj tým (<b>{mySide}</b>), nahraj replay (.rofl) a potvrď výhru. Replay stáhneš v klientu v historii zápasů (šipka u hry), soubor najdeš v <code>Dokumenty\League of Legends\Replays</code>.</p>
              <div className="form-row" style={{ marginTop: 10 }}>
                <input className="input" type="file" accept=".rofl" style={{ flex: 1, paddingTop: 10 }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button
                  className="btn btn-primary"
                  disabled={!file || busy}
                  onClick={async () => {
                    setBusy(true);
                    const f = new FormData();
                    f.set("winner", mySide);
                    f.set("rofl", file!);
                    await upload(f);
                    setBusy(false);
                  }}
                >
                  <Icon name="trophy" />{busy ? "Nahrávám…" : `Vyhrál ${mySide} – nahrát`}
                </button>
              </div>
              {l.isTest && (
                <div className="conn-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => act({ action: "testSimulate", winner: mySide })}><Icon name="refresh" />Simulovat výhru {mySide} bez replaye (test)</button>
                  <small style={{ color: "var(--dim)", fontSize: 12.5 }}>Když nic nenahraješ, kapitán soupeře (bot) nahlásí za 45 s svou výhru a ty ji potvrdíš.</small>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {l.status === "CONFIRM" && (
        <div className="card q-info" style={{ marginTop: 16 }}>
          {l.resultStats ? <p>Statistiky byly načteny z replaye. Po potvrzení se zápas uloží a přepočítá se MMR.</p> : <p>Výsledek byl nahlášen bez replaye, statistiky nebudou k dispozici.</p>}
          {l.amCaptain && l.amCaptain !== l.resultBy ? (
            <div className="conn-actions" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => act({ action: "confirm", accept: true })}><Icon name="check" />Potvrdit výsledek</button>
              <button className="btn btn-danger" onClick={() => act({ action: "confirm", accept: false })}><Icon name="x" />Rozporovat</button>
            </div>
          ) : (
            <div className="q-sub" style={{ textAlign: "left" }}>Čekáme na potvrzení kapitánem soupeře…</div>
          )}
        </div>
      )}
    </div>
  );
}

function Done({ l, close }: { l: Lobby; close: () => void }) {
  const winner = l.resultWinner;
  return (
    <div className="q-center">
      <div className="step-ico" style={{ margin: "0 auto 16px", width: 56, height: 56 }}><Icon name="trophy" /></div>
      <h2 className="q-title">Zápas uložen</h2>
      <div className="q-sub">{winner ? `Vyhrál ${winner} side.` : ""} MMR bylo přepočítáno.</div>
      <div className="q-actions">
        <Link className="btn btn-primary" href="/zapasy" onClick={close}>Historie zápasů</Link>
        <button className="btn btn-ghost" onClick={close}>Zavřít</button>
      </div>
    </div>
  );
}

function Cancelled({ close }: { close: () => void }) {
  return (
    <div className="q-center">
      <h2 className="q-title">Hra zrušena</h2>
      <div className="q-sub">Někdo nepřijal ready check, nebo hru zrušil admin. Pokud jsi přijal, vrátil ses do fronty na své místo.</div>
      <div className="q-actions"><button className="btn btn-outline" onClick={close}>Zavřít</button></div>
    </div>
  );
}
