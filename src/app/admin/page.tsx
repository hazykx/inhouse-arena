import Link from "next/link";
import { and, desc, eq, gt, inArray, isNull, like, not, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminLog, lfgPost, match, matchPlayer, profile, queueEntry, report, riotAccount, sanction, season, seasonResult, tournament, user } from "@/db/schema";
import { currentSeason } from "@/lib/season";
import { primaryAccounts } from "@/lib/riotAccounts";
import { duration, when } from "@/lib/format";
import { AdminTestPanel } from "./AdminTestPanel";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RoleIcon } from "@/components/RoleIcon";
import { DeleteButton } from "@/components/DeleteButton";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { DURATIONS, isQueueEnabled } from "@/lib/moderation";
import { listActiveLobbies } from "@/lib/queue";
import { tourStatus, dateRange } from "@/lib/tournament";
import { ago } from "@/lib/format";
import {
  adjustMmr, approveTournamentAdmin, cancelLobby, deleteMatch, deletePost, deleteTournamentAdmin, featureTournamentAdmin, kickFromQueue,
  newSeason, resetQueueAction, resolveLobby, resolveReport, revokeSanctionAction, sanctionPlayer, setQueueEnabled,
} from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "fronta", label: "Fronta" },
  { key: "hraci", label: "Hráči" },
  { key: "zapasy", label: "Zápasy" },
  { key: "reporty", label: "Reporty" },
  { key: "turnaje", label: "Turnaje" },
  { key: "inzeraty", label: "Inzeráty" },
  { key: "sezona", label: "Sezóna" },
  { key: "test", label: "Testování" },
  { key: "log", label: "Log" },
] as const;

