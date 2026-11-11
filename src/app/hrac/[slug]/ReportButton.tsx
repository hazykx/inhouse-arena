"use client";
import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { REPORT_CATEGORIES } from "@/db/schema";
import { createReport, type ReportState } from "./actions";

export function ReportButton({ targetId, name, matches }: { targetId: string; name: string; matches: { id: number; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ReportState, FormData>(createReport.bind(null, targetId), null);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><Icon name="info" />Nahlásit</button>
      {open && (
        <div className="q-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="q-modal" style={{ width: "min(520px,100%)" }}>
            <button className="q-close" onClick={() => setOpen(false)}><Icon name="x" /></button>
            {state?.ok ? (
              <div className="q-center">
                <div className="step-ico" style={{ margin: "0 auto 14px", background: "rgba(111,211,168,.12)", color: "var(--win)" }}><Icon name="check" /></div>
                <h2 className="q-title">Díky za nahlášení</h2>
                <div className="q-sub">Admin se na to podívá. Výsledek ti nepošleme, ale každé nahlášení čteme.</div>
                <div className="q-actions"><button className="btn btn-outline" onClick={() => setOpen(false)}>Zavřít</button></div>
              </div>
            ) : (
              <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div className="eyebrow">NAHLÁŠENÍ HRÁČE</div>
                  <h2 style={{ fontSize: 24, letterSpacing: -0.6 }}>{name}</h2>
                </div>
                <div className="field">
                  <label>DŮVOD</label>
                  <div className="tag-picker">
                    {REPORT_CATEGORIES.map((c, i) => (
                      <label key={c}><input type="radio" name="category" value={c} defaultChecked={i === 0} /><span>{c}</span></label>
                    ))}
                  </div>
                </div>
                {matches.length > 0 && (
                  <div className="field">
                    <label>ZÁPAS (NEPOVINNÉ)</label>
                    <select className="select" name="matchId" defaultValue="">
                      <option value="">Bez konkrétního zápasu</option>
                      {matches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>CO SE STALO</label>
                  <textarea className="input" name="text" maxLength={1000} required placeholder="Popiš situaci, případně čas ve hře…" />
                </div>
                {state?.error && <div className="msg err">{state.error}</div>}
                <div className="conn-actions">
                  <button className="btn btn-danger" disabled={pending}><Icon name="info" />{pending ? "Odesílám…" : "Odeslat nahlášení"}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Zrušit</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
