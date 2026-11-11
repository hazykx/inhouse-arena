/** Jednoduchý SVG graf vývoje MMR */
export function MmrChart({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="unranked">Graf se ukáže po pár odehraných zápasech.</div>;
  const data = [1500, ...values];
  const W = 600, H = 180, P = 8;
  const min = Math.min(...data) - 10, max = Math.max(...data) + 10;
  const x = (i: number) => P + (i / (data.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - P * 2);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H} L${x(0)},${H} Z`;
  const base = y(1500);
  return (
    <svg className="mmr-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mmrfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#B9A3FA" stopOpacity=".28" />
          <stop offset="1" stopColor="#B9A3FA" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={0} x2={W} y1={base} y2={base} stroke="#292A31" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
      <path d={area} fill="url(#mmrfill)" />
      <path d={line} fill="none" stroke="#B9A3FA" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(data.at(-1)!)} r={4.5} fill="#B9A3FA" />
    </svg>
  );
}
