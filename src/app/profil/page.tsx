import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { Icon } from "@/components/Icon";
import { LoginButton } from "@/components/AuthButtons";
import { getSession } from "@/lib/session";
import { enabledProviders } from "@/lib/auth";
import { getDDVersion, hasRiotKey, PLATFORMS } from "@/lib/riot";
import { getKickChannels, getTwitchChannels } from "@/lib/streams";
import { RiotConnection, RolesForm, SocialConnection } from "./Connections";
import { MAX_RIOT_ACCOUNTS } from "@/lib/format";
import { primaryOf } from "@/lib/riotAccounts";

export const dynamic = "force-dynamic";

export default async function ProfileSettings() {
  const session = await getSession();
  if (!session) {
    return (
      <section className="view">
        <div className="card empty" style={{ padding: 56 }}>
          <b>Pro správu profilu se přihlas</b>
          <p style={{ margin: "6px 0 22px" }}>Přihlášení probíhá přes Discord, žádná hesla.</p>
          <div style={{ display: "flex", justifyContent: "center" }}><LoginButton /></div>
        </div>
      </section>
    );
  }

  const [me, ddVersion] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, session.user.id), with: { profile: true, riotAccounts: true, accounts: { columns: { providerId: true, accountId: true } } } }),
    getDDVersion(),
  ]);
  const twitchAcc = me?.accounts.find((a) => a.providerId === "twitch");
  const kickAcc = me?.accounts.find((a) => a.providerId === "kick");
  const [twitch] = twitchAcc ? await getTwitchChannels([twitchAcc.accountId]) : [];
  const [kick] = kickAcc ? await getKickChannels([kickAcc.accountId]) : [];
  const platforms = Object.entries(PLATFORMS).map(([value, p]) => ({ value, label: p.label }));
  const accs = me?.riotAccounts ?? [];
  const primary = primaryOf(accs);
  const riotAccounts = accs
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((a) => ({ id: a.id, gameName: a.gameName, tagLine: a.tagLine, platform: a.platform, profileIconId: a.profileIconId, summonerLevel: a.summonerLevel, primary: a.id === primary?.id }));

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">MŮJ PROFIL</div>
          <h1>Propojené účty<span className="dot">.</span></h1>
          <div className="lead">Propoj LoL účet, abychom mohli zobrazit tvůj rank a champion pool. Twitch nebo Kick ukáže tvůj stream, když jsi live.</div>
        </div>
        <Link className="btn btn-outline" href={`/hrac/${session.user.id}`}><Icon name="user" />Zobrazit můj profil</Link>
      </div>

      <div className="conn-grid">
        <div className="card conn">
          <div className="conn-top">
            <div className="conn-logo" style={{ background: "#5865F2", color: "#fff" }}><Icon name="discord" /></div>
            <div><h3>Discord</h3><small>{session.user.name}</small></div>
            <span className="tag green"><Icon name="check" style={{ width: 13, height: 13 }} />PŘIHLÁŠENO</span>
          </div>
          <p>Discord je tvůj hlavní účet. Přes něj se přihlašuješ a komunikuješ s ostatními hráči.</p>
        </div>

        <div className="card conn">
          <div className="conn-top">
            <div className="conn-logo" style={{ background: "var(--hover)", color: "var(--accent)" }}><Icon name="shield" /></div>
            <div><h3>League of Legends</h3><small>{accs.length ? `${accs.length} / ${MAX_RIOT_ACCOUNTS} účtů` : "Nepropojeno"}</small></div>
            <span className={`tag ${accs.length ? "green" : "grey"}`}>{accs.length ? "PROPOJENO" : "NEPROPOJENO"}</span>
          </div>
          <RiotConnection accounts={riotAccounts} ddVersion={ddVersion} platforms={platforms} hasKey={hasRiotKey()} max={MAX_RIOT_ACCOUNTS} />
        </div>

        <div className="card conn">
          <div className="conn-top">
            <div className="conn-logo" style={{ background: "rgba(169,112,255,.14)", color: "var(--twitch)" }}><Icon name="twitch" /></div>
            <div><h3>Twitch</h3><small>{twitchAcc ? twitch?.displayName ?? "Propojeno" : "Nepropojeno"}</small></div>
            {twitch?.live ? <span className="live-pill on">LIVE</span> : <span className={`tag ${twitchAcc ? "green" : "grey"}`}>{twitchAcc ? "PROPOJENO" : "NEPROPOJENO"}</span>}
          </div>
          <SocialConnection provider="twitch" linked={twitchAcc ? twitch?.url ?? "https://twitch.tv" : null} enabled={enabledProviders.twitch} />
        </div>

        <div className="card conn">
          <div className="conn-top">
            <div className="conn-logo" style={{ background: "rgba(83,252,24,.1)", color: "var(--kick)" }}><Icon name="kick" /></div>
            <div><h3>Kick</h3><small>{kickAcc ? kick?.displayName ?? "Propojeno" : "Nepropojeno"}</small></div>
            {kick?.live ? <span className="live-pill on">LIVE</span> : <span className={`tag ${kickAcc ? "green" : "grey"}`}>{kickAcc ? "PROPOJENO" : "NEPROPOJENO"}</span>}
          </div>
          <SocialConnection provider="kick" linked={kickAcc ? kick?.url ?? "https://kick.com" : null} enabled={enabledProviders.kick} />
        </div>
      </div>

      <div className="section" style={{ marginTop: 40 }}>
        <div className="card conn">
          <div className="conn-top"><div><h3>Preferované role</h3><small>Podle nich tě systém bude řadit do týmů</small></div></div>
          <RolesForm main={me?.profile?.mainRole ?? null} secondary={me?.profile?.secondaryRole ?? null} />
        </div>
      </div>
    </section>
  );
}
