export function SimpleKnotIcon({ size = 22, strokeWidth = 1.8 }) {
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
      <path d="M 3 12 H 7.5" />
      <path d="M 16.5 12 H 21" />
      <path d="M 7.5 12 C 7.5 7.8, 13.5 7.8, 13.5 12 C 13.5 16.2, 7.5 16.2, 7.5 12 Z" />
      <path d="M 10.5 12 C 10.5 8, 16.5 8, 16.5 12 C 16.5 16, 10.5 16, 10.5 12 Z" />
      <path d="M 9.5 10.2 L 14.5 13.8" />
    </svg>
  );
}

export function TwoXIcon({ size = 22 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <text
        x="12"
        y="16.8"
        textAnchor="middle"
        fontSize="13.6"
        fontWeight="800"
        fontFamily="inherit"
      >
        2x
      </text>
    </svg>
  );
}

export function RampestrekerIcon({ size = 22, strokeWidth = 1.8 }) {
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
      <path
        d="M 4 4.2 L 9.2 6.8 C 11 5.9, 13 5.9, 14.8 6.8 L 20 4.2 L 18.2 11.2 C 18.8 12.4, 19 13.6, 18.7 14.9 C 18 18.4, 15 20.5, 12 20.5 C 9 20.5, 6 18.4, 5.3 14.9 C 5 13.6, 5.2 12.4, 5.8 11.2 Z"
      />
      <path
        d="M 7.2 8.3 L 9.4 9.5"
        opacity="0.7"
      />
      <path
        d="M 16.8 8.3 L 14.6 9.5"
        opacity="0.7"
      />
      <path
        d="M 8.2 14.2 C 9.1 16.8, 10.4 18.6, 12 20.5 C 13.6 18.6, 14.9 16.8, 15.8 14.2"
      />
      <circle cx="9.2" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
      <path d="M 11 15.3 L 12 16.1 L 13 15.3" />
      <path d="M 12 16.1 V 17.3" />
      <path d="M 10 17.5 C 10.8 18.1, 11.3 18.2, 12 17.3 C 12.7 18.2, 13.2 18.1, 14 17.5" />
    </svg>
  );
}

export function BeerBottleIcon({ size = 22, strokeWidth = 1.8 }) {
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
      <path d="M 6.4 8.4 H 15.8 V 20.3 H 6.4 Z" />
      <path d="M 15.8 10.5 H 17.6 C 19 10.5, 20 11.6, 20 13.1 V 15.2 C 20 16.8, 19 17.9, 17.6 17.9 H 15.8" />
      <path d="M 15.8 12.7 H 17.3 C 17.9 12.7, 18.3 13.2, 18.3 13.9 V 14.7 C 18.3 15.4, 17.9 15.9, 17.3 15.9 H 15.8" />
      <path d="M 6.3 8.5 C 5.4 7.4, 6 5.8, 7.5 5.8 C 7.8 4.3, 10 4.1, 10.7 5.5 C 11.4 4, 13.6 4.2, 13.9 5.8 C 15.4 5.8, 16 7.4, 15.6 8.5" />
      <path d="M 8.4 11.2 V 18.3" />
      <path d="M 11.1 11.2 V 18.3" />
      <path d="M 13.8 11.2 V 18.3" />
      <path d="M 6.4 12.4 H 15.8" fill="currentColor" fillOpacity="0.18" />
      <path d="M 6.4 12.4 C 7.9 11.4, 9.6 13.2, 11.1 12.4 C 12.7 11.4, 14.2 13.2, 15.8 12.4" />
    </svg>
  );
}

export function HeteroSymbolIcon({ size = 22, strokeWidth = 1.8 }) {
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
      <circle cx="9" cy="14" r="3.45" />
      <path d="M 9 17.45 V 21" />
      <path d="M 6.6 19.25 H 11.4" />
      <circle cx="15" cy="8.8" r="3.45" />
      <path d="M 17.45 6.35 L 20.8 3" />
      <path d="M 17.8 3 H 20.8 V 6" />
    </svg>
  );
}
