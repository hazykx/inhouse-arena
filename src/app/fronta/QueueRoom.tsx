"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RoleSvg } from "@/components/RoleIcon";
import { LoginButton } from "@/components/AuthButtons";
import { useElapsed, useQueue } from "@/components/queue/QueueProvider";
import { ROLES, type Role } from "@/db/schema";
import { ROLE_CS } from "@/lib/format";

const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const STATUS_CS: Record<string, string> = { READY_CHECK: "Ready check", CHOICE: "Los mincí", SIDE: "Volba strany", DRAFT: "Draft", IN_GAME: "Hraje se", CONFIRM: "Čeká na potvrzení" };

export function QueueRoom({ loggedIn, defaultRole }: { loggedIn: boolean; defaultRole: Role | null }) {
  const { state, act, error, setHidden } = useQueue();
  const [role, setRole] = useState<Role | null>(defaultRole);
  const elapsed = useElapsed(state?.me?.joinedAt);
  const q = state?.queue;
  const total = q ? Object.values(q.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">INHOUSE 5V5</div>
          <h1>Fronta<span className="dot">.</span></h1>
          <div className="lead">Vyber roli a zařaď se. Hra začne, jakmile jsou na každou roli 2 hráči.</div>
        </div>
        <div className="side-note">{q ? `${total} ve frontě · ${q.inGame} ${q.inGame === 1 ? "hra" : "her"} právě běží` : ""}</div>
      </div>

      <div className="q-room">
        {/* Levý panel: připojení */}
        <div className="card q-join">
          {!loggedIn ? (
            <div className="empty" style={{ padding: 20 }}>
              <b>Pro hraní se přihlas</b>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}><LoginButton callbackURL="/fronta" /></div>
            </div>
          ) : state?.sanction ? (
            <div className="empty" style={{ padding: 20 }}>
              <b style={{ color: "var(--loss)" }}>{state.sanction.type === "BAN" ? "Máš ban" : "Máš pauzu ve frontě"}</b>
              {state.sanction.text}
            </div>
          ) : state && !state.queueEnabled && !state.lobby ? (
            <div className="empty" style={{ padding: 20 }}>
              <b>Fronta je teď vypnutá</b>
              Admin frontu dočasně vypnul. Zkus to později.
            </div>
          ) : state?.lobby ? (
            <div className="q-center" style={{ padding: "10px 0" }}>
              <div className="eyebrow" style={{ justifyContent: "center" }}>JSI VE HŘE</div>
              <h3 style={{ fontSize: 20 }}>{STATUS_CS[state.lobby.status] ?? "Hra"}</h3>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setHidden(false)}>Otevřít okno hry</button>
            </div>
          ) : state?.me ? (
            <div className="q-center" style={{ padding: "10px 0" }}>
              <div className="q-searching"><span /><RoleSvg role={state.me.role} size={34} /></div>
              <div className="q-time">{mmss(elapsed)}</div>
              <div className="q-sub">Hledám hru jako <b>{ROLE_CS[state.me.role]}</b></div>
              <button className="btn btn-outline" style={{ marginTop: 18 }} onClick={() => act({ action: "leave" })}><Icon name="x" />Opustit frontu</button>
            </div>
          ) : (
            <>
              <div className="k">VYBER ROLI</div>
              <div className="q-role-select">
                {ROLES.map((r) => {
                  const n = q?.counts[r] ?? 0;
                  return (
                    <button key={r} className={`q-role-btn ${role === r ? "on" : ""}`} onClick={() => setRole(r)}>
                      <RoleSvg role={r} size={30} />
                      <b>{ROLE_CS[r]}</b>
                      <small className={n >= 2 ? "full" : ""}>{n >= 2 ? `plno (${n})` : `${n}/2`}</small>
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-primary q-big" style={{ width: "100%", justifyContent: "center", marginTop: 18 }} disabled={!role} onClick={() => role && act({ action: "join", role })}>
                <Icon name="swords" />Hledat hru
              </button>
              <div className="hint" style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: "var(--dim)" }}>Když bude role plná, počkáš na další hru. Méně obsazené role najdou hru rychleji.</div>
            </>
          )}
          {error && <div className="msg err" style={{ marginTop: 14 }}>{error}</div>}
        </div>

        {/* Pravý panel: kdo čeká */}
        <div className="card q-board">
          <div className="panel-head"><h3>Ve frontě</h3><small>{total}/10 do další hry</small></div>
          {ROLES.map((r) => {
            const ps = q?.players.filter((p) => p.role === r) ?? [];
            return (
              <div className="q-board-row" key={r}>
                <span className="q-board-role" title={ROLE_CS[r]}><RoleSvg role={r} size={22} /></span>
                {[0, 1].map((i) => {
                  const p = ps[i];
                  return p ? (
                    <div className="q-slot on" key={i}><Avatar name={p.name} image={p.image} size="sm" /><b>{p.name}</b></div>
                  ) : (
                    <div className="q-slot" key={i}>volné místo</div>
                  );
                })}
                {ps.length > 2 && <span className="tag grey">+{ps.length - 2} čeká</span>}
              </div>
            );
          })}
        </div>
      </div>

      {state?.admin && (
        <div className="section">
          <div className="card panel" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div><h3 style={{ fontSize: 17 }}>Admin</h3><small style={{ color: "var(--muted)" }}>Vypnutí a reset fronty, spory a testovací hry najdeš v admin panelu.</small></div>
            <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
              <a className="btn btn-outline btn-sm" href="/admin?tab=test"><Icon name="play" />Testovací režim</a>
              <a className="btn btn-primary btn-sm" href="/admin"><Icon name="settings" />Admin panel</a>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
