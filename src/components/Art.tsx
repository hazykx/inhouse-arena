// Abstraktní "krystalový" obrázek generovaný ze seedu (náhrada za splash arty).
export function artSvg(seed: number, hues: [number, number, number]) {
  let s = seed;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const [h1, h2, h3] = hues;
  let shards = "";
  for (let i = 0; i < 46; i++) {
    const cx = 200 + r() * 1000, cy = r() * 600, len = 60 + r() * 220, w = 10 + r() * 46, a = r() * Math.PI * 2;
    const x1 = cx + Math.cos(a) * len, y1 = cy + Math.sin(a) * len;
    const nx = Math.cos(a + Math.PI / 2) * w, ny = Math.sin(a + Math.PI / 2) * w;
    const hue = [h1, h2, h3][Math.floor(r() * 3)];
    const op = (0.08 + r() * 0.32).toFixed(2);
    shards += `<polygon points="${cx + nx},${cy + ny} ${x1},${y1} ${cx - nx},${cy - ny} ${cx - nx * 0.2},${cy - ny * 0.2}" fill="hsl(${hue} 60% ${(40 + r() * 25).toFixed(0)}%)" opacity="${op}"/>`;
  }
  return `<svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <defs>
      <radialGradient id="g${seed}a" cx="70%" cy="40%" r="60%"><stop offset="0" stop-color="hsl(${h1} 60% 38%)" stop-opacity=".9"/><stop offset="1" stop-color="hsl(${h1} 60% 20%)" stop-opacity="0"/></radialGradient>
      <radialGradient id="g${seed}b" cx="40%" cy="80%" r="50%"><stop offset="0" stop-color="hsl(${h2} 55% 35%)" stop-opacity=".8"/><stop offset="1" stop-color="hsl(${h2} 55% 20%)" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="600" fill="#17141f"/><rect width="1200" height="600" fill="url(#g${seed}a)"/><rect width="1200" height="600" fill="url(#g${seed}b)"/>${shards}</svg>`;
}

export function Art({ seed, hues, className, style }: { seed: number; hues: [number, number, number]; className?: string; style?: React.CSSProperties }) {
  return <div className={className ?? "art"} style={style} dangerouslySetInnerHTML={{ __html: artSvg(seed, hues) }} />;
}

/** Stabilní číslo z textu – aby měl každý hráč vlastní barvy */
export function hashSeed(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}
