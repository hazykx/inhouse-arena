"use client";
import { useState } from "react";
import { ROLES, type Role } from "@/db/schema";
import { ROLE_CS } from "@/lib/format";
import { RoleSvg } from "./RoleIcon";

/** Výběr rolí ikonami. multiple = víc rolí (inzeráty), jinak jedna (profil). */
export function RolePicker({ name, defaultValue = [], multiple = false, allowEmpty = true }: { name: string; defaultValue?: (Role | null)[]; multiple?: boolean; allowEmpty?: boolean }) {
  const [value, setValue] = useState<Role[]>(defaultValue.filter(Boolean) as Role[]);
  const toggle = (r: Role) => {
    if (multiple) setValue((v) => (v.includes(r) ? v.filter((x) => x !== r) : [...v, r]));
    else setValue((v) => (v[0] === r && allowEmpty ? [] : [r]));
  };
  return (
    <div className="role-picker">
      {ROLES.map((r) => (
        <button type="button" key={r} className={`rp ${value.includes(r) ? "on" : ""}`} onClick={() => toggle(r)} title={ROLE_CS[r]} aria-pressed={value.includes(r)}>
          <RoleSvg role={r} size={22} />
          <span>{ROLE_CS[r]}</span>
        </button>
      ))}
      {value.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
    </div>
  );
}
