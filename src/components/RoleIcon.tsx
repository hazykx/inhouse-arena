import type { Role } from "@/db/schema";
import { ROLE_CS } from "@/lib/format";

/* Vlastní ikony pozic (nejsou to oficiální Riot assety) */
const PATHS: Record<Role, React.ReactNode> = {
  TOP: (
    <>
      <path d="M20 7v13H7l3-3h7V10z" opacity=".35" />
      <path d="M10 10h4v4h-4z" opacity=".55" />
      <path d="M4 4h13l-4 4H8v5l-4 4z" />
    </>
  ),
  JUNGLE: <path d="M6 3c3 4 4.2 9 4.2 15L12 21l1.8-3c0-6 1.2-11 4.2-15-2.8 2-4.8 5-6 9-1.2-4-3.2-7-6-9z" />,
  MID: (
    <>
      <path d="M4 4h8l-3 3H7v2l-3 3z" opacity=".35" />
      <path d="M20 20h-8l3-3h2v-2l3-3z" opacity=".35" />
      <path d="M16.5 4H20v3.5L7.5 20H4v-3.5z" />
    </>
  ),
  ADC: (
    <>
      <path d="M4 17V4h13l-3 3H7v7z" opacity=".35" />
      <path d="M10 10h4v4h-4z" opacity=".55" />
      <path d="M20 20H7l4-4h5v-5l4-4z" />
    </>
  ),
  SUPPORT: (
    <>
      <path d="M12 4.5l2.6 2.8L12 11 9.4 7.3z" />
      <path d="M2.5 8h6.2l2 3-2.2 3-2.3-1.2z" />
      <path d="M21.5 8h-6.2l-2 3 2.2 3 2.3-1.2z" />
      <path d="M10.6 12.6h2.8l1 8-2.4 1-2.4-1z" />
    </>
  ),
};

export function RoleSvg({ role, size = 18 }: { role: Role; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      {PATHS[role]}
    </svg>
  );
}

/** Ikonka role s tooltipem. variant: "plain" = jen ikona, "chip" = v rámečku */
export function RoleIcon({ role, size = 18, variant = "plain", primary = false, label = false }: { role: Role | null | undefined; size?: number; variant?: "plain" | "chip"; primary?: boolean; label?: boolean }) {
  if (!role) return null;
  return (
    <span className={`role-icon ${variant} ${primary ? "primary" : ""}`} title={ROLE_CS[role]} aria-label={ROLE_CS[role]}>
      <RoleSvg role={role} size={size} />
      {label && <span className="rl">{ROLE_CS[role]}</span>}
    </span>
  );
}
