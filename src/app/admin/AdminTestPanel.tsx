"use client";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { RoleSvg } from "@/components/RoleIcon";
import { useQueue } from "@/components/queue/QueueProvider";
import { ROLES, type Role } from "@/db/schema";
import { ROLE_CS } from "@/lib/format";
import { createBots, deleteBots, fillQueueWithBots } from "./actions";

/** Testovací režim: hra s boty, kde je admin kapitán, a správa botů */
export function AdminTestPanel() {
  const { state, act, error } = useQueue();
  const [role, setRole] = useState<Role>("MID");
  const [coin, setCoin] = useState<"win" | "lose" | "random">("win");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<void>, ok: string) => start(async () => { try { await fn(); setMsg(ok); } catch (e) { setMsg(e instanceof Error ? e.message : "Chyba"); } });

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card panel q-testpanel">
        <div className="panel-head"><h3>Testovací hra</h3><span className="tag amber">TEST</span></div>
        <p className="lead" style={{ marginTop: 0 }}>Vyzkoušej ready check, los mincí, draft a výsledek jako kapitán. Dalších 9 hráčů jsou boti, výsledek se neukládá do statistik ani MMR. Potřebuje vytvořené boty (níže).</p>
        <div className="form-row" style={{ gap: 28, marginTop: 18, alignItems: "flex-start" }}>
          <div className="field" style={{ flex: "none" }}>
            <label>TVOJE ROLE (KAPITÁN)</label>
            <div className="q-role-select" style={{ width: 380 }}>
              {ROLES.map((r) => (
                <button key={r} type="button" className={`q-role-btn ${role === r ? "on" : ""}`} onClick={() => setRole(r)} style={{ padding: "10px 4px" }}>
                  <RoleSvg role={r} size={24} /><b>{ROLE_CS[r]}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ flex: "none" }}>
            <label>LOS MINCÍ</label>
            <div className="tag-picker">
              {([["win", "Vyhraju (volím výhodu)"], ["lose", "Prohraju (volím stranu)"], ["random", "Náhodně"]] as const).map(([v, t]) => (
                <label key={v}><input type="radio" name="coin" checked={coin === v} onChange={() => setCoin(v)} /><span>{t}</span></label>
              ))}
            </div>
          </div>
        </div>
        <div className="conn-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" disabled={!!state?.me || !!state?.lobby} onClick={() => act({ action: "test", role, coin })}><Icon name="play" />Spustit testovací hru</button>
          {(state?.me || state?.lobby) && <span className="hint" style={{ fontSize: 12.5, color: "var(--dim)" }}>Nejdřív opusť frontu nebo dokonči hru.</span>}
        </div>
        {error && <div className="msg err" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="card panel">
        <div className="panel-head"><h3>Testovací boti</h3><small>12 hráčů demo-1 … demo-12</small></div>
        <p className="lead" style={{ marginTop: 0 }}>Boti přijímají ready check, volí a draftují sami. „Doplnit frontu boty“ pustí boty do skutečné fronty, takže taková hra se uloží. Smazání botů smaže i zápasy, ve kterých hráli, a přepočítá MMR.</p>
        <div className="conn-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-outline" disabled={pending} onClick={() => run(createBots, "Boti vytvořeni.")}><Icon name="plus" />Vytvořit boty</button>
          <button className="btn btn-outline" disabled={pending} onClick={() => run(fillQueueWithBots, "Fronta doplněna boty.")}><Icon name="users" />Doplnit frontu boty</button>
          <DeleteBotsButton disabled={pending} onConfirm={() => run(deleteBots, "Boti smazáni.")} />
        </div>
        {msg && <div className="msg ok" style={{ marginTop: 12 }}>{msg}</div>}
      </div>
    </div>
  );
}

/** Smazání na dvě kliknutí */
function DeleteBotsButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [sure, setSure] = useState(false);
  return (
    <button className="btn btn-danger" disabled={disabled} onMouseLeave={() => setSure(false)} onClick={() => (sure ? (setSure(false), onConfirm()) : setSure(true))}>
      <Icon name="x" />{sure ? "Opravdu smazat boty?" : "Smazat boty"}
    </button>
  );
}
