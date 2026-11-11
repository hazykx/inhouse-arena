"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { QueueState } from "@/lib/queue";

export type ClientState = QueueState & {
  loggedIn: boolean;
  admin: boolean;
  testTools: boolean;
  adminLobbies: { id: number; status: string; disputed: boolean; resultWinner: string | null; createdAt: number; players: string[] }[];
};

type Ctx = {
  state: ClientState | null;
  error: string | null;
  setError: (e: string | null) => void;
  act: (body: Record<string, unknown>) => Promise<boolean>;
  upload: (form: FormData) => Promise<boolean>;
  refresh: () => void;
  serverNow: () => number;
  hidden: boolean;
  setHidden: (h: boolean) => void;
};

const QueueCtx = createContext<Ctx | null>(null);
export const useQueue = () => useContext(QueueCtx)!;

/** Pípnutí při nalezení hry (Web Audio, bez souborů) */
function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 880 : 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* prohlížeč zvuk nepovolil */
  }
}

export function QueueProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [state, setState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const offset = useRef(0);
  const lastLobby = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/queue", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as ClientState;
      offset.current = json.now - Date.now();
      // Nová hra nalezena → zvuk a otevřít okno
      if (json.lobby && json.lobby.id !== lastLobby.current && json.lobby.status === "READY_CHECK") {
        beep();
        setHidden(false);
      }
      lastLobby.current = json.lobby?.id ?? null;
      setState(json);
    } catch {
      /* offline – zkusíme znovu */
    }
  }, []);

  // Polling: rychleji, když jsem ve frontě nebo ve hře
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const loop = async () => {
      await load();
      if (!alive) return;
      const busy = !!(state?.me || state?.lobby);
      timer.current = setTimeout(loop, document.hidden && !busy ? 10000 : busy ? 1500 : 4000);
    };
    loop();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load, !!state?.me, !!state?.lobby]);

  // Blikající titulek při ready checku
  useEffect(() => {
    if (state?.lobby?.status !== "READY_CHECK") return;
    const orig = document.title;
    let on = false;
    const t = setInterval(() => { document.title = (on = !on) ? "⚔ HRA NALEZENA!" : orig; }, 900);
    return () => { clearInterval(t); document.title = orig; };
  }, [state?.lobby?.status]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Něco se pokazilo.");
    await load();
    return res.ok;
  }, [load]);

  const upload = useCallback(async (form: FormData) => {
    setError(null);
    const res = await fetch("/api/queue", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Nahrání se nepovedlo.");
    await load();
    return res.ok;
  }, [load]);

  return (
    <QueueCtx.Provider value={{ state, error, setError, act, upload, refresh: load, serverNow: () => Date.now() + offset.current, hidden, setHidden }}>
      {children}
    </QueueCtx.Provider>
  );
}

/** Odpočet do termínu (v sekundách), překresluje se každou čtvrtsekundu */
export function useCountdown(deadline: number | null | undefined) {
  const { serverNow } = useQueue();
  const [, force] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
}

/** Uplynulý čas od okamžiku (ms) */
export function useElapsed(since: number | null | undefined) {
  const { serverNow } = useQueue();
  const [, force] = useState(0);
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, serverNow() - since) : 0;
}
