import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const MOBILE_BREAKPOINT = 900;
const MOBILE_PAGE_GAP = 0;
const MOBILE_PAGE_PEEK = 0;
const SWIPE_THRESHOLD_RATIO = 0.18;
const SWIPE_VELOCITY_THRESHOLD = 0.45;
const EDGE_RESISTANCE = 0.32;
const SETTLE_TRANSITION = 'transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

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

export function SwipeTabsShell({
  pages,
  activePageId,
  onChangePage,
  onPageSettled,
  renderPage,
  mobileOnlySwipe = true,
  hideNavigation = false,
}) {
  const shellRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const pageRefs = useRef(new Map());
  const suppressNextClickRef = useRef(false);
  const pointerStateRef = useRef(createIdlePointerState());
  const isDraggingRef = useRef(false);

  // Refs so event handlers always see current values without stale closures
  const activeIndexRef = useRef(0);
  const pageAdvanceRef = useRef(0);
  const pageLengthRef = useRef(pages.length);
  // Keep latest props/handlers accessible inside native event listeners
  const onChangePageRef = useRef(onChangePage);
  const pagesRef = useRef(pages);
  onChangePageRef.current = onChangePage;
  pagesRef.current = pages;

  const [viewportWidth, setViewportWidth] = useState(() => getViewportWidth(null));
  const [activePageHeight, setActivePageHeight] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

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

  // Keep refs in sync with derived values
  activeIndexRef.current = activeIndex;
  pageAdvanceRef.current = pageAdvance;
  pageLengthRef.current = pages.length;

  // Apply track transform directly to DOM — no React state involved
  function applyTrackTransform(dragOffset = 0, animated = false) {
    if (!trackRef.current) return;
    const translate = -activeIndexRef.current * pageAdvanceRef.current + dragOffset;
    trackRef.current.style.transition = animated ? SETTLE_TRANSITION : 'none';
    trackRef.current.style.transform = `translate3d(${translate}px, 0, 0)`;
  }

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
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    syncViewportWidth();
  }, [pages.length, isMobileViewport]);

  // Snap track to active page whenever index or width changes
  useLayoutEffect(() => {
    if (!useSwipeNav || isDraggingRef.current) return;
    applyTrackTransform(0, false);
  }, [activeIndex, pageAdvance, useSwipeNav]);

  // Measure active page height (ResizeObserver only — no polling interval)
  useLayoutEffect(() => {
    if (!useSwipeNav) return undefined;

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
      setActivePageHeight((h) => (h !== nextHeight ? nextHeight : h));
    };

    measureActivePage();
    const frame = requestAnimationFrame(measureActivePage);
    window.addEventListener('resize', measureActivePage);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measureActivePage);
      const activeElement = pageRefs.current.get(activePageId);
      if (activeElement) observer.observe(activeElement);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measureActivePage);
      observer?.disconnect();
    };
  }, [activePageId, pages.length, useSwipeNav]);

  useEffect(() => {
    if (!useSwipeNav) return undefined;
    const handleWindowBlur = () => {
      pointerStateRef.current = createIdlePointerState();
      isDraggingRef.current = false;
      applyTrackTransform(0, true);
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [useSwipeNav]);

  // Attach pointer events as native listeners so we can use { passive: true }.
  // With touch-action: pan-y on the viewport, the browser handles vertical scroll
  // on the compositor thread without waiting for JS — eliminating frame stalls.
  useEffect(() => {
    if (!useSwipeNav) return undefined;
    const el = viewportRef.current;
    if (!el) return undefined;

    const onDown = (e) => handlePointerDown(e);
    const onMove = (e) => handlePointerMove(e);
    const onEnd = (e) => handlePointerEnd(e);
    const onClick = (e) => handleViewportClickCapture(e);

    el.addEventListener('pointerdown', onDown, { passive: true });
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerup', onEnd, { passive: true });
    el.addEventListener('pointercancel', onEnd, { passive: true });
    el.addEventListener('click', onClick, { capture: true });

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
      el.removeEventListener('click', onClick, { capture: true });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSwipeNav]);

  useEffect(() => {
    if (typeof onPageSettled !== 'function') return undefined;
    const settleDelay = useSwipeNav ? 220 : 0;
    const timer = window.setTimeout(() => onPageSettled(activePageId), settleDelay);
    return () => window.clearTimeout(timer);
  }, [activePageId, onPageSettled, useSwipeNav]);

  function goToPage(pageId) {
    pointerStateRef.current = createIdlePointerState();
    isDraggingRef.current = false;

    if (pageId === activePageId) {
      pulseHaptics(8);
      return;
    }

    pulseHaptics(10);
    onChangePage(pageId);
    scrollAppToTop(viewportRef.current);
  }

  function handlePointerDown(event) {
    if (!useSwipeNav || event.pointerType === 'mouse') return;
    if (shouldIgnoreSwipeStart(event.target)) return;

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
    if (!useSwipeNav || !pointerState.active || pointerState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - pointerState.startX;
    const deltaY = event.clientY - pointerState.startY;

    if (pointerState.mode === 'pending') {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

      if (Math.abs(deltaX) <= Math.abs(deltaY)) {
        pointerStateRef.current = { ...pointerState, active: false, mode: 'vertical' };
        return;
      }

      if (viewportRef.current?.setPointerCapture) {
        try {
          viewportRef.current.setPointerCapture(event.pointerId);
        } catch { /* ignore */ }
      }

      pointerState.mode = 'horizontal';
      suppressNextClickRef.current = true;
      isDraggingRef.current = true;
      if (trackRef.current) trackRef.current.classList.add('is-dragging');
    }

    if (pointerState.mode !== 'horizontal') return;

    const now = performance.now();
    const elapsed = Math.max(now - pointerState.lastTime, 1);
    pointerState.velocityX = (event.clientX - pointerState.lastX) / elapsed;
    pointerState.lastX = event.clientX;
    pointerState.lastTime = now;

    const ai = activeIndexRef.current;
    const pl = pageLengthRef.current;
    let nextOffset = deltaX;
    if ((ai === 0 && deltaX > 0) || (ai === pl - 1 && deltaX < 0)) {
      nextOffset *= EDGE_RESISTANCE;
    }

    // Direct DOM update — zero React re-renders during drag
    applyTrackTransform(nextOffset, false);
  }

  function handlePointerEnd(event) {
    const pointerState = pointerStateRef.current;
    const releaseX = typeof event.clientX === 'number' ? event.clientX : pointerState.lastX;

    if (viewportRef.current?.hasPointerCapture?.(event.pointerId)) {
      try {
        viewportRef.current.releasePointerCapture(event.pointerId);
      } catch { /* ignore */ }
    }

    if (!useSwipeNav || pointerState.pointerId !== event.pointerId) return;

    if (pointerState.mode !== 'horizontal') {
      pointerStateRef.current = createIdlePointerState();
      isDraggingRef.current = false;
      return;
    }

    const deltaX = releaseX - pointerState.startX;
    const absDeltaX = Math.abs(deltaX);
    const pa = pageAdvanceRef.current;
    const ai = activeIndexRef.current;
    const pl = pageLengthRef.current;
    const threshold = Math.max(pa * SWIPE_THRESHOLD_RATIO, 48);

    const nextIndexByDistance =
      absDeltaX > threshold ? (deltaX < 0 ? ai + 1 : ai - 1) : ai;
    const nextIndexByVelocity =
      Math.abs(pointerState.velocityX) > SWIPE_VELOCITY_THRESHOLD
        ? pointerState.velocityX < 0 ? ai + 1 : ai - 1
        : ai;
    const desiredIndex = nextIndexByVelocity !== ai ? nextIndexByVelocity : nextIndexByDistance;
    const clampedIndex = clamp(desiredIndex, 0, pl - 1);

    pointerStateRef.current = createIdlePointerState();
    isDraggingRef.current = false;
    if (trackRef.current) trackRef.current.classList.remove('is-dragging');

    if (clampedIndex !== ai) {
      // Animate to new page position before React updates activeIndex
      const newTranslate = -clampedIndex * pa;
      if (trackRef.current) {
        trackRef.current.style.transition = SETTLE_TRANSITION;
        trackRef.current.style.transform = `translate3d(${newTranslate}px, 0, 0)`;
      }
      pulseHaptics(12);
      onChangePageRef.current(pagesRef.current[clampedIndex].id);
      scrollAppToTop(viewportRef.current);
    } else {
      // Snap back to current page with animation
      applyTrackTransform(0, true);
    }
  }

  function handleViewportClickCapture(event) {
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  const mobileViewportStyle =
    useSwipeNav && activePageHeight > 0
      ? { height: `${activePageHeight}px`, transition: 'height 0.22s ease' }
      : undefined;

  const mobilePageStyle = useSwipeNav
    ? { width: `${pageWidth}px`, flexBasis: `${pageWidth}px` }
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
          >
            <div
              ref={trackRef}
              className="swipe-tabs-shell__track is-animating"
              style={{
                transform: `translate3d(${-activeIndex * pageAdvance}px, 0, 0)`,
                gap: `${MOBILE_PAGE_GAP}px`,
                willChange: 'transform',
              }}
            >
              {pages.map((page, index) => {
                const isActive = page.id === activePageId;
                const isAdjacent = Math.abs(index - activeIndex) <= 1;
                return (
                  <section
                    key={page.id}
                    ref={(element) => {
                      if (element) pageRefs.current.set(page.id, element);
                      else pageRefs.current.delete(page.id);
                    }}
                    className={`swipe-tabs-shell__page ${
                      page.id === 'feed' ? 'swipe-tabs-shell__page--feed' : ''
                    } ${isActive ? 'is-active' : ''}`}
                    style={{
                      ...mobilePageStyle,
                      contentVisibility: isAdjacent ? 'visible' : 'auto',
                    }}
                    aria-hidden={!isActive}
                  >
                    {renderPage(page)}
                  </section>
                );
              })}
            </div>
          </div>

          {!hideNavigation ? (
            <nav className="bottom-swipe-nav" aria-label="Hovednavigasjon">
              <div
                className="bottom-swipe-nav__grid"
                style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }}
              >
                {pages.map((page) => {
                  const isActive = page.id === activePageId;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      className={`bottom-swipe-nav__button ${isActive ? 'is-active' : ''}`}
                      aria-label={page.shortLabel ?? page.label}
                      onClick={() => goToPage(page.id)}
                    >
                      <span className="bottom-swipe-nav__icon" aria-hidden="true">
                        {page.icon}
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
