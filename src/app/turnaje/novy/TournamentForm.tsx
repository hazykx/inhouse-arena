"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { createTournament, type FormState } from "../actions";

export function TournamentForm({ admin }: { admin: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTournament, null);
  return (
    <form action={action} className="card form-card">
      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="name">NÁZEV</label>
          <input className="input" id="name" name="name" maxLength={80} placeholder="např. Winter Clash Open" required />
        </div>
        <div className="field">
          <label htmlFor="kind">TYP</label>
          <select className="select" id="kind" name="kind" defaultValue="TURNAJ">
            <option value="TURNAJ">Turnaj</option>
            <option value="LIGA">Liga</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="organizer">POŘADATEL</label>
          <input className="input" id="organizer" name="organizer" maxLength={60} placeholder="např. Esport klub Praha" required />
        </div>
        <div className="field">
          <label htmlFor="format">FORMÁT</label>
          <input className="input" id="format" name="format" maxLength={60} placeholder="např. 5v5 · Single elim · Bo3" required />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="startsAt">ZAČÁTEK</label>
          <input className="input" type="date" id="startsAt" name="startsAt" required />
        </div>
        <div className="field">
          <label htmlFor="endsAt">KONEC (NEPOVINNÉ)</label>
          <input className="input" type="date" id="endsAt" name="endsAt" />
        </div>
        <div className="field">
          <label htmlFor="registrationUntil">REGISTRACE DO (NEPOVINNÉ)</label>
          <input className="input" type="date" id="registrationUntil" name="registrationUntil" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="prize">CENY</label>
          <input className="input" id="prize" name="prize" maxLength={80} placeholder="např. 5 000 Kč + merch" />
        </div>
        <div className="field">
          <label htmlFor="capacity">KAPACITA</label>
          <input className="input" id="capacity" name="capacity" maxLength={40} placeholder="např. 16 týmů" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="url">ODKAZ NA REGISTRACI / DETAIL</label>
        <input className="input" type="url" id="url" name="url" maxLength={300} placeholder="https://…" />
      </div>

      <div className="field">
        <label htmlFor="description">POPIS</label>
        <textarea className="input" id="description" name="description" maxLength={600} placeholder="Pro koho je turnaj, pravidla, stream finále…" />
      </div>

      {admin && (
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" name="featured" /> Doporučit na hlavní banner (jen admin)
        </label>
      )}

      {state?.error && <div className="msg err">{state.error}</div>}
      <div className="conn-actions">
        <button className="btn btn-primary" disabled={pending}><Icon name="check" />{pending ? "Ukládám…" : "Přidat turnaj"}</button>
        <Link className="btn btn-ghost" href="/turnaje">Zrušit</Link>
      </div>
    </form>
  );
}