const STATUS_CS: Record<string, string> = { READY_CHECK: "Ready check", CHOICE: "Los mincí", SIDE: "Volba strany", DRAFT: "Draft", IN_GAME: "Hraje se", CONFIRM: "Čeká na potvrzení" };
const fmtDate = (d: Date) => d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = "fronta", q = "" } = await searchParams;
  const session = await getSession();
  if (!session || !(await isAdmin(session.user.id))) {
    return (
      <section className="view">
        <div className="card empty" style={{ padding: 56 }}>
          <b>Sem mají přístup jen admini</b>
          Admina nastavíš v proměnné <code>ADMIN_DISCORD_IDS</code> (Discord ID oddělená čárkou).
        </div>
      </section>
    );
  }

  const pendingCount = (await db.select({ n: sql<number>`count(*)` }).from(tournament).where(eq(tournament.approved, false)))[0].n;
  const openReports = (await db.select({ n: sql<number>`count(*)` }).from(report).where(eq(report.status, "OPEN")))[0].n;

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">ADMINISTRACE</div>
          <h1>Admin panel<span className="dot">.</span></h1>
          <div className="lead">Správa fronty, hráčů, inzerátů a turnajů.</div>
        </div>
      </div>

      <div className="tabs" style={{ overflowX: "auto" }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin?tab=${t.key}`} className={tab === t.key ? "on" : ""}>
            {t.label}
            {t.key === "turnaje" && pendingCount > 0 && <span className="tag amber" style={{ marginLeft: 8, height: 20 }}>{pendingCount}</span>}
            {t.key === "reporty" && openReports > 0 && <span className="tag red" style={{ marginLeft: 8, height: 20 }}>{openReports}</span>}
          </Link>
        ))}
      </div>

      {tab === "fronta" && <QueueTab />}
      {tab === "hraci" && <PlayersTab q={q} />}
      {tab === "inzeraty" && <PostsTab />}
      {tab === "turnaje" && <TournamentsTab />}
      {tab === "zapasy" && <MatchesTab />}
      {tab === "reporty" && <ReportsTab />}
      {tab === "sezona" && <SeasonTab />}
      {tab === "test" && <AdminTestPanel />}
      {tab === "log" && <LogTab />}
    </section>
  );
}

/* ═════════════ Fronta ═════════════ */

async function QueueTab() {
  const enabled = await isQueueEnabled();
  const lobbies = await listActiveLobbies();
  const queued = await db
    .select({ userId: queueEntry.userId, role: queueEntry.role, joinedAt: queueEntry.joinedAt, name: user.name, image: user.image })
    .from(queueEntry).innerJoin(user, eq(user.id, queueEntry.userId)).orderBy(queueEntry.joinedAt);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card panel">
        <div className="panel-head">
          <h3>Stav fronty</h3>
          <span className={`tag ${enabled ? "green" : "red"}`}>{enabled ? "ZAPNUTÁ" : "VYPNUTÁ"}</span>
        </div>
        <p className="lead" style={{ marginTop: 0 }}>Vypnutá fronta nepustí nikoho nového a hned ji vyprázdní. Rozehrané hry doběhnou. Reset vyprázdní frontu a zruší i všechny rozehrané hry.</p>
        <div className="conn-actions" style={{ marginTop: 16 }}>
          <form action={setQueueEnabled.bind(null, !enabled)}>
            <button className={`btn ${enabled ? "btn-outline" : "btn-primary"}`}><Icon name={enabled ? "x" : "play"} />{enabled ? "Vypnout frontu" : "Zapnout frontu"}</button>
          </form>
          <DeleteButton action={resetQueueAction} label="Resetovat frontu a zrušit hry" />
        </div>
      </div>

      <div className="card panel">
        <div className="panel-head"><h3>Ve frontě</h3><small>{queued.length} hráčů</small></div>
        {queued.length === 0 ? <div className="unranked">Fronta je prázdná.</div> : queued.map((p) => (
          <div className="adm-row" key={p.userId}>
            <RoleIcon role={p.role} size={18} />
            <Avatar name={p.name} image={p.image} size="sm" />
            <Link href={`/hrac/${p.userId}`}><b>{p.name}</b></Link>
            <small>{ago(p.joinedAt)}</small>
            <form action={kickFromQueue.bind(null, p.userId)} style={{ marginLeft: "auto" }}><button className="btn btn-ghost btn-sm"><Icon name="x" />Vyhodit</button></form>
          </div>
        ))}
      </div>

      <div className="card panel">
        <div className="panel-head"><h3>Rozehrané hry</h3><small>{lobbies.length}</small></div>
        {lobbies.length === 0 ? <div className="unranked">Žádné rozehrané hry.</div> : lobbies.map((l) => (
          <div className="adm-row" key={l.id}>
            <b>Hra #{l.id}</b>
            <span className={`tag ${l.disputed ? "red" : "grey"}`}>{l.disputed ? "SPOR" : STATUS_CS[l.status] ?? l.status}</span>
            <small style={{ flex: 1 }}>{l.players.join(", ")}</small>
            {(l.status === "IN_GAME" || l.status === "CONFIRM") && (
              <>
                <form action={resolveLobby.bind(null, l.id, "BLUE")}><button className="btn btn-ghost btn-sm">Vyhrál BLUE</button></form>
                <form action={resolveLobby.bind(null, l.id, "RED")}><button className="btn btn-ghost btn-sm">Vyhrál RED</button></form>
              </>
            )}
            <DeleteButton action={cancelLobby.bind(null, l.id)} label="Zrušit" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════ Hráči ═════════════ */

async function PlayersTab({ q }: { q: string }) {
  const now = new Date();
  const players = await db
    .select({ id: user.id, name: user.name, image: user.image, createdAt: user.createdAt, mmr: profile.mmr, mainRole: profile.mainRole })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(
      not(like(user.id, "demo-%")),
      q ? or(like(user.name, `%${q}%`), inArray(user.id, db.select({ id: riotAccount.userId }).from(riotAccount).where(like(riotAccount.gameName, `%${q}%`)))) : undefined,
    ))
    .orderBy(desc(user.createdAt))
    .limit(50);
  const riotOf = await primaryAccounts(players.map((p) => p.id));

  const games = await db.select({ userId: matchPlayer.userId, n: sql<number>`count(*)` }).from(matchPlayer).groupBy(matchPlayer.userId);
  const gamesOf = new Map(games.map((g) => [g.userId, g.n]));
  const active = await db.select().from(sanction).where(and(isNull(sanction.revokedAt), or(isNull(sanction.until), gt(sanction.until, now))));
  const history = await db
    .select({ s: sanction, name: user.name })
    .from(sanction).innerJoin(user, eq(user.id, sanction.userId))
    .orderBy(desc(sanction.createdAt)).limit(25);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <form className="toolbar" action="/admin">
        <input type="hidden" name="tab" value="hraci" />
        <label className="search"><Icon name="search" /><input name="q" defaultValue={q} placeholder="Hledat podle jména nebo Riot ID…" /></label>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        {players.length === 0 ? <div className="empty">Žádní hráči.</div> : players.map((p) => {
          const sanctions = active.filter((s) => s.userId === p.id);
          return (
            <details className="adm-player" key={p.id}>
              <summary>
                <Avatar name={p.name} image={p.image} size="sm" />
                <div className="who"><div><b>{p.name}</b><small>{riotOf.get(p.id) ? `${riotOf.get(p.id)!.gameName}#${riotOf.get(p.id)!.tagLine}` : "LoL nepropojen"}</small></div></div>
                <RoleIcon role={p.mainRole} size={16} />
                <span className="adm-meta">{p.mmr ?? 1500} MMR · {gamesOf.get(p.id) ?? 0} zápasů</span>
                {sanctions.map((s) => (
                  <span key={s.id} className={`tag ${s.type === "BAN" ? "red" : "amber"}`}>{s.type === "BAN" ? "BAN" : "PAUZA"} {s.until ? `do ${fmtDate(s.until)}` : "NATRVALO"}</span>
                ))}
                <span className="adm-open">Spravovat <Icon name="chevdown" /></span>
              </summary>
              <div className="adm-player-body">
                <form action={sanctionPlayer.bind(null, p.id)} className="form-row">
                  <div className="field" style={{ flex: "none" }}>
                    <label>TREST</label>
                    <select className="select" name="type" defaultValue="QUEUE">
                      <option value="QUEUE">Pauza ve frontě</option>
                      <option value="BAN">Ban (fronta, inzeráty, turnaje)</option>
                    </select>
                  </div>
                  <div className="field" style={{ flex: "none" }}>
                    <label>DÉLKA</label>
                    <select className="select" name="duration" defaultValue="24h">
                      {Object.entries(DURATIONS).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>DŮVOD (UVIDÍ HO HRÁČ)</label>
                    <input className="input" name="reason" maxLength={200} placeholder="např. opakovaně nepřijatý ready check" />
                  </div>
                  <button className="btn btn-danger">Udělit trest</button>
                </form>
                {sanctions.length > 0 && (
                  <div className="conn-actions" style={{ marginTop: 14 }}>
                    {sanctions.map((s) => (
                      <form key={s.id} action={revokeSanctionAction.bind(null, s.id, p.id)}>
                        <button className="btn btn-outline btn-sm"><Icon name="check" />Zrušit {s.type === "BAN" ? "ban" : "pauzu"}</button>
                      </form>
                    ))}
                  </div>
                )}
                <form action={adjustMmr.bind(null, p.id)} className="form-row" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <div className="field" style={{ flex: "none", width: 140 }}>
                    <label>MMR (TEĎ {p.mmr ?? 1500})</label>
                    <input className="input" type="number" name="mmr" defaultValue={p.mmr ?? 1500} min={0} max={5000} />
                  </div>
                  <div className="field">
                    <label>DŮVOD ÚPRAVY</label>
                    <input className="input" name="reason" maxLength={200} placeholder="např. kompenzace za chybně zadaný zápas" />
                  </div>
                  <button className="btn btn-outline">Nastavit MMR</button>
                </form>
                <div style={{ marginTop: 12 }}><Link className="link-arrow" href={`/hrac/${p.id}`}>Profil hráče<Icon name="arrow" /></Link></div>
              </div>
            </details>
          );
        })}
      </div>

      <div className="card panel">
        <div className="panel-head"><h3>Historie trestů</h3><small>posledních 25</small></div>
        {history.length === 0 ? <div className="unranked">Zatím žádné tresty.</div> : history.map(({ s, name }) => {
          const isActive = !s.revokedAt && (!s.until || s.until > now);
          return (
            <div className="adm-row" key={s.id}>
              <span className={`tag ${s.type === "BAN" ? "red" : "amber"}`}>{s.type === "BAN" ? "BAN" : "PAUZA"}</span>
              <b>{name}</b>
              <small style={{ flex: 1 }}>{s.reason ?? "bez důvodu"} · udělen {fmtDate(s.createdAt)} · {s.until ? `do ${fmtDate(s.until)}` : "natrvalo"}</small>
              <span className={`tag ${isActive ? "green" : "grey"}`}>{s.revokedAt ? "ZRUŠEN" : isActive ? "AKTIVNÍ" : "VYPRŠEL"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════ Inzeráty ═════════════ */

async function PostsTab() {
  const posts = await db.query.lfgPost.findMany({ orderBy: desc(lfgPost.createdAt), with: { user: { columns: { id: true, name: true, image: true } } } });
  return (
    <div className="card panel">
      <div className="panel-head"><h3>Všechny inzeráty</h3><small>{posts.length}</small></div>
      {posts.length === 0 ? <div className="unranked">Žádné inzeráty.</div> : posts.map((p) => (
        <div className="adm-row" key={p.id} style={{ alignItems: "flex-start" }}>
          <Avatar name={p.user.name} image={p.user.image} size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>{p.kind === "TEAM" ? p.teamName : p.user.name}</b>
              <span className="tag grey">{p.kind === "TEAM" ? "TÝM HLEDÁ" : "HRÁČ HLEDÁ"}</span>
              {p.roles.map((r) => <RoleIcon key={r} role={r} size={15} />)}
              <small style={{ color: "var(--muted)" }}>{p.kind === "TEAM" ? `přidal ${p.user.name} · ` : ""}{ago(p.createdAt)}</small>
            </div>
            <p style={{ color: "#C9C8D2", fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{p.text}</p>
          </div>
          <DeleteButton action={deletePost.bind(null, p.id)} />
        </div>
      ))}
    </div>
  );
}

/* ═════════════ Turnaje ═════════════ */

async function TournamentsTab() {
  const rows = await db.query.tournament.findMany({ orderBy: desc(tournament.createdAt), with: { user: { columns: { name: true } } } });
  const pending = rows.filter((t) => !t.approved);
  const approved = rows.filter((t) => t.approved);

  const row = (t: (typeof rows)[number]) => (
    <div className="adm-row" key={t.id} style={{ alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b>{t.name}</b><span className="tag grey">{t.kind}</span>
          {t.approved && <span className={`tag ${tourStatus(t).color}`}>{tourStatus(t).label}</span>}
          {t.featured && <span className="tag amber">★ DOPORUČENO</span>}
        </div>
        <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
          {t.organizer} · {dateRange(t)} · {t.format} · přidal {t.user.name} {ago(t.createdAt)}
          {t.url && <> · <a href={t.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>odkaz</a></>}
        </small>
        {t.description && <p style={{ color: "#C9C8D2", fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{t.description}</p>}
      </div>
      {!t.approved && <form action={approveTournamentAdmin.bind(null, t.id)}><button className="btn btn-primary btn-sm"><Icon name="check" />Schválit</button></form>}
      {t.approved && <form action={featureTournamentAdmin.bind(null, t.id, !t.featured)}><button className="btn btn-ghost btn-sm">{t.featured ? "★ Zrušit doporučení" : "☆ Doporučit"}</button></form>}
      <DeleteButton action={deleteTournamentAdmin.bind(null, t.id)} label={t.approved ? "Smazat" : "Zamítnout"} />
    </div>
  );

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card panel">
        <div className="panel-head"><h3>Čeká na schválení</h3><small>{pending.length}</small></div>
        {pending.length === 0 ? <div className="unranked">Nic nečeká na schválení.</div> : pending.map(row)}
      </div>
      <div className="card panel">
        <div className="panel-head"><h3>Schválené turnaje</h3><small>{approved.length}</small></div>
        {approved.length === 0 ? <div className="unranked">Zatím žádné.</div> : approved.map(row)}
      </div>
    </div>
  );
}

/* ═════════════ Zápasy ═════════════ */

async function MatchesTab() {
  const s = await currentSeason();
  const matches = await db.query.match.findMany({
    where: eq(match.seasonId, s.id),
    orderBy: desc(match.playedAt),
    limit: 50,
    with: { players: { with: { user: { columns: { name: true } } } } },
  });
  return (
    <div className="card panel">
      <div className="panel-head"><h3>Zápasy – {s.name}</h3><small>posledních {matches.length}</small></div>
      <p className="lead" style={{ marginTop: 0, marginBottom: 8 }}>Změna vítěze nebo smazání zápasu přepočítá MMR celé sezóny.</p>
      {matches.length === 0 ? <div className="unranked">Zatím žádné zápasy.</div> : matches.map((m) => {
        const blue = m.players.filter((p) => p.team === "BLUE").map((p) => p.user.name).join(", ");
        const red = m.players.filter((p) => p.team === "RED").map((p) => p.user.name).join(", ");
        return (
          <div className="adm-row" key={m.id}>
            <b>#{m.id}</b>
            <span className={`tag ${m.winner === "BLUE" ? "" : "red"}`} style={m.winner === "BLUE" ? { background: "rgba(91,143,240,.15)", color: "#7FB2FF" } : undefined}>VYHRÁL {m.winner}</span>
            <small style={{ flex: 1, minWidth: 260 }}><span style={{ color: "#7FB2FF" }}>{blue}</span> vs <span style={{ color: "var(--loss)" }}>{red}</span><br />{when(m.playedAt)} · {duration(m.durationSec)}{m.players.some((p) => !p.hasStats) ? " · bez statistik" : ""}</small>
            <Link className="btn btn-outline btn-sm" href={`/admin/zapas/${m.id}`}><Icon name="settings" />Upravit</Link>
            <DeleteButton action={deleteMatch.bind(null, m.id)} />
          </div>
        );
      })}
    </div>
  );
}

/* ═════════════ Reporty ═════════════ */

async function ReportsTab() {
  const rows = await db.select().from(report).orderBy(desc(report.createdAt)).limit(100);
  const ids = [...new Set(rows.flatMap((r) => [r.reporterId, r.targetId, r.resolvedBy].filter(Boolean) as string[]))];
  const users = ids.length ? await db.select({ id: user.id, name: user.name, image: user.image }).from(user).where(inArray(user.id, ids)) : [];
  const u = new Map(users.map((x) => [x.id, x]));
  const open = rows.filter((r) => r.status === "OPEN");
  const closed = rows.filter((r) => r.status !== "OPEN");
  const card = (r: (typeof rows)[number]) => {
    const t = u.get(r.targetId);
    return (
      <div className="adm-row" key={r.id} style={{ alignItems: "flex-start" }}>
        <Avatar name={t?.name ?? "?"} image={t?.image} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href={`/hrac/${r.targetId}`}><b>{t?.name ?? "?"}</b></Link>
            <span className="tag red">{r.category}</span>
            {r.matchId && <span className="tag grey">ZÁPAS #{r.matchId}</span>}
            <small style={{ color: "var(--muted)" }}>nahlásil {u.get(r.reporterId)?.name ?? "?"} · {ago(r.createdAt)}</small>
          </div>
          <p style={{ color: "#C9C8D2", fontSize: 13.5, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-line" }}>{r.text}</p>
          {r.status !== "OPEN" && <small style={{ color: "var(--dim)" }}>{r.status === "RESOLVED" ? "Vyřešeno" : "Zamítnuto"} ({u.get(r.resolvedBy ?? "")?.name ?? "admin"}){r.note ? `: ${r.note}` : ""}</small>}
          {r.status === "OPEN" && (
            <form action={resolveReport.bind(null, r.id, "RESOLVED")} className="form-row" style={{ marginTop: 10 }}>
              <input className="input" name="note" placeholder="Poznámka (nepovinné), např. uděleno 24 h pauza" style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm"><Icon name="check" />Vyřešeno</button>
              <Link className="btn btn-outline btn-sm" href={`/admin?tab=hraci&q=${encodeURIComponent(t?.name ?? "")}`}>Udělit trest</Link>
            </form>
          )}
        </div>
        {r.status === "OPEN" && <form action={resolveReport.bind(null, r.id, "REJECTED")}><button className="btn btn-ghost btn-sm"><Icon name="x" />Zamítnout</button></form>}
      </div>
    );
  };
  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card panel">
        <div className="panel-head"><h3>Otevřená nahlášení</h3><small>{open.length}</small></div>
        {open.length === 0 ? <div className="unranked">Nic k řešení.</div> : open.map(card)}
      </div>
      <div className="card panel">
        <div className="panel-head"><h3>Vyřešená</h3><small>{closed.length}</small></div>
        {closed.length === 0 ? <div className="unranked">Zatím žádná.</div> : closed.map(card)}
      </div>
    </div>
  );
}

/* ═════════════ Sezóna ═════════════ */

async function SeasonTab() {
  const cur = await currentSeason();
  const games = (await db.select({ n: sql<number>`count(*)` }).from(match).where(eq(match.seasonId, cur.id)))[0].n;
  const past = await db.select().from(season).where(not(isNull(season.endedAt))).orderBy(desc(season.id));
  const results = past.length ? await db.select({ r: seasonResult, name: user.name }).from(seasonResult).innerJoin(user, eq(user.id, seasonResult.userId)).where(inArray(seasonResult.seasonId, past.map((p) => p.id))) : [];
  const fmt = (d: Date) => d.getTime() === 0 ? "od začátku" : d.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card panel">
        <div className="panel-head"><h3>Aktuální sezóna: {cur.name}</h3><small>{fmt(cur.startedAt)} · {games} zápasů</small></div>
        <form action={newSeason} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
          <p className="lead" style={{ margin: 0 }}>Ukončení sezóny uloží konečné pořadí hráčů, zruší frontu a rozehrané hry a začne novou sezónu. Statistiky a žebříček se počítají znovu od nuly, staré zápasy zůstanou v historii.</p>
          <div className="form-row">
            <div className="field">
              <label>NÁZEV NOVÉ SEZÓNY</label>
              <input className="input" name="name" required maxLength={40} placeholder="např. Sezóna 2" />
            </div>
            <div className="field" style={{ flex: "none" }}>
              <label>RESET MMR</label>
              <div className="tag-picker">
                <label><input type="radio" name="mode" value="hard" defaultChecked /><span>Všichni na 1500</span></label>
                <label><input type="radio" name="mode" value="soft" /><span>Soft (napůl k 1500)</span></label>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="field" style={{ maxWidth: 260 }}>
              <label>PRO POTVRZENÍ NAPIŠ RESET</label>
              <input className="input" name="confirm" required placeholder="RESET" autoComplete="off" />
            </div>
            <button className="btn btn-danger">Ukončit sezónu a začít novou</button>
          </div>
        </form>
      </div>
      {past.map((p) => {
        const top = results.filter((r) => r.r.seasonId === p.id).sort((a, b) => a.r.position - b.r.position).slice(0, 10);
        return (
          <div className="card panel" key={p.id}>
            <div className="panel-head"><h3>{p.name}</h3><small>{fmt(p.startedAt)} – {p.endedAt ? fmt(p.endedAt) : ""}</small></div>
            {top.length === 0 ? <div className="unranked">Nikdo nehrál.</div> : top.map(({ r, name }) => (
              <div className="adm-row" key={r.id}><b style={{ width: 28 }}>#{r.position}</b><Link href={`/hrac/${r.userId}`}>{name}</Link><small style={{ marginLeft: "auto" }}>{r.mmr} MMR · {r.games} zápasů · {Math.round((r.wins / Math.max(1, r.games)) * 100)} % WR</small></div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ═════════════ Log ═════════════ */

async function LogTab() {
  const rows = await db.select().from(adminLog).orderBy(desc(adminLog.createdAt)).limit(150);
  const ids = [...new Set(rows.flatMap((r) => [r.adminId, r.targetUserId].filter(Boolean) as string[]))];
  const users = ids.length ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids)) : [];
  const n = new Map(users.map((x) => [x.id, x.name]));
  return (
    <div className="card panel">
      <div className="panel-head"><h3>Log admin akcí</h3><small>posledních {rows.length}</small></div>
      {rows.length === 0 ? <div className="unranked">Zatím žádné akce.</div> : rows.map((r) => (
        <div className="adm-row" key={r.id}>
          <small style={{ width: 110, flexShrink: 0 }}>{fmtDate(r.createdAt)}</small>
          <b>{r.adminId === "system" ? "Systém" : n.get(r.adminId) ?? "?"}</b>
          <span style={{ fontSize: 13.5 }}>{r.action}</span>
          {r.targetUserId && <Link href={`/hrac/${r.targetUserId}`} className="tag grey">{n.get(r.targetUserId) ?? "hráč"}</Link>}
          {r.details && <small style={{ flex: 1 }}>„{r.details}“</small>}
        </div>
      ))}
    </div>
  );
}
