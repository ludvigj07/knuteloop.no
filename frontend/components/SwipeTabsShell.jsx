import { useEffect, useMemo, useRef, useState } from 'react';

const MOBILE_BREAKPOINT = 900;
const SWIPE_THRESHOLD_RATIO = 0.18;
const SWIPE_VELOCITY_THRESHOLD = 0.45;
const EDGE_RESISTANCE = 0.32;

function createIdlePointerState() {
  return {
    active: false,
    mode: 'idle',
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  };
}

function supportsHaptics() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function pulseHaptics(duration = 10) {
  if (supportsHaptics()) {
    navigator.vibrate(duration);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getViewportWidth(element) {
  if (!element) {
    return typeof window !== 'undefined' ? window.innerWidth : 0;
  }

  return element.getBoundingClientRect().width;
}

export function SwipeTabsShell({
  pages,
  activePageId,
  onChangePage,
  renderPage,
  mobileOnlySwipe = true,
}) {
  const shellRef = useRef(null);
  const viewportRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const pointerStateRef = useRef(createIdlePointerState());

  const [viewportWidth, setViewportWidth] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.innerWidth <= MOBILE_BREAKPOINT;
  });
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const pageIndexById = useMemo(
    () =>
      pages.reduce((accumulator, page, index) => {
        accumulator[page.id] = index;
        return accumulator;
      }, {}),
    [pages],
  );
  const activeIndex = pageIndexById[activePageId] ?? 0;
  const useSwipeNav = !mobileOnlySwipe || isMobileViewport;

  useEffect(() => {
    function handleResize() {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
      setViewportWidth(getViewportWidth(viewportRef.current ?? shellRef.current));
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setViewportWidth(getViewportWidth(viewportRef.current ?? shellRef.current));
  }, [pages.length, isMobileViewport]);

  useEffect(() => {
    if (!useSwipeNav) return undefined;

    const abortDrag = () => {
      pointerStateRef.current = createIdlePointerState();
      setIsDragging(false);
      setDragOffset(0);
    };

    window.addEventListener('pointerup', abortDrag);
    window.addEventListener('pointercancel', abortDrag);
    window.addEventListener('blur', abortDrag);

    return () => {
      window.removeEventListener('pointerup', abortDrag);
      window.removeEventListener('pointercancel', abortDrag);
      window.removeEventListener('blur', abortDrag);
    };
  }, [useSwipeNav]);

  function goToPage(pageId) {
    resetPointerState();

    if (pageId === activePageId) {
      pulseHaptics(8);
      return;
    }

    pulseHaptics(10);
    onChangePage(pageId);
  }

  function resetPointerState() {
    pointerStateRef.current = createIdlePointerState();
    setDragOffset(0);
    setIsDragging(false);
  }

  function handlePointerDown(event) {
    if (!useSwipeNav || event.pointerType === 'mouse') {
      return;
    }

    // Skip swipe tracking when the user taps an interactive control (buttons,
    // inputs, labels wrapping inputs). This prevents iOS from firing a fake
    // swipe when the camera/file picker returns control to the page.
    if (
      event.target?.closest?.(
        'input, textarea, select, label, button, a, [role="button"]',
      )
    ) {
      return;
    }

    // Don't capture the pointer yet — wait for confirmed horizontal intent.
    // This lets taps on buttons work normally while still detecting swipes.
    suppressNextClickRef.current = false;
    pointerStateRef.current = {
      active: true,
      mode: 'pending',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
    };
  }

  function handlePointerMove(event) {
    const pointerState = pointerStateRef.current;

    if (!useSwipeNav || !pointerState.active || pointerState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - pointerState.startX;
    const deltaY = event.clientY - pointerState.startY;

    if (pointerState.mode === 'pending') {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        return;
      }

      if (Math.abs(deltaX) <= Math.abs(deltaY)) {
        pointerStateRef.current = {
          ...pointerState,
          active: false,
          mode: 'vertical',
        };
        return;
      }

      // Confirmed horizontal swipe intent — lock the pointer NOW so the drag
      // tracks smoothly even when the finger moves over buttons or other
      // interactive children. Any pending tap is cancelled via
      // suppressNextClickRef + the capture-phase click handler below.
      if (event.currentTarget?.setPointerCapture) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Ignore pointer capture failures on unsupported browsers/devices.
        }
      }

      pointerState.mode = 'horizontal';
      suppressNextClickRef.current = true;
      setIsDragging(true);
    }

    if (pointerState.mode !== 'horizontal') {
      return;
    }

    const now = performance.now();
    const elapsed = Math.max(now - pointerState.lastTime, 1);
    pointerState.velocityX = (event.clientX - pointerState.lastX) / elapsed;
    pointerState.lastX = event.clientX;
    pointerState.lastTime = now;

    let nextOffset = deltaX;

    if ((activeIndex === 0 && deltaX > 0) || (activeIndex === pages.length - 1 && deltaX < 0)) {
      nextOffset *= EDGE_RESISTANCE;
    }

    setDragOffset(nextOffset);
  }

  function handlePointerEnd(event) {
    const pointerState = pointerStateRef.current;

    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }
    }

    if (!useSwipeNav || pointerState.pointerId !== event.pointerId) {
      return;
    }

    if (pointerState.mode !== 'horizontal') {
      resetPointerState();
      return;
    }

    const deltaX = event.clientX - pointerState.startX;
    const absDeltaX = Math.abs(deltaX);
    const threshold = Math.max(viewportWidth * SWIPE_THRESHOLD_RATIO, 48);
    const nextIndexByDistance =
      absDeltaX > threshold
        ? deltaX < 0
          ? activeIndex + 1
          : activeIndex - 1
        : activeIndex;
    const nextIndexByVelocity =
      Math.abs(pointerState.velocityX) > SWIPE_VELOCITY_THRESHOLD
        ? pointerState.velocityX < 0
          ? activeIndex + 1
          : activeIndex - 1
        : activeIndex;
    const desiredIndex =
      nextIndexByVelocity !== activeIndex ? nextIndexByVelocity : nextIndexByDistance;
    const clampedIndex = clamp(desiredIndex, 0, pages.length - 1);

    if (clampedIndex !== activeIndex) {
      pulseHaptics(12);
      onChangePage(pages[clampedIndex].id);
    }

    resetPointerState();
  }

  function handleViewportClickCapture(event) {
    if (!suppressNextClickRef.current) {
      return;
    }

    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  const effectiveDragOffset = isDragging ? dragOffset : 0;
  const trackTransform = useSwipeNav
    ? `translate3d(calc(${-activeIndex * 100}% + ${effectiveDragOffset}px), 0, 0)`
    : 'translate3d(0, 0, 0)';

  return (
    <div
      ref={shellRef}
      className={`swipe-tabs-shell ${useSwipeNav ? 'is-mobile-swipe' : 'is-desktop-nav'}`}
    >
      {useSwipeNav ? (
        <>
          <div
            ref={viewportRef}
            className="swipe-tabs-shell__viewport"
            onClickCapture={handleViewportClickCapture}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={resetPointerState}
          >
            <div
              className={`swipe-tabs-shell__track ${
                isDragging ? 'is-dragging' : 'is-animating'
              }`}
              style={{
                transform: trackTransform,
              }}
            >
              {pages.map((page) => (
                <section
                  key={page.id}
                  className={`swipe-tabs-shell__page ${
                    activePageId === page.id ? 'is-active' : ''
                  }`}
                  aria-hidden={activePageId === page.id ? 'false' : 'true'}
                >
                  {renderPage(page)}
                </section>
              ))}
            </div>
          </div>

          <nav className="bottom-swipe-nav" aria-label="Hovednavigasjon">
            <div
              className="bottom-swipe-nav__grid"
              style={{
                gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))`,
              }}
            >
            {pages.map((page) => {
              const isActive = page.id === activePageId;

              return (
                <button
                  key={page.id}
                  type="button"
                  className={`bottom-swipe-nav__button ${isActive ? 'is-active' : ''}`}
                  onClick={() => goToPage(page.id)}
                >
                  <span className="bottom-swipe-nav__icon" aria-hidden="true">
                    {page.icon}
                  </span>
                  <span className="bottom-swipe-nav__label">{page.shortLabel ?? page.label}</span>
                </button>
              );
            })}
            </div>
          </nav>
        </>
      ) : (
        <>
          <nav className="desktop-segmented-nav" aria-label="Hovednavigasjon">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                className={`desktop-segmented-nav__button ${
                  page.id === activePageId ? 'is-active' : ''
                }`}
                onClick={() => goToPage(page.id)}
              >
                <span aria-hidden="true">{page.icon}</span>
                <span>{page.label}</span>
              </button>
            ))}
          </nav>

          <div className="desktop-segmented-nav__content">
            {renderPage(pages[activeIndex])}
          </div>
        </>
      )}
    </div>
  );
}
