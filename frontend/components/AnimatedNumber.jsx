import { useEffect, useRef, useState } from 'react';

// Counter-effekt: når `value` endrer seg, telles tallet jevnt opp/ned over
// `durationMs` med ease-out. Når reduced-motion er på, snapper det direkte.
export function AnimatedNumber({ value, durationMs = 800, format = (n) => n, className }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion || fromRef.current === value) {
      setDisplay(value);
      fromRef.current = value;
      return undefined;
    }

    fromRef.current = display;
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / durationMs, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(t >= 1 ? value : next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <span className={className}>{format(Math.round(display))}</span>;
}
