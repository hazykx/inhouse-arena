import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { IconSprite, Icon } from "@/components/Icon";
import { Sidebar, MenuButton, Crumb } from "@/components/Sidebar";
import { LoginButton, UserMenu } from "@/components/AuthButtons";
import { getSession } from "@/lib/session";
import { QueueProvider } from "@/components/queue/QueueProvider";
import { QueueModal } from "@/components/queue/QueueModal";
import { QueuePill } from "@/components/queue/QueuePill";

export const metadata: Metadata = {
  title: "Inhouse Arena – LoL inhouse komunita",
  description: "Inhouse hry League of Legends 5v5 – fronta, férové týmy, žebříček a statistiky.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="cs">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Caveat:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <IconSprite />
        <QueueProvider enabled={!!session}>
        <Sidebar />
        <div className="main">
          <header className="topbar">
            <MenuButton />
            <div className="crumbs">
              <span className="home">Inhouse</span>
              <Icon name="chev" />
              <Crumb />
            </div>
            <div className="top-right">
              <span className="eyebrow-sm">LEAGUE OF LEGENDS</span>
              <Link className="btn btn-ghost tw" href="/streamy">
                <Icon name="tv" />
                Kdo streamuje
              </Link>
              {session ? <UserMenu id={session.user.id} name={session.user.name} image={session.user.image} /> : <LoginButton />}
            </div>
          </header>
          <main className="page">{children}</main>
        </div>
        <QueueModal />
        <QueuePill />
        </QueueProvider>
        <div className="toast" id="toast">
          <Icon name="info" />
          <span />
        </div>
      </body>
    </html>
  );
}
