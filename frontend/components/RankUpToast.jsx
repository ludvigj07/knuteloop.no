import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const AUTO_DISMISS_MS = 4000;
const SWIPE_DISMISS_PX = 40;

// RankUpToast — slide-in fra toppen som vises når currentUser passerer
// noen på topplisten. Renderes via createPortal til document.body.
export function RankUpToast({ data, onClose }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStateRef = useRef(null);

  // onClose fra parent er en inline arrow som endres ved hver render.
  // Lagrer siste i ref så useEffect under kun reagerer på `data`-bytte —
  // uten denne resettes exit-timeren ved hver re-render i App, og toasten
  // kan henge mye lenger enn 4 sek hvis bakgrunns-fetch trigger render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!data) return undefined;

    setIsLeaving(false);
    setDragY(0);

    // Auto-dismiss etter 4 sek — start exit-animasjon litt før vi calls onClose.
    const exitTimerId = window.setTimeout(() => {
      setIsLeaving(true);
    }, AUTO_DISMISS_MS - 280);

    const closeTimerId = window.setTimeout(() => {
      onCloseRef.current?.();
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(exitTimerId);
      window.clearTimeout(closeTimerId);
    };
  }, [data]);

  if (!data || typeof document === 'undefined') {
    return null;
  }

  function dismiss() {
    setIsLeaving(true);
    window.setTimeout(() => onClose?.(), 220);
  }

  function handleTap() {
    if (dragStateRef.current?.didDrag) return;
    dismiss();
  }

  function handlePointerDown(event) {
    dragStateRef.current = {
      startY: event.clientY,
      pointerId: event.pointerId,
      didDrag: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const delta = event.clientY - state.startY;
    if (Math.abs(delta) > 4) state.didDrag = true;
    // Bare la brukeren dra oppover — clamp nedover-bevegelse til 0.
    setDragY(Math.min(0, delta));
  }

  function handlePointerUp(event) {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      dragStateRef.current = null;
      return;
    }
    const delta = event.clientY - state.startY;
    dragStateRef.current = null;
    if (delta < -SWIPE_DISMISS_PX) {
      dismiss();
    } else {
      setDragY(0);
    }
  }

  const { passedName, newRank } = data;
  const isDragging = dragY !== 0;
  const dragStyle = isDragging
    ? {
        transform: `translateX(-50%) translateY(${dragY}px)`,
        animation: 'none',
        transition: 'none',
      }
    : undefined;

  return createPortal(
    <div
      className={`rank-up-toast${isLeaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      style={dragStyle}
      onClick={handleTap}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
