import { useEffect, useMemo, useRef, useState } from 'react';

const MOBILE_BREAKPOINT = 900;
const SWIPE_THRESHOLD_RATIO = 0.18;
const SWIPE_VELOCITY_THRESHOLD = 0.45;
const EDGE_RESISTANCE = 0.32;

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
  const pageRefs = useRef(new Map());
  const suppressNextClickRef = useRef(false);
  const pointerStateRef = useRef({
    active: false,
    mode: 'idle',
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  });

  const [viewportWidth, setViewportWidth] = useState(0);
  const [pageHeights, setPageHeights] = useState({});
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
    if (!useSwipeNav) {
      return;
    }

    function collectHeights() {
      const nextHeights = {};

      pages.forEach((page) => {
        const element = pageRefs.current.get(page.id);
        if (!element) {
          return;
        }

        nextHeights[page.id] = Math.ceil(element.getBoundingClientRect().height);
      });

      setPageHeights((currentHeights) => {
        const currentKeys = Object.keys(currentHeights);
        const nextKeys = Object.keys(nextHeights);

        if (currentKeys.length !== nextKeys.length) {
          return nextHeights;
        }

        for (const key of nextKeys) {
          if (currentHeights[key] !== nextHeights[key]) {
            return nextHeights;
          }
        }

        return currentHeights;
      });
    }

    collectHeights();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(collectHeights);

    pages.forEach((page) => {
      const element = pageRefs.current.get(page.id);
      if (element) {
        observer.observe(element);
      }
    });

    window.addEventListener('resize', collectHeights);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', collectHeights);
    };
  }, [pages, useSwipeNav]);

  useEffect(() => {
    function handleResize() {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
      setViewportWidth(getViewportWidth(shellRef.current));
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setViewportWidth(getViewportWidth(shellRef.current));
  }, [pages.length, isMobileViewport]);

  function goToPage(pageId) {
    if (pageId === activePageId) {
      pulseHaptics(8);
      return;
    }

    pulseHaptics(10);
    onChangePage(pageId);
  }

  function resetPointerState() {
    pointerStateRef.current = {
      active: false,
      mode: 'idle',
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastTime: 0,
      velocityX: 0,
    };
    setDragOffset(0);
    setIsDragging(false);
  }

  function handlePointerDown(event) {
    if (!useSwipeNav || event.pointerType === 'mouse') {
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

  const trackTranslate = useSwipeNav
    ? -activeIndex * viewportWidth + dragOffset
    : 0;
  const activePage = pages[activeIndex];
  const activePageHeight = activePage ? pageHeights[activePage.id] ?? 0 : 0;
  const swipeDirection = dragOffset === 0 ? 0 : dragOffset < 0 ? 1 : -1;
  const adjacentPage = pages[clamp(activeIndex + swipeDirection, 0, pages.length - 1)];
  const adjacentPageHeight = adjacentPage
    ? pageHeights[adjacentPage.id] ?? activePageHeight
    : activePageHeight;
  const dragProgress =
    viewportWidth > 0 ? clamp(Math.abs(dragOffset) / viewportWidth, 0, 1) : 0;
  const viewportHeight =
    isDragging && swipeDirection !== 0
      ? Math.round(
          activePageHeight + (adjacentPageHeight - activePageHeight) * dragProgress,
        )
      : activePageHeight;
  const viewportStyle =
    useSwipeNav && viewportHeight > 0
      ? {
          height: `${viewportHeight}px`,
          transition: isDragging ? 'none' : 'height 0.22s ease',
        }
      : undefined;

  return (
    <div
      ref={shellRef}
      className={`swipe-tabs-shell ${useSwipeNav ? 'is-mobile-swipe' : 'is-desktop-nav'}`}
    >
      {useSwipeNav ? (
        <>
          <div
            className="swipe-tabs-shell__viewport"
            style={viewportStyle}
            onClickCapture={handleViewportClickCapture}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <div
              className={`swipe-tabs-shell__track ${
                isDragging ? 'is-dragging' : 'is-animating'
              }`}
              style={{
                transform: `translate3d(${trackTranslate}px, 0, 0)`,
              }}
            >
              {pages.map((page) => (
                <section
                  key={page.id}
                  ref={(element) => {
                    if (element) {
                      pageRefs.current.set(page.id, element);
                    } else {
                      pageRefs.current.delete(page.id);
                    }
                  }}
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
