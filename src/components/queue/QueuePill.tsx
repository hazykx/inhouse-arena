"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../Icon";
import { RoleSvg } from "../RoleIcon";
import { useElapsed, useQueue } from "./QueueProvider";

const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Plovoucí ukazatel: čas ve frontě, nebo návrat do skryté hry */
export function QueuePill() {
  const { state, act, hidden, setHidden } = useQueue();
  const path = usePathname();
  const elapsed = useElapsed(state?.me?.joinedAt);
  if (!state) return null;

  if (state.lobby && hidden && ["IN_GAME", "CONFIRM"].includes(state.lobby.status)) {
    return (
      <button className="q-pill game" onClick={() => setHidden(false)}>
        <span className="pulse" />Hra probíhá · otevřít
      </button>
    );
  }
  if (!state.me || state.lobby) return null;
  if (path === "/fronta") return null;
  const total = Object.values(state.queue.counts).reduce((a, b) => a + b, 0);
  return (
    <div className="q-pill">
      <span className="pulse" />
      <RoleSvg role={state.me.role} size={16} />
      <Link href="/fronta"><b>Ve frontě {mmss(elapsed)}</b> · {total}/10</Link>
      <button onClick={() => act({ action: "leave" })} title="Opustit frontu"><Icon name="x" /></button>
    </div>
  );
}
