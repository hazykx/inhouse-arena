import { formatRank, TIER_COLOR, type LeagueEntryDto } from "@/lib/riot";

/** Barevný znak ranku (vlastní, ne oficiální emblém) */
export function Emblem({ tier }: { tier?: string }) {
  const c = tier ? TIER_COLOR[tier] ?? "#8b8b93" : "#3a3a44";
  return (
    <div className="emblem" style={{ background: `radial-gradient(circle at 50% 35%, ${c}33, ${c}0d 70%)`, border: `1px solid ${c}55` }}>
      <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.6} strokeLinejoin="round">
        <path d="M12 2.5 4.5 6v5.6c0 4.6 3.2 8.2 7.5 9.9 4.3-1.7 7.5-5.3 7.5-9.9V6L12 2.5Z" fill={`${c}22`} />
        <path d="M12 7.5 9 12l3 4.5 3-4.5-3-4.5Z" fill={c} stroke="none" />
      </svg>
    </div>
  );
}

export function RankBlock({ title, entry }: { title: string; entry?: LeagueEntryDto }) {
  if (!entry) {
    return (
      <div className="rank-card">
        <Emblem />
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.6, color: "var(--muted)", fontWeight: 700 }}>{title}</div>
          <div className="tier" style={{ color: "var(--muted)" }}>Unranked</div>
        </div>
      </div>
    );
  }
  const games = entry.wins + entry.losses;
  const wr = games ? Math.round((entry.wins / games) * 100) : 0;
  return (
    <div className="rank-card">
      <Emblem tier={entry.tier} />
      <div>
        <div style={{ fontSize: 11, letterSpacing: 1.6, color: "var(--muted)", fontWeight: 700 }}>{title}</div>
        <div className="tier" style={{ color: TIER_COLOR[entry.tier] }}>{formatRank(entry)}</div>
        <div className="lp">{entry.leaguePoints} LP</div>
        <div className="wl"><span style={{ color: "var(--win)" }}>{entry.wins}V</span> / <span style={{ color: "var(--loss)" }}>{entry.losses}P</span> · {wr} % WR</div>
      </div>
    </div>
  );
}
