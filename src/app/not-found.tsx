import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card empty" style={{ padding: 56 }}>
      <b>Stránka nenalezena</b>
      <p style={{ margin: "6px 0 20px" }}>Tenhle hráč nebo stránka neexistuje.</p>
      <Link className="btn btn-outline" href="/">Zpět na přehled</Link>
    </div>
  );
}
