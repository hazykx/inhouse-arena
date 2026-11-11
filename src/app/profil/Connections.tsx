"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/Icon";
import { RolePicker } from "@/components/RolePicker";
import type { Role } from "@/db/schema";
import { linkRiot, setPrimaryRiot, unlinkRiot, unlinkSocial, updateRoles, type ActionState } from "./actions";

/* ───────── Twitch / Kick ───────── */

export function SocialConnection({ provider, linked, enabled }: { provider: "twitch" | "kick"; linked: string | null; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = provider === "twitch" ? "Twitch" : "Kick";

  return (
    <div className="conn-actions">
      {linked ? (
        <>
          <a className="btn btn-outline btn-sm" href={linked} target="_blank" rel="noreferrer"><Icon name="ext" />Otevřít kanál</a>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await unlinkSocial(provider);
              } catch {
                setError("Odpojení se nepovedlo");
              }
              setBusy(false);
              router.refresh();
            }}
          >
            <Icon name="x" />Odpojit
          </button>
        </>
      ) : (
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !enabled}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const res = await authClient.linkSocial({ provider, callbackURL: "/profil" });
            if (res?.error) {
              setError(res.error.message ?? "Propojení se nepovedlo");
              setBusy(false);
            }
          }}
        >
          <Icon name="link" />{busy ? "Přesměrovávám…" : `Propojit ${label}`}
        </button>
      )}
      {!enabled && !linked && <small style={{ color: "var(--dim)", fontSize: 12.5 }}>Chybí {provider.toUpperCase()}_CLIENT_ID v .env</small>}
      {error && <div className="msg err" style={{ width: "100%" }}>{error}</div>}
    </div>
  );
}

/* ───────── League of Legends (až 3 účty) ───────── */

type RiotAcc = { id: number; gameName: string; tagLine: string; platform: string; profileIconId: number | null; summonerLevel: number | null; primary: boolean };

export function RiotConnection({ accounts, ddVersion, platforms, hasKey, max }: { accounts: RiotAcc[]; ddVersion: string; platforms: { value: string; label: string }[]; hasKey: boolean; max: number }) {
  const [state, action, linking] = useActionState<ActionState, FormData>(linkRiot, null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const icon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${id}.png`;
  const hasEune = accounts.some((a) => a.platform === "eun1");
  const label = (p: string) => platforms.find((x) => x.value === p)?.label ?? p;

  return (
    <>
      {accounts.map((a) => (
        <div key={a.id} className="riot-acc">
          {a.profileIconId != null ? <img src={icon(a.profileIconId)} alt="" /> : <span className="champ-ph" />}
          <div style={{ minWidth: 0 }}>
            <b>{a.gameName}<span style={{ color: "var(--muted)" }}>#{a.tagLine}</span></b>
            <div className="sub">{label(a.platform)} · úroveň {a.summonerLevel ?? "?"}</div>
          </div>
          {a.primary ? <span className="tag green">HLAVNÍ</span> : (
            <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => setPrimaryRiot(a.id))}>Nastavit jako hlavní</button>
          )}
          <button className="btn btn-ghost btn-sm" disabled={pending} title="Odpojit" onClick={() => start(async () => { const r = await unlinkRiot(a.id); setErr(r?.error ?? null); })}><Icon name="x" /></button>
        </div>
      ))}
      {err && <div className="msg err">{err}</div>}
      {state?.message && <div className="msg ok">{state.message}</div>}

      {accounts.length < max ? (
        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!hasKey && <div className="msg err">Chybí RIOT_API_KEY – bez něj propojení nefunguje.</div>}
          <div className="form-row">
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="riotId">{accounts.length ? "PŘIDAT DALŠÍ ÚČET" : "RIOT ID"}</label>
              <input className="input" id="riotId" name="riotId" placeholder="Jméno#TAG" required />
            </div>
            <div className="field">
              <label htmlFor="platform">SERVER</label>
              <select className="select" id="platform" name="platform" defaultValue="eun1" disabled={!hasEune && false}>
                {platforms.map((p) => <option key={p.value} value={p.value} disabled={!hasEune && p.value !== "eun1"}>{p.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" disabled={linking || !hasKey}>{linking ? "Hledám…" : "Propojit"}<Icon name="link" /></button>
          </div>
          <div className="hint" style={{ fontSize: 12.5, color: "var(--dim)" }}>
            {hasEune ? `Můžeš propojit až ${max} účty (zbývá ${max - accounts.length}).` : "První účet musí být z EUNE. Další můžou být z jiných serverů."}
          </div>
          {state?.error && <div className="msg err">{state.error}</div>}
        </form>
      ) : (
        <div className="hint" style={{ fontSize: 12.5, color: "var(--dim)" }}>Máš propojený maximální počet účtů ({max}).</div>
      )}
    </>
  );
}

/* ───────── Role ───────── */

export function RolesForm({ main, secondary }: { main: Role | null; secondary: Role | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateRoles, null);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="form-row" style={{ gap: 32 }}>
        <div className="field" style={{ flex: "none" }}>
          <label>HLAVNÍ ROLE</label>
          <RolePicker name="mainRole" defaultValue={[main]} />
        </div>
        <div className="field" style={{ flex: "none" }}>
          <label>VEDLEJŠÍ ROLE</label>
          <RolePicker name="secondaryRole" defaultValue={[secondary]} />
        </div>
      </div>
      <div className="conn-actions">
        <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Ukládám…" : "Uložit role"}</button>
        {state?.error && <div className="msg err">{state.error}</div>}
        {state?.message && <div className="msg ok">{state.message}</div>}
      </div>
    </form>
  );
}
