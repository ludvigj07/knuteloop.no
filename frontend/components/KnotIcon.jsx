export function KnotIcon({ size = 22, strokeWidth = 1.8 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Left tail going into the loop */}
      <path d="M5 19 C5 16 7 13 10 13" />
      {/* The loop */}
      <path d="M10 13 C9 11 9 8 12 7 C15 6 17 8 17 11 C17 14 15 15 14 15" />
      {/* Right tail going under — break shows "under" effect */}
      <path d="M14 15 C13 16 12 17 12 18 C12 20 14 21 16 20 C18 19 19 17 19 19" />
      {/* Left tail continues "over" the crossing */}
      <path d="M10 13 C11 14 12 15 14 15" />
      {/* Left tail end */}
      <path d="M5 19 C4 20 5 21 7 20 C9 19 10 17 10 15 C10 14 10 13 10 13" />
    </svg>
  );
}
