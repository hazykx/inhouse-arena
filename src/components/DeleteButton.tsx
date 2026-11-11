"use client";
import { useState, useTransition } from "react";
import { Icon } from "./Icon";

/** Tlačítko pro smazání s potvrzením druhým kliknutím */
export function DeleteButton({ action, label = "Smazat" }: { action: () => Promise<void>; label?: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`btn btn-sm ${confirm ? "btn-danger" : "btn-ghost"}`}
      disabled={pending}
      onClick={() => (confirm ? start(() => action()) : setConfirm(true))}
      onMouseLeave={() => setConfirm(false)}
    >
      <Icon name="x" />
      {pending ? "Mažu…" : confirm ? "Opravdu smazat?" : label}
    </button>
  );
}
