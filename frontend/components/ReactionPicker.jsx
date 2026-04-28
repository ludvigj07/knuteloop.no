import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const REACTION_EMOJIS = ['❤️', '\u{1F525}', '\u{1F602}', '\u{1F44F}', '\u{1F92F}'];
const AUTO_CLOSE_MS = 3000;
const FLY_DURATION_MS = 1200;

export function ReactionPicker({ x, y, onClose, onSelect }) {
  const closeTimerRef = useRef(null);

  useEffect(() => {
    closeTimerRef.current = window.setTimeout(() => {
      onClose?.();
    }, AUTO_CLOSE_MS);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [onClose]);

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;
      if (target?.closest?.('[data-reaction-picker="true"]')) {
        return;
      }
      onClose?.();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  // Approx pill width: 5 emojis * ~46px + padding ~16
  const pillWidth = 256;
  const halfWidth = pillWidth / 2;
  const minLeft = 12;
  const maxLeft = Math.max(minLeft, viewportWidth - pillWidth - 12);
  const left = Math.min(Math.max(x - halfWidth, minLeft), maxLeft);
  const top = Math.max(y - 64, 12);

  return createPortal(
    <div
      data-reaction-picker="true"
      data-swipe-lock="true"
      className="reaction-picker"
      style={{ left: `${left}px`, top: `${top}px` }}
      role="menu"
      aria-label="Velg reaksjon"
      onClick={(event) => event.stopPropagation()}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-picker__emoji"
          aria-label={`Reager med ${emoji}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(emoji);
          }}
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function ReactionFlyOverlay({ items }) {
  if (!items || items.length === 0) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="reaction-fly-layer" aria-hidden="true">
      {items.map((item) => (
        <span
          key={item.id}
          className="reaction-fly-emoji"
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            animationDuration: `${FLY_DURATION_MS}ms`,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>,
    document.body,
  );
}

export const REACTION_FLY_DURATION_MS = FLY_DURATION_MS;
