export const ROLE_SHORT: Record<string, string> = { TOP: "TOP", JUNGLE: "JGL", MID: "MID", ADC: "ADC", SUPPORT: "SUP" };
export const ROLE_CS: Record<string, string> = { TOP: "Top", JUNGLE: "Jungle", MID: "Mid", ADC: "ADC", SUPPORT: "Support" };

export function duration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function when(d: Date) {
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  const time = d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  if (diff === 0) return `Dnes ${time}`;
  if (diff === 1) return `Včera ${time}`;
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "Europe/Prague" }) + ` ${time}`;
}

export function ago(d: Date) {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 60) return `před ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `před ${h} h`;
  const days = Math.round(h / 24);
  return days === 1 ? "včera" : `před ${days} dny`;
}

export const fmt = (n: number, digits = 1) => n.toLocaleString("cs-CZ", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const RANK_OPTIONS = ["Unranked", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"];

/** Pro <input type="date">: Date → "YYYY-MM-DD" */
export const toDateInput = (d?: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "");
export const dateCs = (d: Date) => d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" });
