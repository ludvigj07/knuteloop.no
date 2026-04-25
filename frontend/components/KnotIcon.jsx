export function KnotIcon({ size = 22, strokeWidth }) {
  return (
    <svg
      viewBox="0 0 60 36"
      width={size}
      height={Math.round(size * 0.6)}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Left rope tail — overlaps loop edge so they visually connect */}
      <rect x="0" y="13" width="10" height="10" rx="4" />

      {/* Left loop — donut using evenodd */}
      <path
        fillRule="evenodd"
        d="M31,18 A13,13,0,1,0,5,18 A13,13,0,1,0,31,18 Z
           M25,18 A7,7,0,1,0,11,18 A7,7,0,1,0,25,18 Z"
      />

      {/* Right loop — donut */}
      <path
        fillRule="evenodd"
        d="M55,18 A13,13,0,1,0,29,18 A13,13,0,1,0,55,18 Z
           M49,18 A7,7,0,1,0,35,18 A7,7,0,1,0,49,18 Z"
      />

      {/* Right rope tail — overlaps loop edge */}
      <rect x="50" y="13" width="10" height="10" rx="4" />
    </svg>
  );
}
