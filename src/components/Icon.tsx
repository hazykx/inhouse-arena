// Sada ikon (SVG sprite). Použití: <Icon name="arrow" />
export type IconName = "grid" | "chart" | "swords" | "tv" | "users" | "trophy" | "menu" | "chev" | "arrow" | "user" | "shield" | "info" | "link" | "search" | "clock" | "cal" | "eye" | "play" | "plus" | "msg" | "mega" | "discord" | "twitch" | "kick" | "logout" | "settings" | "check" | "x" | "ext" | "refresh" | "crown" | "chevdown";

export function Icon({ name, className, style }: { name: IconName; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={"i" + (className ? " " + className : "")} style={style} aria-hidden="true">
      <use href={`#ic-${name}`} />
    </svg>
  );
}

const SPRITE = `
    <symbol id="ic-grid" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></symbol>
    <symbol id="ic-chart" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol>
    <symbol id="ic-swords" viewBox="0 0 24 24"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 14 2h3v3l-4.5 4.5M5 14l-2 2 4 4 2-2M7 17l-3 3"/></symbol>
    <symbol id="ic-tv" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="m8 2 4 4 4-4"/></symbol>
    <symbol id="ic-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2 .7 3.3 2.6 3.5 5.4"/></symbol>
    <symbol id="ic-trophy" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/></symbol>
    <symbol id="ic-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
    <symbol id="ic-chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
    <symbol id="ic-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
    <symbol id="ic-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/></symbol>
    <symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z"/></symbol>
    <symbol id="ic-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>
    <symbol id="ic-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></symbol>
    <symbol id="ic-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></symbol>
    <symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="ic-cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
    <symbol id="ic-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="ic-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z" fill="currentColor"/></symbol>
    <symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="ic-msg" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4V5Z"/></symbol>
    <symbol id="ic-mega" viewBox="0 0 24 24"><path d="M3 10v4h3l7 5V5L6 10H3ZM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/></symbol>
    <symbol id="ic-discord" viewBox="0 0 24 24"><path d="M8.5 7.5c2.3-.7 4.7-.7 7 0M7.5 16.5c2.9 1.1 6.1 1.1 9 0"/><path d="M8 5.5 6 5c-1.5 2.3-2.5 5.3-2.5 9.5 1.3 1.6 3 2.6 5 3l1-2M16 5.5l2-.5c1.5 2.3 2.5 5.3 2.5 9.5-1.3 1.6-3 2.6-5 3l-1-2"/><circle cx="9.3" cy="12" r="1.2"/><circle cx="14.7" cy="12" r="1.2"/></symbol>
  
    <symbol id="ic-twitch" viewBox="0 0 24 24"><path d="M4.5 3 3 6.5V20h4.5v2.5H10l2.5-2.5h3.5l5-5V3H4.5Z"/><path d="M11 8v4.5M15.5 8v4.5"/></symbol>
    <symbol id="ic-kick" viewBox="0 0 24 24"><path d="M4 3h5v5h2V6h2V4h6v6h-2v2h-2v0h2v2h2v6h-6v-2h-2v-2H9v5H4V3Z"/></symbol>
    <symbol id="ic-logout" viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></symbol>
    <symbol id="ic-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></symbol>
    <symbol id="ic-check" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></symbol>
    <symbol id="ic-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
    <symbol id="ic-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></symbol>
    <symbol id="ic-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.7-4.3L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.3L20 16M20 20v-4h-4"/></symbol>
    <symbol id="ic-crown" viewBox="0 0 24 24"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Z"/></symbol>
    <symbol id="ic-chevdown" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
`;

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs dangerouslySetInnerHTML={{ __html: SPRITE }} />
    </svg>
  );
}
