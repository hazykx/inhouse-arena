import Link from "next/link";
import { and, desc, eq, gt, isNull, like, not, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { lfgPost, matchPlayer, profile, queueEntry, riotAccount, sanction, tournament, user } from "@/db/schema";
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
  approveTournamentAdmin, cancelLobby, deletePost, deleteTournamentAdmin, featureTournamentAdmin, kickFromQueue,
  resetQueueAction, resolveLobby, revokeSanctionAction, sanctionPlayer, setQueueEnabled,
} from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "fronta", label: "Fronta" },
  { key: "hraci", label: "Hráči" },
  { key: "inzeraty", label: "Inzeráty" },
  { key: "turnaje", label: "Turnaje" },
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

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">ADMINISTRACE</div>
          <h1>Admin panel<span className="dot">.</span></h1>
          <div className="lead">Správa fronty, hráčů, inzerátů a turnajů.</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin?tab=${t.key}`} className={tab === t.key ? "on" : ""}>
            {t.label}
            {t.key === "turnaje" && pendingCount > 0 && <span className="tag amber" style={{ marginLeft: 8, height: 20 }}>{pendingCount}</span>}
          </Link>
        ))}
      </div>

      {tab === "fronta" && <QueueTab />}
      {tab === "hraci" && <PlayersTab q={q} />}
      {tab === "inzeraty" && <PostsTab />}
      {tab === "turnaje" && <TournamentsTab />}
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
    .select({ id: user.id, name: user.name, image: user.image, createdAt: user.createdAt, mmr: profile.mmr, mainRole: profile.mainRole, riotName: riotAccount.gameName, riotTag: riotAccount.tagLine })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .leftJoin(riotAccount, eq(riotAccount.userId, user.id))
    .where(and(not(like(user.id, "demo-%")), q ? or(like(user.name, `%${q}%`), like(riotAccount.gameName, `%${q}%`)) : undefined))
    .orderBy(desc(user.createdAt))
    .limit(50);

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
                <div className="who"><div><b>{p.name}</b><small>{p.riotName ? `${p.riotName}#${p.riotTag}` : "LoL nepropojen"}</small></div></div>
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
                      <form key={s.id} action={revokeSanctionAction.bind(null, s.id)}>
                        <button className="btn btn-outline btn-sm"><Icon name="check" />Zrušit {s.type === "BAN" ? "ban" : "pauzu"}</button>
                      </form>
                    ))}
                  </div>
                )}
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
