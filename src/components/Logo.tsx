/** Logo Inhouse Arena: znak (písmeno A jako brána arény) + nápis */
export function LogoMark({ size = 50 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="ia-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D9CCFF" />
          <stop offset="1" stopColor="#9C84F2" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#ia-g)" />
      <path d="M24 8.5 37 36h-6.2L24 20.6 17.2 36H11z" fill="#1B1530" />
      <path d="M24 25.2l3.4 3.6-3.4 3.6-3.4-3.6z" fill="#1B1530" />
      <path d="M9.5 39.2Q24 44.6 38.5 39.2" fill="none" stroke="#1B1530" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <>
      <LogoMark />
      <div>
        <div className="logo-name">inhouse</div>
        <div className="logo-sub">ARENA</div>
      </div>
    </>
  );
}
