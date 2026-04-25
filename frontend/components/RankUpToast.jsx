import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const AUTO_DISMISS_MS = 4000;

// RankUpToast — slide-in fra toppen som vises når currentUser passerer
// noen på topplisten. Renderes via createPortal til document.body.
export function RankUpToast({ data, onClose }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!data) return undefined;

    setIsLeaving(false);

    // Auto-dismiss etter 4 sek — start exit-animasjon litt før vi calls onClose.
    const exitTimerId = window.setTimeout(() => {
      setIsLeaving(true);
    }, AUTO_DISMISS_MS - 280);

    const closeTimerId = window.setTimeout(() => {
      onClose?.();
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(exitTimerId);
      window.clearTimeout(closeTimerId);
    };
  }, [data, onClose]);

  if (!data || typeof document === 'undefined') {
    return null;
  }

  function handleTap() {
    setIsLeaving(true);
    window.setTimeout(() => onClose?.(), 220);
  }

  const { passedName, newRank } = data;

  return createPortal(
    <div
      className={`rank-up-toast${isLeaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      onClick={handleTap}
    >
      <div className="rank-up-toast__icon" aria-hidden="true">
        🚀
      </div>
      <div className="rank-up-toast__copy">
        <p className="rank-up-toast__title">Du gikk forbi {passedName}!</p>
        <p className="rank-up-toast__sub">
          Nå #{newRank} på lista
        </p>
      </div>
    </div>,
    document.body,
  );
}
