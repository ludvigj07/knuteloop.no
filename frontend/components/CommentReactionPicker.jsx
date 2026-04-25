import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const REACTION_EMOJIS = ['❤️', '\u{1F525}', '\u{1F602}', '\u{1F44F}', '\u{1F92F}'];
const AUTO_CLOSE_MS = 3000;

// Floating emoji-picker bubble — opens above a long-pressed comment.
// Closes on outer pointerdown, on emoji-select, or after a timeout.
export function CommentReactionPicker({ x, y, onClose, onSelect }) {
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
      if (target?.closest?.('[data-comment-reaction-picker="true"]')) {
        return;
      }
      onClose?.();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  const pillWidth = 256;
  const halfWidth = pillWidth / 2;
  const minLeft = 12;
  const maxLeft = Math.max(minLeft, viewportWidth - pillWidth - 12);
  const left = Math.min(Math.max(x - halfWidth, minLeft), maxLeft);
  const top = Math.max(y - 64, 12);

  return createPortal(
    <div
      data-comment-reaction-picker="true"
      data-swipe-lock="true"
      className="comment-reaction-picker"
      style={{ left: `${left}px`, top: `${top}px` }}
      role="menu"
      aria-label="Velg reaksjon"
      onClick={(event) => event.stopPropagation()}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="comment-reaction-picker__emoji"
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

// Inline row of small reaction-pills under a comment.
// Each pill shows emoji + count, highlighted when current user picked it.
export function CommentReactionRow({ reactions, onToggle }) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <div className="comment-reaction-row" role="group" aria-label="Reaksjoner">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className={`comment-reaction-pill${reaction.mine ? ' is-mine' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.(reaction.emoji);
          }}
          aria-label={`${reaction.emoji} ${reaction.count}${reaction.mine ? ' (din)' : ''}`}
          data-no-long-press="true"
        >
          <span aria-hidden="true" className="comment-reaction-pill__emoji">{reaction.emoji}</span>
          <span className="comment-reaction-pill__count">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
