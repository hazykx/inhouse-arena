import Link from "next/link";
import { LoginButton } from "@/components/AuthButtons";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { TournamentForm } from "./TournamentForm";

export const dynamic = "force-dynamic";

export default async function NewTournament() {
  const session = await getSession();
  const admin = await isAdmin(session?.user.id);
  return (
    <section className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href="/turnaje">TURNAJE A LIGY</Link></div>
          <h1>Přidat turnaj<span className="dot">.</span></h1>
          <div className="lead">Turnaj se zobrazí hned po přidání. Stav (registrace, probíhá, ukončeno) se nastavuje sám podle dat.</div>
        </div>
      </div>
      {session ? (
        <TournamentForm admin={admin} />
      ) : (
        <div className="card empty" style={{ padding: 48 }}>
          <b>Pro přidání turnaje se přihlas</b>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}><LoginButton callbackURL="/turnaje/novy" /></div>
        </div>
      )}
    </section>
  );
}
