import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Art, hashSeed } from "@/components/Art";
import { Icon } from "@/components/Icon";
import { getStreamerAccounts } from "@/lib/data";
import { getKickChannels, getTwitchChannels } from "@/lib/streams";

export const dynamic = "force-dynamic";

export default async function Streams({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p = "all" } = await searchParams;
  const accounts = await getStreamerAccounts();
  const [twitch, kick] = await Promise.all([
    getTwitchChannels(accounts.filter((a) => a.providerId === "twitch").map((a) => a.accountId)),
    getKickChannels(accounts.filter((a) => a.providerId === "kick").map((a) => a.accountId)),
  ]);

  const owner = (platform: string, id: string) => accounts.find((a) => a.providerId === platform && a.accountId === id);
  const all = [...twitch, ...kick]
    .map((c) => ({ ...c, player: owner(c.platform, c.accountId) }))
    .filter((c) => p === "all" || c.platform === p);
  const live = all.filter((c) => c.live).sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0));
  const offline = all.filter((c) => !c.live);

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">ŽIVĚ Z KOMUNITY</div>
          <h1>Streamy<span className="dot">.</span></h1>
          <div className="lead">Hráči, kteří si propojili Twitch nebo Kick, se tu ukážou, jakmile jsou online.</div>
        </div>
        <div className="chips">
          {[["all", "Vše"], ["twitch", "Twitch"], ["kick", "Kick"]].map(([v, l]) => (
            <Link key={v} href={v === "all" ? "/streamy" : `/streamy?p=${v}`} className={`chip ${p === v ? "on" : ""}`}>{l}</Link>
          ))}
        </div>
      </div>

      {live.length === 0 ? (
        <div className="card empty"><b>Právě nikdo nestreamuje</b>{accounts.length ? "Jakmile někdo z propojených streamerů půjde live, objeví se tady." : "Zatím si nikdo nepropojil Twitch ani Kick."}</div>
      ) : (
        <div className="grid g3">
          {live.map((c) => (
            <a className="card stream" href={c.url} target="_blank" rel="noreferrer" key={c.platform + c.accountId}>
              <div className="thumb">
                {c.thumbnail ? <img className="art" src={c.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Art seed={hashSeed(c.accountId)} hues={[262, 200, 300]} />}
                <span className="live">LIVE</span>
                <span className={`plat ${c.platform}`}>{c.platform.toUpperCase()}</span>
                <span className="viewers"><Icon name="eye" />{c.viewers ?? 0} diváků</span>
                <div className="play"><span><Icon name="play" /></span></div>
              </div>
              <div className="stream-body">
                <Avatar name={c.player?.name ?? c.displayName} image={c.player?.image ?? c.avatar} size="sm" />
                <div><div className="t">{c.title}</div><div className="n">{c.player?.name ?? c.displayName} · {c.displayName}</div></div>
              </div>
            </a>
          ))}
        </div>
      )}

      {offline.length > 0 && (
        <div className="section">
          <div className="section-head"><div><h2>Offline<span className="dot">.</span></h2><div className="lead">Propojení streameři, kteří teď nevysílají.</div></div></div>
          <div className="card">
            {offline.map((c, i) => (
              <div className="offline-row" key={c.platform + c.accountId} style={i < offline.length - 1 ? { borderBottom: "1px solid var(--line)" } : undefined}>
                <Avatar name={c.player?.name ?? c.displayName} image={c.player?.image ?? c.avatar} size="sm" />
                <div>
                  <Link href={`/hrac/${c.player?.userId}`} className="n">{c.player?.name}</Link>
                  <small style={{ display: "block" }}>{c.url.replace("https://", "")}</small>
                </div>
                <span className={`plat ${c.platform}`}>{c.platform.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="card connect">
          <div>
            <h3>Streamuješ? Propoj svůj kanál.</h3>
            <p>Po propojení Twitch nebo Kick účtu se tvůj stream automaticky zobrazí tady, kdykoliv půjdeš live.</p>
          </div>
          <div className="acts">
            <Link className="btn btn-outline" href="/profil"><Icon name="twitch" style={{ color: "var(--twitch)" }} />Propojit Twitch</Link>
            <Link className="btn btn-outline" href="/profil"><Icon name="kick" style={{ color: "var(--kick)" }} />Propojit Kick</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
