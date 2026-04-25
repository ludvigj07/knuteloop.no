export function KnotIcon({ size = 22 }) {
  return (
    <svg
      viewBox="0 0 100 56"
      width={size}
      height={Math.round(size * 56 / 100)}
      fill="none"
      stroke="currentColor"
      strokeWidth="11"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Under strand at crossing — drawn first so loop sits on top */}
      <path d="M 38,28 C 44,38 56,40 66,34 L 100,28" />
      {/* Main loop + left tail — drawn on top at crossing */}
      <path d="M 0,28 C 16,28 20,12 32,8 C 44,4 60,6 68,18 C 76,30 70,46 56,50 C 42,54 28,46 28,36 C 28,24 36,16 46,16 C 56,16 64,22 66,28" />
    </svg>
  );
}
