import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const MOBILE_BREAKPOINT = 900;
const MOBILE_PAGE_GAP = 6;
const MOBILE_PAGE_PEEK = 4;
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

function shouldIgnoreSwipeStart(target) {
  return Boolean(
    target?.closest?.(
      [
        'input',
        'textarea',
        'select',
        'option',
        'label',
        '[contenteditable="true"]',
        '[contenteditable="plaintext-only"]',
        '[data-swipe-lock="true"]',
      ].join(', '),
    ),
  );
}

function scrollAppToTop(viewportElement) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const performScrollReset = () => {
    const scrollingElement = document.scrollingElement ?? document.documentElement;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    viewportElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  };

  performScrollReset();
  requestAnimationFrame(() => {
    performScrollReset();
    requestAnimationFrame(performScrollReset);
  });
}

function clearPointerInteraction(pointerStateRef, setDragOffset, setIsDragging) {
  pointerStateRef.current = createIdlePointerState();
  setDragOffset(0);
  setIsDragging(false);
}

export function SwipeTabsShell({
  pages,
  activePageId,
  onChangePage,
  renderPage,
  mobileOnlySwipe = true,
  hideNavigation = false,
}) {
  const shellRef = useRef(null);
  const viewportRef = useRef(null);
  const pageRefs = useRef(new Map());
  const suppressNextClickRef = useRef(false);
  const pointerStateRef = useRef(createIdlePointerState());

  const [viewportWidth, setViewportWidth] = useState(() => getViewportWidth(null));
  const [activePageHeight, setActivePageHeight] = useState(0);
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
  const pageWidth = Math.max(viewportWidth - MOBILE_PAGE_GAP - MOBILE_PAGE_PEEK, 0);
  const pageAdvance = pageWidth + MOBILE_PAGE_GAP;

  function syncViewportWidth() {
    setViewportWidth(getViewportWidth(viewportRef.current ?? shellRef.current));
  }

  useEffect(() => {
    function handleResize() {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
      syncViewportWidth();
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    syncViewportWidth();
  }, [pages.length, isMobileViewport]);

  useLayoutEffect(() => {
    if (!useSwipeNav) {
      return undefined;
    }

    const measureActivePage = () => {
      const element = pageRefs.current.get(activePageId);
      const nextHeight = element
        ? Math.ceil(
            Math.max(
              element.getBoundingClientRect().height,
              element.scrollHeight,
              element.offsetHeight,
            ),
          )
        : 0;
      setActivePageHeight((currentHeight) =>
        currentHeight !== nextHeight ? nextHeight : currentHeight,
      );
    };

    measureActivePage();
    const initialFrame = requestAnimationFrame(measureActivePage);
    const delayedFrame = requestAnimationFrame(() => {
      requestAnimationFrame(measureActivePage);
    });
    window.addEventListener('resize', measureActivePage);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measureActivePage);
      const activeElement = pageRefs.current.get(activePageId);
      if (activeElement) {
        observer.observe(activeElement);
      }
    }

    const intervalId = window.setInterval(measureActivePage, 350);

    return () => {
      cancelAnimationFrame(initialFrame);
      cancelAnimationFrame(delayedFrame);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', measureActivePage);
      observer?.disconnect();
    };
  }, [activePageId, pages.length, useSwipeNav]);

  useEffect(() => {
    if (!useSwipeNav) {
      return undefined;
    }

    const handleWindowBlur = () => {
      clearPointerInteraction(pointerStateRef, setDragOffset, setIsDragging);
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
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
    scrollAppToTop(viewportRef.current);
  }

  function resetPointerState() {
    clearPointerInteraction(pointerStateRef, setDragOffset, setIsDragging);
  }

  function handlePointerDown(event) {
    if (!useSwipeNav || event.pointerType === 'mouse') {
      return;
    }

    // Keep swipe disabled over true text/form controls so typing, selecting
    // and file picking are never hijacked. Buttons and links are allowed:
    // once horizontal intent is confirmed we suppress the click in capture,
    // which restores the "swipe anywhere" feel on mobile-heavy screens.
    if (shouldIgnoreSwipeStart(event.target)) {
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

    event.preventDefault();

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
    const releaseX =
      typeof event.clientX === 'number' ? event.clientX : pointerState.lastX;

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

    const deltaX = releaseX - pointerState.startX;
    const absDeltaX = Math.abs(deltaX);
    const threshold = Math.max(pageAdvance * SWIPE_THRESHOLD_RATIO, 48);
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
      scrollAppToTop(viewportRef.current);
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
  const trackTranslate = useSwipeNav
    ? -activeIndex * pageAdvance + effectiveDragOffset
    : 0;
  const mobileViewportStyle =
    useSwipeNav && activePageHeight > 0
      ? {
          height: `${activePageHeight}px`,
          transition: isDragging ? 'none' : 'height 0.22s ease',
        }
      : undefined;
  const mobilePageStyle = useSwipeNav
    ? {
        width: `${pageWidth}px`,
        flexBasis: `${pageWidth}px`,
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
            ref={viewportRef}
            className="swipe-tabs-shell__viewport"
            style={mobileViewportStyle}
            onClickCapture={handleViewportClickCapture}
            onPointerDownCapture={handlePointerDown}
            onPointerMoveCapture={handlePointerMove}
            onPointerUpCapture={handlePointerEnd}
            onPointerCancelCapture={handlePointerEnd}
          >
            <div
              className={`swipe-tabs-shell__track ${
                isDragging ? 'is-dragging' : 'is-animating'
              }`}
              style={{
                transform: `translate3d(${trackTranslate}px, 0, 0)`,
                gap: `${MOBILE_PAGE_GAP}px`,
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
                  style={mobilePageStyle}
                  aria-hidden={activePageId !== page.id}
                >
                  {renderPage(page)}
                </section>
              ))}
            </div>
          </div>

          {!hideNavigation ? (
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
                      <span className="bottom-swipe-nav__label">
                        {page.shortLabel ?? page.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </>
      ) : (
        <>
          {!hideNavigation ? (
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
          ) : null}

          <div className="desktop-segmented-nav__content">
            {renderPage(pages[activeIndex])}
          </div>
        </>
      )}
    </div>
  );
}
