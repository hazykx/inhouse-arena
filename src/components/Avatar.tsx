const COLORS = ["#B9A3FA", "#8FD3C1", "#F5C15C", "#F49AAE", "#8AB4FF", "#C6E68A", "#FFB38A", "#9EE6F0"];

export function initials(name: string) {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, "");
  return (letters.slice(0, 2) || "?").toUpperCase();
}
export function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Avatar hráče – Discord obrázek, nebo barevné iniciály */
export function Avatar({ name, image, size = "md", className = "" }: { name: string; image?: string | null; size?: "sm" | "md"; className?: string }) {
  const cls = `pic ${size === "sm" ? "sm" : ""} ${image ? "img" : ""} ${className}`;
  if (image) {
    return (
      <div className={cls}>
        <img src={image} alt="" />
      </div>
    );
  }
  return (
    <div className={cls} style={{ background: colorFor(name) }}>
      {initials(name)}
    </div>
  );
}
