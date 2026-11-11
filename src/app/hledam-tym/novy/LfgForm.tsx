"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RolePicker } from "@/components/RolePicker";
import { LFG_TAGS } from "@/db/schema";
import { RANK_OPTIONS } from "@/lib/format";
import { createLfgPost, type FormState } from "../actions";

export function LfgForm({ defaultKind }: { defaultKind: "PLAYER" | "TEAM" }) {
  const [kind, setKind] = useState(defaultKind);
  const [state, action, pending] = useActionState<FormState, FormData>(createLfgPost, null);
  const [len, setLen] = useState(0);

  return (
    <form action={action} className="card form-card">
      <div className="kind-switch">
        <label>
          <input type="radio" name="kind" value="PLAYER" checked={kind === "PLAYER"} onChange={() => setKind("PLAYER")} />
          <div className="opt"><div className="step-ico"><Icon name="user" /></div><div><b>Hledám tým</b><small>Jsem hráč a hledám spoluhráče nebo tým</small></div></div>
        </label>
        <label>
          <input type="radio" name="kind" value="TEAM" checked={kind === "TEAM"} onChange={() => setKind("TEAM")} />
          <div className="opt"><div className="step-ico"><Icon name="users" /></div><div><b>Hledáme hráče</b><small>Máme tým a sháníme posilu</small></div></div>
        </label>
      </div>

      {kind === "TEAM" && (
        <div className="field">
          <label htmlFor="teamName">NÁZEV TÝMU</label>
          <input className="input" id="teamName" name="teamName" maxLength={60} placeholder="např. Praha Wolves" required />
        </div>
      )}

      <div className="field">
        <label>{kind === "TEAM" ? "HLEDANÉ ROLE" : "MOJE ROLE"}</label>
        <RolePicker name="roles" multiple />
        <div className="hint">{kind === "TEAM" ? "Vyber všechny role, které hledáte." : "První vybraná role se zobrazí jako hlavní."}</div>
      </div>

      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="rank">{kind === "TEAM" ? "RANK TÝMU" : "MŮJ RANK"}</label>
        {kind === "TEAM" ? (
          <input className="input" id="rank" name="rank" maxLength={40} placeholder="např. Gold – Platinum" />
        ) : (
          <select className="select" id="rank" name="rank" defaultValue="">
            <option value="">Neuvádět</option>
            {RANK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      <div className="field">
        <label>CO HLEDÁŠ</label>
        <div className="tag-picker">
          {LFG_TAGS.map((t) => (
            <label key={t}><input type="checkbox" name="tags" value={t} /><span>{t}</span></label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="text">TEXT INZERÁTU</label>
        <textarea className="input" id="text" name="text" maxLength={500} required onChange={(e) => setLen(e.target.value.length)}
          placeholder={kind === "TEAM" ? "Kdo jste, kdy trénujete, na jaké turnaje jdete…" : "Kdy hraješ, co hledáš, jaké máš cíle…"} />
        <div className="hint">{len} / 500</div>
      </div>

      {state?.error && <div className="msg err">{state.error}</div>}
      <div className="conn-actions">
        <button className="btn btn-primary" disabled={pending}><Icon name="check" />{pending ? "Ukládám…" : "Zveřejnit inzerát"}</button>
        <Link className="btn btn-ghost" href="/hledam-tym">Zrušit</Link>
      </div>
    </form>
  );
}
