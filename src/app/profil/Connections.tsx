"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/Icon";
import { RolePicker } from "@/components/RolePicker";
import type { Role } from "@/db/schema";
import { linkRiot, unlinkRiot, unlinkSocial, updateRoles, type ActionState } from "./actions";

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

/* ───────── League of Legends ───────── */

type Riot = { gameName: string; tagLine: string; platform: string; profileIconId: number | null; summonerLevel: number | null } | null;

export function RiotConnection({ riot, ddVersion, platforms, hasKey }: { riot: Riot; ddVersion: string; platforms: { value: string; label: string }[]; hasKey: boolean }) {
  const [state, action, linking] = useActionState<ActionState, FormData>(linkRiot, null);
  const [unlinking, startUnlink] = useTransition();
  const [editing, setEditing] = useState(false);
  const icon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${id}.png`;

  // Propojený účet
  if (riot && !editing) {
    return (
      <>
        <div className="verify-box" style={{ borderStyle: "solid", borderColor: "var(--line)", background: "var(--bg)" }}>
          {riot.profileIconId != null && <img src={icon(riot.profileIconId)} alt="" />}
          <div>
            <b style={{ fontSize: 16 }}>{riot.gameName}<span style={{ color: "var(--muted)" }}>#{riot.tagLine}</span></b>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{platforms.find((p) => p.value === riot.platform)?.label} · úroveň {riot.summonerLevel}</div>
          </div>
        </div>
        {state?.message && <div className="msg ok">{state.message}</div>}
        <div className="conn-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}><Icon name="refresh" />Změnit účet</button>
          <button className="btn btn-ghost btn-sm" disabled={unlinking} onClick={() => startUnlink(() => unlinkRiot())}><Icon name="x" />Odpojit</button>
        </div>
      </>
    );
  }

  // Formulář pro zadání Riot ID
  return (
    <form action={async (fd) => { action(fd); setEditing(false); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!hasKey && <div className="msg err">Chybí RIOT_API_KEY v .env – bez něj propojení nefunguje.</div>}
      <div className="form-row">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="riotId">RIOT ID</label>
          <input className="input" id="riotId" name="riotId" placeholder="Jméno#TAG" defaultValue={riot ? `${riot.gameName}#${riot.tagLine}` : ""} required />
        </div>
        <div className="field">
          <label htmlFor="platform">SERVER</label>
          <select className="select" id="platform" name="platform" defaultValue={riot?.platform ?? "eun1"}>
            {platforms.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={linking || !hasKey}>{linking ? "Hledám…" : "Propojit"}<Icon name="link" /></button>
      </div>
      {riot && editing && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setEditing(false)}>Zrušit</button>}
      {state?.error && <div className="msg err">{state.error}</div>}
    </form>
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
