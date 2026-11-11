import Link from "next/link";
import type { MatchWithPlayers } from "@/lib/data";
import { duration, when, ROLE_CS } from "@/lib/format";
import { RoleSvg } from "./RoleIcon";
import { Icon } from "./Icon";

type Champs = { version: string; byId: Map<string, { name: string }> };
const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

export function MatchCard({ m, champs }: { m: MatchWithPlayers; champs: Champs }) {
  const team = (t: "BLUE" | "RED") => m.players.filter((p) => p.team === t).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  const blueWin = m.winner === "BLUE";
  const elo = Math.abs(m.players[0]?.mmrChange ?? 0);

  const side = (t: "BLUE" | "RED") => {
    const won = m.winner === t;
    return (
      <div className={`team ${t === "BLUE" ? "blue" : "red"}`}>
        <h4>
          {t === "BLUE" ? "MODRÝ TÝM" : "ČERVENÝ TÝM"}{" "}
          <span className={`tag ${won ? "green" : "red"}`}>
            {won ? "VÝHRA +" : "PROHRA −"}
            {elo}
          </span>
        </h4>
        {team(t).map((p) => (
          <div className="pl" key={p.id}>
            <span className="role-ic" title={ROLE_CS[p.role]}><RoleSvg role={p.role} size={15} /></span>
            <Link href={`/hrac/${p.userId}`}><b>{p.user.name}</b></Link>
            <span className="champ">{p.hasStats ? champs.byId.get(p.champion)?.name ?? p.champion : ""}</span>
            <span className="kda">{p.hasStats ? `${p.kills}/${p.deaths}/${p.assists}` : "—"}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="card match">
      <div className="match-top">
        <b>Zápas #{m.id}</b>
        <div className="meta">
          <span><Icon name="cal" />{when(m.playedAt)}</span>
          <span><Icon name="clock" />{duration(m.durationSec)}</span>
          <span>Summoner&apos;s Rift · Draft</span>
        </div>
      </div>
      <div className="teams">
        {side("BLUE")}
        <div className="vs">
          <small>VS</small>
          <b>{blueWin ? "1 : 0" : "0 : 1"}</b>
        </div>
        {side("RED")}
      </div>
    </div>
  );
}
