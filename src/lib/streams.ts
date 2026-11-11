import "server-only";

/* Live stav Twitch a Kick kanálů.
   Používáme "app access token" (client credentials), takže nepotřebujeme
   tokeny jednotlivých hráčů – stačí jejich ID z propojeného účtu. */

export type ChannelStatus = {
  platform: "twitch" | "kick";
  accountId: string;
  login: string; // twitch login / kick slug
  displayName: string;
  url: string;
  live: boolean;
  title?: string;
  viewers?: number;
  thumbnail?: string;
  avatar?: string;
};

type Token = { value: string; expires: number };
const tokens: Partial<Record<"twitch" | "kick", Token>> = {};

async function appToken(platform: "twitch" | "kick"): Promise<string | null> {
  const cached = tokens[platform];
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;

  const id = platform === "twitch" ? process.env.TWITCH_CLIENT_ID : process.env.KICK_CLIENT_ID;
  const secret = platform === "twitch" ? process.env.TWITCH_CLIENT_SECRET : process.env.KICK_CLIENT_SECRET;
  if (!id || !secret) return null;

  const url = platform === "twitch" ? "https://id.twitch.tv/oauth2/token" : "https://id.kick.com/oauth/token";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token: string; expires_in: number };
    tokens[platform] = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  } catch {
    return null;
  }
}

/* ───────── Twitch ───────── */

export async function getTwitchChannels(userIds: string[]): Promise<ChannelStatus[]> {
  if (!userIds.length) return [];
  const token = await appToken("twitch");
  if (!token) return [];
  const headers = { "Client-Id": process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` };
  const q = userIds.slice(0, 100).map((id) => `id=${id}`).join("&");
  const sq = userIds.slice(0, 100).map((id) => `user_id=${id}`).join("&");

  try {
    const [usersRes, streamsRes] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/users?${q}`, { headers, next: { revalidate: 3600 } }),
      fetch(`https://api.twitch.tv/helix/streams?${sq}`, { headers, next: { revalidate: 60 } }),
    ]);
    const users = ((await usersRes.json()) as { data?: TwitchUser[] }).data ?? [];
    const streams = ((await streamsRes.json()) as { data?: TwitchStream[] }).data ?? [];
    const live = new Map(streams.map((s) => [s.user_id, s]));

    return users.map((u) => {
      const s = live.get(u.id);
      return {
        platform: "twitch",
        accountId: u.id,
        login: u.login,
        displayName: u.display_name,
        url: `https://twitch.tv/${u.login}`,
        avatar: u.profile_image_url,
        live: !!s,
        title: s?.title,
        viewers: s?.viewer_count,
        thumbnail: s?.thumbnail_url.replace("{width}", "640").replace("{height}", "360"),
      };
    });
  } catch {
    return [];
  }
}
type TwitchUser = { id: string; login: string; display_name: string; profile_image_url: string };
type TwitchStream = { user_id: string; title: string; viewer_count: number; thumbnail_url: string };

/* ───────── Kick ───────── */

export async function getKickChannels(userIds: string[]): Promise<ChannelStatus[]> {
  if (!userIds.length) return [];
  const token = await appToken("kick");
  if (!token) return [];
  const q = userIds.slice(0, 50).map((id) => `broadcaster_user_id=${id}`).join("&");

  try {
    const res = await fetch(`https://api.kick.com/public/v1/channels?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    const channels = ((await res.json()) as { data?: KickChannel[] }).data ?? [];
    return channels.map((c) => ({
      platform: "kick",
      accountId: String(c.broadcaster_user_id),
      login: c.slug,
      displayName: c.slug,
      url: `https://kick.com/${c.slug}`,
      live: !!c.stream?.is_live,
      title: c.stream_title,
      viewers: c.stream?.viewer_count,
      thumbnail: c.stream?.thumbnail || undefined,
    }));
  } catch {
    return [];
  }
}
type KickChannel = {
  broadcaster_user_id: number;
  slug: string;
  stream_title?: string;
  stream?: { is_live: boolean; viewer_count: number; thumbnail?: string };
};
