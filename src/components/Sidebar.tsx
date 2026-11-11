"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon, type IconName } from "./Icon";

export const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Přehled", icon: "grid" },
  { href: "/fronta", label: "Fronta", icon: "play" },
  { href: "/statistiky", label: "Statistiky", icon: "chart" },
  { href: "/zapasy", label: "Historie zápasů", icon: "swords" },
  { href: "/streamy", label: "Streamy", icon: "tv" },
  { href: "/hledam-tym", label: "Hledám tým", icon: "users" },
  { href: "/turnaje", label: "Turnaje a ligy", icon: "trophy" },
];

export function Sidebar({ admin = false }: { admin?: boolean }) {
  const path = usePathname();
  useEffect(() => document.body.classList.remove("menu-open"), [path]);

  return (
    <>
      <aside className="sidebar">
        <Link className="logo" href="/">
          <div className="logo-mark">IA</div>
          <div>
            <div className="logo-name">inhouse</div>
            <div className="logo-sub">ARENA</div>
          </div>
        </Link>
        <div className="nav-label">INHOUSE KOMUNITA</div>
        <nav className="nav">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={active ? "active" : ""}>
                <Icon name={n.icon} />
                {n.label}
              </Link>
            );
          })}
          {admin && (
            <Link href="/admin" className={path.startsWith("/admin") ? "active" : ""}>
              <Icon name="settings" />
              Admin
            </Link>
          )}
        </nav>
        <div className="side-foot">
          <b>Sezóna 1</b>
          Inhouse hry 5v5 každý večer. Přihlas se přes Discord a začni hrát.
        </div>
      </aside>
      <div className="scrim" onClick={() => document.body.classList.remove("menu-open")} />
    </>
  );
}

export function MenuButton() {
  return (
    <button className="menu-btn" aria-label="Menu" onClick={() => document.body.classList.toggle("menu-open")}>
      <Icon name="menu" />
    </button>
  );
}

export function Crumb() {
  const path = usePathname();
  const label =
    path.startsWith("/admin") ? "Admin panel" : path.startsWith("/hrac") ? "Profil hráče" : path.startsWith("/profil") ? "Můj profil" : path.startsWith("/chyba") ? "Chyba přihlášení" : NAV.find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)))?.label ?? "";
  return <span className="cur">{label}</span>;
}
