import Link from "next/link";
import { Icon } from "@/components/Icon";

const MESSAGES: Record<string, { title: string; text: React.ReactNode }> = {
  invalid_code: {
    title: "Discord odmítl přihlášení",
    text: (
      <>
        Web nedostal od Discordu přístup. Skoro vždy jde o špatně zkopírované klíče v souboru <code>.env</code>:
        <ul style={{ textAlign: "left", margin: "14px auto 0", maxWidth: 520, lineHeight: 1.8, paddingLeft: 20 }}>
          <li><b>DISCORD_CLIENT_SECRET</b> musí být z záložky <b>OAuth2 → Client Secret</b>, ne „Public Key“ z General Information.</li>
          <li>Pokud jsi secret po zkopírování znovu resetoval, platí jen ten nejnovější.</li>
          <li>Žádné mezery ani uvozovky kolem hodnot.</li>
          <li>Po úpravě <code>.env</code> web vypni a spusť znovu.</li>
        </ul>
      </>
    ),
  },
  state_mismatch: {
    title: "Přihlášení vypršelo",
    text: <>Otevři web přes <b>http://localhost:3000</b> (ne 127.0.0.1) a zkus se přihlásit znovu.</>,
  },
  please_restart_the_process: {
    title: "Přihlášení vypršelo",
    text: <>Zkus se přihlásit znovu. Web otevírej vždy přes <b>http://localhost:3000</b>.</>,
  },
  access_denied: { title: "Přihlášení zrušeno", text: <>Na stránce Discordu jsi přístup nepotvrdil. Můžeš to zkusit znovu.</> },
  signup_disabled: {
    title: "Nejdřív se přihlas přes Discord",
    text: <>Twitch a Kick slouží jen k propojení. Přihlas se přes Discord a pak je propoj v sekci Propojené účty.</>,
  },
  account_already_linked_to_different_user: {
    title: "Účet už je propojený",
    text: <>Tenhle Twitch nebo Kick účet už má propojený jiný hráč.</>,
  },
};

export default async function AuthError({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string }> }) {
  const { error = "unknown", error_description } = await searchParams;
  const m = MESSAGES[error] ?? {
    title: "Přihlášení se nepovedlo",
    text: <>Zkus to prosím znovu. Pokud chyba přetrvává, podívej se do okna, ve kterém web běží – je tam podrobnější výpis.</>,
  };

  return (
    <section className="view">
      <div className="card empty" style={{ padding: "56px 32px" }}>
        <div className="step-ico" style={{ margin: "0 auto 20px", background: "rgba(240,122,134,.12)", color: "var(--loss)" }}><Icon name="x" /></div>
        <b style={{ fontSize: 22 }}>{m.title}</b>
        <div style={{ margin: "10px auto 0", maxWidth: 600, lineHeight: 1.7 }}>{m.text}</div>
        <div style={{ marginTop: 18, fontSize: 12, color: "var(--dim)" }}>Kód chyby: {error}{error_description ? ` – ${error_description}` : ""}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26 }}>
          <Link className="btn btn-primary" href="/">Zpět na přehled</Link>
          <Link className="btn btn-outline" href="/profil">Propojené účty</Link>
        </div>
      </div>
    </section>
  );
}
