import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Art, hashSeed } from "@/components/Art";
import { Avatar, colorFor, initials } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { MmrChart } from "@/components/MmrChart";
import { RoleIcon } from "@/components/RoleIcon";
import { RankBlock } from "@/components/RankBadge";
import { getCommunityAverages, getMatches, getPlayer } from "@/lib/data";
import { duration, fmt, ROLE_CS, when } from "@/lib/format";
import { getSession } from "@/lib/session";
import { champIcon, getChampions, getLeagueEntries, getTopMasteries, isPlatform, profileIcon, PLATFORMS, type LeagueEntryDto, type MasteryDto } from "@/lib/riot";
import { getKickChannels, getTwitchChannels, type ChannelStatus } from "@/lib/streams";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getPlayer(id);
  return { title: p ? `${p.user.name} – Inhouse Arena` : "Hráč nenalezen" };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const [player, session, champs, avg] = await Promise.all([getPlayer(id), getSession(), getChampions(), getCommunityAverages()]);
  if (!player) notFound();

  const { user: u, stats, inhouseChamps, mmrHistory, streak, position, totalPlayers } = player;
  const riot = u.riotAccount ?? null;
  const isMe = session?.user.id === u.id;

  // Riot data – když selžou (chybí klíč, limit…), profil se zobrazí i tak
  let solo: LeagueEntryDto | undefined, flex: LeagueEntryDto | undefined, masteries: MasteryDto[] = [], riotError: string | null = null;
  if (riot && isPlatform(riot.platform)) {
    try {
      const [entries, mast] = await Promise.all([getLeagueEntries(riot.puuid, riot.platform), getTopMasteries(riot.puuid, riot.platform, 6)]);
      solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
      flex = entries.find((e) => e.queueType === "RANKED_FLEX_SR");
      masteries = mast;
    } catch (e) {
      riotError = e instanceof Error ? e.message : "Riot API nedostupné";
    }
  }

  // Streamy
  const channels: ChannelStatus[] = [
    ...(player.twitch ? await getTwitchChannels([player.twitch.accountId]) : []),
    ...(player.kick ? await getKickChannels([player.kick.accountId]) : []),
  ];
  const live = channels.find((c) => c.live);

  const matches = await getMatches({ userId: u.id, limit: 15 });
  const champName = (cid: string) => champs.byId.get(cid)?.name ?? cid;
  const mmr = u.profile?.mmr ?? 1500;
  const roleTotal = stats.games || 1;

  // Sedm hlavních statistik + porovnání s průměrem komunity
  const STATS: { label: string; value: number; avg: number; format: (n: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "KDA", value: stats.kda, avg: avg.kda, format: (n) => fmt(n, 2) },
    { label: "KILLS", value: stats.avgK, avg: avg.avgK, format: (n) => fmt(n) },
    { label: "DEATHS", value: stats.avgD, avg: avg.avgD, format: (n) => fmt(n), lowerIsBetter: true },
    { label: "ASSISTS", value: stats.avgA, avg: avg.avgA, format: (n) => fmt(n) },
    { label: "CS / MIN", value: stats.csPerMin, avg: avg.csPerMin, format: (n) => fmt(n) },
    { label: "DMG / MIN", value: stats.dmgPerMin, avg: avg.dmgPerMin, format: (n) => Math.round(n).toLocaleString("cs-CZ") },
    { label: "VISION / MIN", value: stats.visionPerMin, avg: avg.visionPerMin, format: (n) => fmt(n, 2) },
  ];

  return (
    <section className="view">
      {/* ── Hlavička ── */}
      <div className="p-head">
        <Art seed={hashSeed(u.id)} hues={[262, 172, 220]} />
        <div className="p-head-body">
          {u.image ? (
            <img className="p-avatar" src={u.image} alt="" />
          ) : (
            <div className="p-avatar" style={{ background: colorFor(u.name) }}>{initials(u.name)}</div>
          )}
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>PROFIL HRÁČE{position ? ` · #${position} Z ${totalPlayers}` : ""}</div>
            <div className="p-name">{u.name}</div>
            <div className="p-sub">
              {riot ? (
                <span className="riot">
                  {riot.profileIconId != null && <img src={profileIcon(champs.version, riot.profileIconId)} alt="" />}
                  {riot.gameName}<span style={{ color: "var(--muted)", fontWeight: 500 }}>#{riot.tagLine}</span>
                  <span className="tag grey">{PLATFORMS[riot.platform as keyof typeof PLATFORMS]?.label}</span>
                </span>
              ) : (
                <span style={{ color: "var(--muted)" }}>LoL účet nepropojen</span>
              )}
              <RoleIcon role={u.profile?.mainRole} variant="chip" primary size={18} />
              <RoleIcon role={u.profile?.secondaryRole} variant="chip" size={18} />
            </div>
            <div className="p-links">
              {live && <a className="live-pill on" href={live.url} target="_blank" rel="noreferrer">LIVE NA {live.platform.toUpperCase()}</a>}
              {channels.map((c) => (
                <a key={c.platform} className={`plat ${c.platform}`} href={c.url} target="_blank" rel="noreferrer" style={{ height: 30, padding: "0 12px" }}>
                  <Icon name={c.platform} style={{ width: 14, height: 14 }} />{c.displayName}
                </a>
              ))}
              {isMe && <Link className="btn btn-outline btn-sm" href="/profil"><Icon name="settings" />Upravit propojení</Link>}
            </div>
          </div>
          <div className="p-head-right">
            <div className="p-kpi"><div className="k">INHOUSE MMR</div><div className="v">{mmr}</div><div className="s">{mmr >= 1500 ? "+" : ""}{mmr - 1500} od startu</div></div>
            <div className="p-kpi"><div className="k">WINRATE</div><div className="v">{stats.winrate} %</div><div className="s">{stats.wins}V / {stats.losses}P</div></div>
            <div className="p-kpi"><div className="k">ZÁPASY</div><div className="v">{stats.games}</div><div className="s">Sezóna 1</div></div>
          </div>
        </div>
      </div>

      {stats.statGames > 0 && (
        <div className="card" style={{ marginTop: 24, overflow: "hidden" }}>
          <div className="pstats">
            {STATS.map((st) => {
              const diff = st.avg ? ((st.value - st.avg) / st.avg) * 100 : 0;
              const good = st.lowerIsBetter ? diff < 0 : diff > 0;
              const cls = Math.abs(diff) < 3 ? "" : good ? "up" : "down";
              return (
                <div className="pstat" key={st.label}>
                  <div className="k">{st.label}</div>
                  <div className="v">{st.format(st.value)}</div>
                  <div className={`cmp ${cls}`} title={`Průměr komunity: ${st.format(st.avg)}`}>
                    {Math.abs(diff) < 3 ? "≈ průměr" : `${diff > 0 ? "+" : "−"}${Math.abs(Math.round(diff))} % vs. průměr`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-grid">
        {/* ── Levý sloupec ── */}
        <div className="p-col">
          <div className="grid g4">
            <div className="card stat"><div className="k">POZICE</div><div className="v">{position ? `#${position}` : "—"}</div><div className="s">z {totalPlayers} hráčů</div></div>
            <div className="card stat"><div className="k">SÉRIE</div><div className="v" style={{ color: streak ? (streak.won ? "var(--win)" : "var(--loss)") : undefined }}>{streak ? `${streak.count}${streak.won ? "V" : "P"}` : "—"}</div><div className="s">{streak ? (streak.won ? "výher v řadě" : "proher v řadě") : "Zatím bez zápasu"}</div></div>
            <div className="card stat"><div className="k">HLAVNÍ ROLE</div>{stats.mainRole ? <div className="big-role"><RoleIcon role={stats.mainRole} size={38} primary /><span className="t">{ROLE_CS[stats.mainRole]}</span></div> : <div className="v">—</div>}<div className="s">nejčastěji hraná</div></div>
            <div className="card stat"><div className="k">ŠAMPIONŮ</div><div className="v">{inhouseChamps.length}</div><div className="s">odehráno v inhouse</div></div>
          </div>

          <div className="card panel">
            <div className="panel-head"><h3>Vývoj MMR</h3><small>posledních {mmrHistory.length} zápasů</small></div>
            <MmrChart values={mmrHistory} />
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <div className="panel-head" style={{ padding: "22px 24px 4px" }}><h3>Historie zápasů</h3><small>inhouse</small></div>
            {matches.length === 0 ? (
              <div className="empty"><b>Zatím žádný zápas</b>Až si zahraješ první inhouse, objeví se tady.</div>
            ) : (
              matches.map((m) => {
                const me = m.players.find((p) => p.userId === u.id)!;
                const won = me.team === m.winner;
                const mates = m.players.filter((p) => p.team === me.team && p.userId !== u.id);
                const enemies = m.players.filter((p) => p.team !== me.team);
                return (
                  <div className={`mrow ${won ? "win" : "loss"}`} key={m.id}>
                    <span className="side" />
                    {me.hasStats ? <img src={champIcon(champs.version, me.champion)} alt={champName(me.champion)} /> : <span className="champ-ph" style={{ display: "grid", placeItems: "center", width: 52, height: 52 }}><RoleIcon role={me.role} size={24} /></span>}
                    <div>
                      <div className="res">{won ? "Výhra" : "Prohra"}{me.hasStats ? ` · ${champName(me.champion)}` : ""}</div>
                      <div className="meta"><RoleIcon role={me.role} size={13} /> {when(m.playedAt)} · {duration(m.durationSec)}</div>
                    </div>
                    {!me.hasStats ? <div className="kda"><div>Bez statistik</div><div className="extra">replay nebyl nahrán</div></div> : <div className="kda">
                      <b>{me.kills} / <span style={{ color: "var(--loss)" }}>{me.deaths}</span> / {me.assists}</b>
                      <div>{fmt(me.deaths ? (me.kills + me.assists) / me.deaths : me.kills + me.assists, 2)} KDA</div>
                      <div className="extra">{fmt(me.cs / (m.durationSec / 60))} CS/min · {Math.round(me.damage / (m.durationSec / 60))} DMG/min · {fmt(me.vision / (m.durationSec / 60), 2)} VIS/min</div>
                    </div>}
                    <div>
                      <div className="mates">{mates.map((p) => <Link key={p.id} href={`/hrac/${p.userId}`} title={p.user.name}>{p.hasStats ? <img src={champIcon(champs.version, p.champion)} alt="" /> : <Avatar name={p.user.name} image={p.user.image} size="sm" className="mini" />}</Link>)}</div>
                      <div className="mates" style={{ marginTop: 4, opacity: 0.55 }}>{enemies.map((p) => <Link key={p.id} href={`/hrac/${p.userId}`} title={p.user.name}>{p.hasStats ? <img src={champIcon(champs.version, p.champion)} alt="" /> : <Avatar name={p.user.name} image={p.user.image} size="sm" className="mini" />}</Link>)}</div>
                    </div>
                    <div className="elo">{me.mmrChange > 0 ? "+" : ""}{me.mmrChange}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Pravý sloupec ── */}
        <div className="p-col">
          <div className="card panel">
            <div className="panel-head"><h3>League of Legends rank</h3>{riot && <small>{PLATFORMS[riot.platform as keyof typeof PLATFORMS]?.label}</small>}</div>
            {!riot ? (
              <div className="unranked">{isMe ? <>Propoj svůj LoL účet v <Link href="/profil" style={{ color: "var(--accent)" }}>nastavení</Link> a zobrazí se tu tvůj rank.</> : "Hráč zatím nepropojil LoL účet."}</div>
            ) : riotError ? (
              <div className="msg err">{riotError}</div>
            ) : (
              <>
                <RankBlock title="SOLO / DUO" entry={solo} />
                <div className="rank-split"><RankBlock title="FLEX 5V5" entry={flex} /></div>
              </>
            )}
          </div>

          <div className="card panel">
            <div className="panel-head"><h3>Champion pool</h3><small>inhouse</small></div>
            {inhouseChamps.length === 0 ? (
              <div className="unranked">Zatím žádné odehrané hry.</div>
            ) : (
              inhouseChamps.slice(0, 6).map((c) => (
                <div className="champ-row" key={c.champion}>
                  <img src={champIcon(champs.version, c.champion)} alt="" />
                  <div><div className="nm">{champName(c.champion)}</div><div className="sb">{c.games} {c.games === 1 ? "hra" : c.games < 5 ? "hry" : "her"} · {fmt(c.kda, 2)} KDA · {fmt(c.csPerMin)} CS/min</div></div>
                  <div className="rt"><b className={c.winrate >= 50 ? "wr-good" : "wr-bad"}>{c.winrate} %</b><div>{c.wins}V {c.games - c.wins}P</div></div>
                </div>
              ))
            )}
          </div>

          {riot && masteries.length > 0 && (
            <div className="card panel">
              <div className="panel-head"><h3>Nejvyšší mastery</h3><small>z Riot API</small></div>
              {masteries.map((m) => {
                const c = champs.byKey.get(String(m.championId));
                return (
                  <div className="champ-row" key={m.championId}>
                    {c ? <img src={champIcon(champs.version, c.id)} alt="" /> : <div className="champ-ph" />}
                    <div><div className="nm">{c?.name ?? `#${m.championId}`}</div><div className="sb">naposledy {when(new Date(m.lastPlayTime))}</div></div>
                    <div className="rt"><b>{m.championPoints.toLocaleString("cs-CZ")}</b><div><span className="mastery-lv">{m.championLevel}</span></div></div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card panel">
            <div className="panel-head"><h3>Odehrané role</h3></div>
            <div className="roles-bar">
              {(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const).map((r) => {
                const n = stats.roleCount.get(r) ?? 0;
                return (
                  <div className="r" key={r}>
                    <span className="rname"><RoleIcon role={r} size={20} /></span>
                    <span className="track"><i style={{ width: `${(n / roleTotal) * 100}%` }} /></span>
                    <span>{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
