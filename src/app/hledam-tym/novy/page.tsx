import Link from "next/link";
import { LoginButton } from "@/components/AuthButtons";
import { getSession } from "@/lib/session";
import { LfgForm } from "./LfgForm";

export const dynamic = "force-dynamic";

export default async function NewPost({ searchParams }: { searchParams: Promise<{ typ?: string }> }) {
  const { typ } = await searchParams;
  const session = await getSession();

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href="/hledam-tym">HLEDÁM TÝM</Link></div>
          <h1>Nový inzerát<span className="dot">.</span></h1>
          <div className="lead">Ostatní tě kontaktují přes Discord. Každý hráč může mít jeden inzerát od každého typu, nový nahradí starý.</div>
        </div>
      </div>
      {session ? (
        <LfgForm defaultKind={typ === "tym" ? "TEAM" : "PLAYER"} />
      ) : (
        <div className="card empty" style={{ padding: 48 }}>
          <b>Pro přidání inzerátu se přihlas</b>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}><LoginButton callbackURL="/hledam-tym/novy" /></div>
        </div>
      )}
    </section>
  );
}
