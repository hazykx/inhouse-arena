import Link from "next/link";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { LFG_TAGS, lfgPost, ROLES, type Role } from "@/db/schema";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RoleIcon, RoleSvg } from "@/components/RoleIcon";
import { DeleteButton } from "@/components/DeleteButton";
import { getSession } from "@/lib/session";
import { discordIds, isAdmin } from "@/lib/admin";
import { ago, ROLE_CS } from "@/lib/format";
import { deleteLfgPost } from "./actions";

export const dynamic = "force-dynamic";

type SP = { typ?: string; role?: string; tag?: string };

export default async function LookingForTeam({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const kind = sp.typ === "tymy" ? "TEAM" : "PLAYER";
  const role = ROLES.includes(sp.role as Role) ? (sp.role as Role) : null;
  const tag = (LFG_TAGS as readonly string[]).includes(sp.tag ?? "") ? sp.tag! : null;

  const session = await getSession();
  const admin = await isAdmin(session?.user.id);
  const monthAgo = new Date(Date.now() - 30 * 86400000);

  const all = await db.query.lfgPost.findMany({
    where: and(eq(lfgPost.kind, kind), gt(lfgPost.createdAt, monthAgo)),
    orderBy: desc(lfgPost.createdAt),
    with: { user: { columns: { id: true, name: true, image: true } } },
  });
  const posts = all.filter((p) => (!role || p.roles.includes(role)) && (!tag || p.tags.includes(tag)));
  const discord = await discordIds(posts.map((p) => p.userId));

  // Odkaz s upraveným filtrem
  const href = (patch: Partial<SP>) => {
    const q = new URLSearchParams();
    const next = { typ: sp.typ, role: sp.role, tag: sp.tag, ...patch };
    Object.entries(next).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return `/hledam-tym${s ? `?${s}` : ""}`;
  };

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">SPOLUHRÁČI A TÝMY</div>
          <h1>Hledám tým<span className="dot">.</span></h1>
          <div className="lead">Najdi duo, flex parťáky nebo celý tým na turnaj. Inzeráty platí 30 dní.</div>
        </div>
        <Link className="btn btn-primary" href={`/hledam-tym/novy${kind === "TEAM" ? "?typ=tym" : ""}`}><Icon name="plus" />Přidat inzerát</Link>
      </div>

      <div className="tabs">
        <Link href={href({ typ: undefined, role: undefined, tag: undefined })} className={kind === "PLAYER" ? "on" : ""}>Hráči hledají tým</Link>
        <Link href={href({ typ: "tymy", role: undefined, tag: undefined })} className={kind === "TEAM" ? "on" : ""}>Týmy hledají hráče</Link>
      </div>

      <div className="toolbar">
        <div className="filters">
          <Link href={href({ role: undefined })} className={`chip ${!role ? "on" : ""}`}>Všechny role</Link>
          {ROLES.map((r) => (
            <Link key={r} href={href({ role: r })} className={`chip icon ${role === r ? "on" : ""}`} title={ROLE_CS[r]}><RoleSvg role={r} size={18} /></Link>
          ))}
          <span className="sep" />
          {LFG_TAGS.map((t) => (
            <Link key={t} href={href({ tag: tag === t ? undefined : t })} className={`chip ${tag === t ? "on" : ""}`}>{t}</Link>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="card empty">
          <b>{all.length ? "Žádný inzerát neodpovídá filtru" : "Zatím tu nejsou žádné inzeráty"}</b>
          {kind === "PLAYER" ? "Buď první, kdo napíše, že hledá tým." : "Hledáte do týmu hráče? Přidejte inzerát."}
        </div>
      ) : (
        <div className="grid g3">
          {posts.map((p) => {
            const mine = p.userId === session?.user.id;
            const did = discord.get(p.userId);
            const title = p.kind === "TEAM" ? p.teamName ?? "Tým" : p.user.name;
            return (
              <div className="card lfg hov" key={p.id}>
                <div className="lfg-head">
                  <Avatar name={title} image={p.kind === "PLAYER" ? p.user.image : null} />
                  <div className="who"><div><b>{title}</b><small>{p.rank ?? "Rank neuveden"}</small></div></div>
                  <div className="tags">{p.tags.map((t) => <span key={t} className="tag grey">{t}</span>)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 1.4, color: "var(--dim)", fontWeight: 700, marginBottom: 8 }}>{p.kind === "TEAM" ? "HLEDAJÍ ROLE" : "ROLE"}</div>
                  <div className="roles">{p.roles.map((r, j) => <RoleIcon key={r} role={r} variant="chip" primary={j === 0} size={18} />)}</div>
                </div>
                <p style={{ whiteSpace: "pre-line" }}>{p.text}</p>
                {p.kind === "TEAM" && (
                  <Link href={`/hrac/${p.userId}`} className="lfg-by"><Avatar name={p.user.name} image={p.user.image} size="sm" />Přidal {p.user.name}</Link>
                )}
                <div className="lfg-foot">
                  <Icon name="clock" style={{ width: 15, height: 15 }} />{ago(p.createdAt)}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {(mine || admin) && <DeleteButton action={deleteLfgPost.bind(null, p.id)} />}
                    {!mine && did && (
                      <a className="btn btn-outline btn-sm" href={`https://discord.com/users/${did}`} target="_blank" rel="noreferrer"><Icon name="msg" />Napsat na Discordu</a>
                    )}
                    {!mine && !did && <Link className="btn btn-outline btn-sm" href={`/hrac/${p.userId}`}><Icon name="user" />Profil</Link>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
