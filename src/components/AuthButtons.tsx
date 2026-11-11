"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Icon } from "./Icon";

export function LoginButton({ label = "Přihlásit přes Discord", className = "btn btn-primary", arrow = false, callbackURL = "/profil" }: { label?: string; className?: string; arrow?: boolean; callbackURL?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await authClient.signIn.social({ provider: "discord", callbackURL });
        if (res?.error) {
          alertBox(res.error.message ?? "Přihlášení se nepovedlo. Je nastavený DISCORD_CLIENT_ID?");
          setBusy(false);
        }
      }}
    >
      <Icon name="discord" />
      <span className="login-txt">{busy ? "Přesměrovávám…" : label}</span>
      {arrow && <Icon name="arrow" />}
    </button>
  );
}

function alertBox(msg: string) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.querySelector("span")!.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}

export function UserMenu({ id, name, image }: { id: string; name: string; image?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-chip" onClick={() => setOpen((o) => !o)}>
        {image ? <img src={image} alt="" /> : <span className="ph" />}
        <b className="login-txt">{name}</b>
        <Icon name="chevdown" />
      </button>
      {open && (
        <div className="dropdown" onClick={() => setOpen(false)}>
          <Link href={`/hrac/${id}`}><Icon name="user" />Můj profil</Link>
          <Link href="/profil"><Icon name="settings" />Propojené účty</Link>
          <hr />
          <button
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <Icon name="logout" />Odhlásit se
          </button>
        </div>
      )}
    </div>
  );
}
