import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';

const GOLD_COLORS = ['#fbbf24', '#f59e0b', '#fde68a'];
const DIAMOND_COLORS = ['#74e0ff', '#b48bff', '#ffe27a', '#ff8ad6', '#ffffff'];
const AUTO_DISMISS_MS = 8000;

// AchievementCelebration — full-screen overlay som vises når brukeren
// låser opp en ny achievement. Kalles fra App.jsx med achievement-objektet.
export function AchievementCelebration({ achievement, onClose }) {
  useEffect(() => {
    if (!achievement) return undefined;

    // Fyr av confetti — gull eller diamant-palett basert på tier.
    const tierKey = achievement.tierKey ?? '';
    const palette =
      tierKey === 'diamond'
        ? DIAMOND_COLORS
        : tierKey === 'gold' || tierKey === ''
          ? GOLD_COLORS
          : tierKey === 'silver'
            ? ['#cbd5e1', '#9ca3af', '#e5e7eb']
            : tierKey === 'bronze'
              ? ['#cd7f32', '#a16207', '#f59e0b']
              : GOLD_COLORS;
    try {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.55 },
          startVelocity: 50,
          gravity: 0.9,
          ticks: 250,
          colors: palette,
          zIndex: 100000,
        });
        window.setTimeout(() => {
          confetti({
            particleCount: 70,
            spread: 110,
            origin: { y: 0.5, x: 0.25 },
            colors: palette,
            zIndex: 100000,
          });
          confetti({
            particleCount: 70,
            spread: 110,
            origin: { y: 0.5, x: 0.75 },
            colors: palette,
            zIndex: 100000,
          });
        }, 220);
      }
    } catch {
      // ignorerer feil her — modalen er uansett synlig
    }

    const timerId = window.setTimeout(() => {
      onClose?.();
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [achievement, onClose]);

  if (!achievement || typeof document === 'undefined') {
    return null;
  }

  const tierLabel = achievement.currentTierLabel ?? 'Bronse';
  const title = achievement.title ?? 'Ny prestasjon';
  const description = achievement.description ?? '';
  const icon = achievement.icon ?? '★';

  return createPortal(
    <div
      className="achievement-celebration-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievement-celebration-title"
      onClick={onClose}
    >
      <div
        className="achievement-celebration-card"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="achievement-celebration-eyebrow">Du fikk:</p>
        <div className="achievement-celebration-icon" aria-hidden="true">
          <span>{icon}</span>
        </div>
        <h2 id="achievement-celebration-title" className="achievement-celebration-title">
          {title}
        </h2>
        <p className="achievement-celebration-tier">{tierLabel}-tier låst opp</p>
        {description ? (
          <p className="achievement-celebration-body">{description}</p>
        ) : null}
        <button
          type="button"
          className="achievement-celebration-cta"
          onClick={onClose}
        >
          Fett!
        </button>
      </div>
    </div>,
    document.body,
  );
}
