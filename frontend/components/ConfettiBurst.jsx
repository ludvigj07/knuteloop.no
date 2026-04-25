import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

// ConfettiBurst — fyrer av confetti én gang når `triggerKey` endres.
// Bruker canvas-confetti om det er tilgjengelig, ellers en CSS-fallback
// med fargede divs som faller ned.
export function ConfettiBurst({ triggerKey }) {
  const [fallbackActive, setFallbackActive] = useState(false);
  const [fallbackKey, setFallbackKey] = useState(0);

  useEffect(() => {
    if (!triggerKey) return undefined;

    let usedCanvas = false;
    try {
      if (typeof confetti === 'function') {
        usedCanvas = true;
        // To bursts for litt mer "wow"
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          startVelocity: 45,
          gravity: 0.9,
          ticks: 200,
          zIndex: 9999,
        });
        window.setTimeout(() => {
          confetti({
            particleCount: 60,
            spread: 100,
            origin: { y: 0.5, x: 0.3 },
            startVelocity: 40,
            zIndex: 9999,
          });
          confetti({
            particleCount: 60,
            spread: 100,
            origin: { y: 0.5, x: 0.7 },
            startVelocity: 40,
            zIndex: 9999,
          });
        }, 200);
      }
    } catch {
      usedCanvas = false;
    }

    if (!usedCanvas) {
      setFallbackKey((current) => current + 1);
      setFallbackActive(true);
      const id = window.setTimeout(() => setFallbackActive(false), 2400);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [triggerKey]);

  if (!fallbackActive) {
    return null;
  }

  const colors = [
    '#ff5d8f',
    '#ffd166',
    '#06d6a0',
    '#118ab2',
    '#ef476f',
    '#9d4edd',
    '#f72585',
    '#3a86ff',
  ];

  return (
    <div
      key={fallbackKey}
      className="confetti-fallback"
      aria-hidden="true"
    >
      {Array.from({ length: 18 }).map((_, index) => {
        const color = colors[index % colors.length];
        const left = (index * 100) / 18 + Math.random() * 4;
        const delay = Math.random() * 0.4;
        const duration = 1.6 + Math.random() * 0.8;
        const rotation = Math.floor(Math.random() * 360);
        return (
          <span
            key={index}
            className="confetti-fallback__piece"
            style={{
              backgroundColor: color,
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${rotation}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}
