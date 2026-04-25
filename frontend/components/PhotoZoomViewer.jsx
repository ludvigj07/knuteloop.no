import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_DRAG_THRESHOLD_PX = 100;
const CLOSE_VELOCITY_THRESHOLD = 0.6;
const ZOOM_LEVEL = 2;
const DOUBLE_TAP_MS = 280;

export function PhotoZoomViewer({ src, alt = '', origin, onClose }) {
  const imgRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const dragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    moved: false,
    velocity: 0,
  });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const panDragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  // Pinch state
  const pinchRef = useRef({
    active: false,
    initialDist: 0,
    initialScale: 1,
  });
  const activePointersRef = useRef(new Map());

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        triggerClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function triggerClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      onClose?.();
    }, 180);
  }

  function getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
  }

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (activePointersRef.current.size === 2) {
      const points = Array.from(activePointersRef.current.values());
      pinchRef.current = {
        active: true,
        initialDist: getDistance(points[0], points[1]),
        initialScale: scale,
      };
      // cancel any swipe-to-close drag
      dragRef.current.pointerId = null;
      panDragRef.current.pointerId = null;
      return;
    }

    if (scale > 1) {
      // Single-finger pan when zoomed
      panDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: pan.x,
        baseY: pan.y,
      };
      return;
    }

    // Single-finger swipe-to-close (only when not zoomed)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: performance.now(),
      moved: false,
      velocity: 0,
    };
  }

  function handlePointerMove(event) {
    const point = activePointersRef.current.get(event.pointerId);
    if (point) {
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (pinchRef.current.active && activePointersRef.current.size >= 2) {
      const points = Array.from(activePointersRef.current.values());
      const dist = getDistance(points[0], points[1]);
      if (pinchRef.current.initialDist > 0) {
        const ratio = dist / pinchRef.current.initialDist;
        const next = Math.min(
          Math.max(pinchRef.current.initialScale * ratio, 1),
          4,
        );
        setScale(next);
        if (next <= 1) setPan({ x: 0, y: 0 });
      }
      return;
    }

    if (panDragRef.current.pointerId === event.pointerId && scale > 1) {
      const dx = event.clientX - panDragRef.current.startX;
      const dy = event.clientY - panDragRef.current.startY;
      setPan({ x: panDragRef.current.baseX + dx, y: panDragRef.current.baseY + dy });
      return;
    }

    if (dragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (Math.abs(dy) > 4) dragRef.current.moved = true;
    if (dy > 0) {
      const now = performance.now();
      const dt = Math.max(now - dragRef.current.lastT, 1);
      dragRef.current.velocity = (event.clientY - dragRef.current.lastY) / dt;
      dragRef.current.lastX = event.clientX;
      dragRef.current.lastY = event.clientY;
      dragRef.current.lastT = now;
      setDragOffset({ x: dx * 0.4, y: dy });
    } else if (dragOffset.y !== 0 || dragOffset.x !== 0) {
      setDragOffset({ x: 0, y: 0 });
    }
  }

  function handlePointerUp(event) {
    activePointersRef.current.delete(event.pointerId);

    if (pinchRef.current.active && activePointersRef.current.size < 2) {
      pinchRef.current.active = false;
    }

    if (panDragRef.current.pointerId === event.pointerId) {
      panDragRef.current.pointerId = null;
      return;
    }

    if (dragRef.current.pointerId !== event.pointerId) return;
    const drag = dragRef.current;
    dragRef.current.pointerId = null;
    const offsetY = event.clientY - drag.startY;

    if (
      offsetY > CLOSE_DRAG_THRESHOLD_PX ||
      drag.velocity > CLOSE_VELOCITY_THRESHOLD
    ) {
      triggerClose();
      return;
    }

    if (!drag.moved) {
      // Tap detection — if it lands on the image: double-tap toggles zoom
      const target = event.target;
      const onImage = target?.closest?.('[data-photo-zoom-img="true"]');
      if (onImage) {
        const now = performance.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
          // Double-tap → toggle zoom
          if (scale > 1) {
            setScale(1);
            setPan({ x: 0, y: 0 });
          } else {
            setScale(ZOOM_LEVEL);
          }
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      } else {
        // Tap on backdrop → close
        triggerClose();
      }
    }
    setDragOffset({ x: 0, y: 0 });
  }

  function handlePointerCancel(event) {
    activePointersRef.current.delete(event.pointerId);
    if (pinchRef.current.active && activePointersRef.current.size < 2) {
      pinchRef.current.active = false;
    }
    if (dragRef.current.pointerId === event.pointerId) {
      dragRef.current.pointerId = null;
      setDragOffset({ x: 0, y: 0 });
    }
    if (panDragRef.current.pointerId === event.pointerId) {
      panDragRef.current.pointerId = null;
    }
  }

  // Compute origin transform for entrance
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 360;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const startX = (origin?.x ?? viewportW / 2) - viewportW / 2;
  const startY = (origin?.y ?? viewportH / 2) - viewportH / 2;
  const startScale = origin?.scale ?? 0.4;

  const dragProgress = Math.max(0, Math.min(dragOffset.y / 240, 1));
  const backdropOpacity = closing ? 0 : Math.max(0, 1 - dragProgress * 0.8);

  return createPortal(
    <div
      className={`photo-zoom-viewer${closing ? ' is-closing' : ''}`}
      data-swipe-lock="true"
      role="dialog"
      aria-modal="true"
      aria-label="Bilde i fullskjerm"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        backgroundColor: `rgba(0,0,0,${backdropOpacity * 0.94})`,
      }}
    >
      <button
        type="button"
        className="photo-zoom-viewer__close"
        onClick={(event) => {
          event.stopPropagation();
          triggerClose();
        }}
        aria-label="Lukk"
      >
        {'×'}
      </button>
      <img
        ref={imgRef}
        data-photo-zoom-img="true"
        className="photo-zoom-viewer__img"
        src={src}
        alt={alt}
        style={{
          transform: closing
            ? `translate(${startX}px, ${startY}px) scale(${startScale})`
            : `translate(${dragOffset.x + pan.x}px, ${dragOffset.y + pan.y}px) scale(${scale})`,
          opacity: closing ? 0 : 1 - dragProgress * 0.4,
          '--enter-x': `${startX}px`,
          '--enter-y': `${startY}px`,
          '--enter-scale': startScale,
        }}
        draggable={false}
      />
    </div>,
    document.body,
  );
}
