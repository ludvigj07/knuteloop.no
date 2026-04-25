import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const STEPS = [
  {
    id: 'welcome',
    kind: 'modal',
    icon: '🪢',
    title: 'Heisann! Velkommen til Russeknute',
    body: 'Vi tar en kjapp tur så du vet hvor det viktigste er. Det tar 20 sekunder.',
    cta: 'Vis meg!',
  },
  {
    id: 'tab-knuter',
    kind: 'spotlight',
    target: '[data-tour-id="tab-knuter"]',
    title: 'Knutene dine',
    body: 'Her er alle knutene du kan ta — bla i listen og velg den du vil prøve.',
    cta: 'Skjønner!',
    requiresPage: 'knuter',
  },
  {
    id: 'first-knot-register',
    kind: 'spotlight',
    target: '[data-tour-id="first-knot"] .knot-row__doc-btn',
    fallbackTarget: '[data-tour-id="first-knot"]',
    title: 'Sånn registrerer du',
    body: 'Trykk på kamera-knappen for å laste opp bilde eller video som bevis. Det er alt.',
    cta: 'Skjønner!',
    requiresPage: 'knuter',
  },
  {
    id: 'tab-leaderboard',
    kind: 'spotlight',
    target: '[data-tour-id="tab-leaderboard"]',
    title: 'Hvor står du?',
    body: 'Sjekk topplisten for å se hvem som leder kullet. Hver knute gir deg et puff oppover — gull-knutene løfter litt ekstra.',
    cta: 'Skjønner!',
    requiresPage: 'leaderboard',
  },
  {
    id: 'tab-feed',
    kind: 'spotlight',
    target: '[data-tour-id="tab-feed"]',
    title: 'Feeden',
    body: 'Her ser du innsendinger fra andre russ — gi stjerner og kommentarer.',
    cta: 'Skjønner!',
    requiresPage: 'feed',
  },
  {
    id: 'done',
    kind: 'modal',
    icon: '🎉',
    title: 'Du er klar!',
    body: 'Lykke til. Dagens knute finner du på hjem-siden — bare å gå i gang.',
    cta: 'Kom i gang!',
  },
];

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 28;
const ARROW_GAP = 8;
const VIEWPORT_MARGIN = 16;

function getViewport() {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function ArrowPointer({ direction }) {
  return (
    <div className={`tour-arrow tour-arrow--${direction}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M32 6 L32 52 M14 36 L32 54 L50 36"
          stroke="#0f172a"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M32 6 L32 52 M14 36 L32 54 L50 36"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function ModalView({ step, onAdvance, onSkip, isFirst }) {
  return (
    <div
      className="tour-backdrop tour-backdrop--modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="tour-modal">
        {!isFirst ? null : (
          <button type="button" className="tour-skip" onClick={onSkip}>
            Hopp over
          </button>
        )}
        <div className="tour-modal__icon" aria-hidden="true">
          {step.icon}
        </div>
        <h2 id="tour-title" className="tour-modal__title">
          {step.title}
        </h2>
        <p className="tour-modal__body">{step.body}</p>
        <button type="button" className="tour-cta" onClick={onAdvance}>
          {step.cta}
        </button>
      </div>
    </div>
  );
}

function SpotlightView({ step, rect, viewport, onAdvance, onSkip, stepIndex, totalSteps }) {
  const padded = {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };

  const targetCenterY = rect.top + rect.height / 2;
  const placeAbove = targetCenterY > viewport.height / 2;

  const tooltipMaxWidth = Math.min(viewport.width - VIEWPORT_MARGIN * 2, 340);
  const tooltipLeftRaw = rect.left + rect.width / 2 - tooltipMaxWidth / 2;
  const tooltipLeft = Math.max(
    VIEWPORT_MARGIN,
    Math.min(tooltipLeftRaw, viewport.width - tooltipMaxWidth - VIEWPORT_MARGIN),
  );

  const arrowDirection = placeAbove ? 'down' : 'up';
  const ARROW_HEIGHT = 64;

  let arrowStyle;
  let tooltipStyle;

  if (placeAbove) {
    const arrowBottom = viewport.height - padded.top + ARROW_GAP;
    arrowStyle = {
      bottom: `${arrowBottom}px`,
      left: `${rect.left + rect.width / 2}px`,
    };
    tooltipStyle = {
      bottom: `${arrowBottom + ARROW_HEIGHT + TOOLTIP_GAP}px`,
      left: `${tooltipLeft}px`,
      width: `${tooltipMaxWidth}px`,
    };
  } else {
    const arrowTop = padded.top + padded.height + ARROW_GAP;
    arrowStyle = {
      top: `${arrowTop}px`,
      left: `${rect.left + rect.width / 2}px`,
    };
    tooltipStyle = {
      top: `${arrowTop + ARROW_HEIGHT + TOOLTIP_GAP}px`,
      left: `${tooltipLeft}px`,
      width: `${tooltipMaxWidth}px`,
    };
  }

  const maskTopHeight = Math.max(padded.top, 0);
  const maskBottomTop = padded.top + padded.height;
  const maskBottomHeight = Math.max(viewport.height - maskBottomTop, 0);
  const maskLeftWidth = Math.max(padded.left, 0);
  const maskRightLeft = padded.left + padded.width;
  const maskRightWidth = Math.max(viewport.width - maskRightLeft, 0);

  return (
    <div className="tour-backdrop tour-backdrop--spotlight" role="dialog" aria-modal="true">
      <div
        className="tour-mask tour-mask--top"
        style={{ top: 0, left: 0, right: 0, height: `${maskTopHeight}px` }}
      />
      <div
        className="tour-mask tour-mask--bottom"
        style={{
          top: `${maskBottomTop}px`,
          left: 0,
          right: 0,
          height: `${maskBottomHeight}px`,
        }}
      />
      <div
        className="tour-mask tour-mask--left"
        style={{
          top: `${padded.top}px`,
          left: 0,
          width: `${maskLeftWidth}px`,
          height: `${padded.height}px`,
        }}
      />
      <div
        className="tour-mask tour-mask--right"
        style={{
          top: `${padded.top}px`,
          left: `${maskRightLeft}px`,
          width: `${maskRightWidth}px`,
          height: `${padded.height}px`,
        }}
      />

      <div
        className="tour-spotlight"
        style={{
          top: `${padded.top}px`,
          left: `${padded.left}px`,
          width: `${padded.width}px`,
          height: `${padded.height}px`,
        }}
      />

      <div className="tour-arrow-wrap" style={arrowStyle}>
        <ArrowPointer direction={arrowDirection} />
      </div>

      <div className="tour-tooltip" style={tooltipStyle}>
        <div className="tour-tooltip__progress" aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`tour-tooltip__dot${i === stepIndex ? ' is-active' : ''}`}
            />
          ))}
        </div>
        <h3 className="tour-tooltip__title">{step.title}</h3>
        <p className="tour-tooltip__body">{step.body}</p>
        <div className="tour-tooltip__actions">
          <button type="button" className="tour-skip" onClick={onSkip}>
            Hopp over
          </button>
          <button type="button" className="tour-cta tour-cta--compact" onClick={onAdvance}>
            {step.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveOnboarding({ isOpen, onComplete, currentPage, onChangePage }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [measurement, setMeasurement] = useState(null);
  const [viewport, setViewport] = useState(getViewport);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const rect = measurement?.stepId === step.id ? measurement.rect : null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = () => setViewport(getViewport());
    handler();
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const preventUserScroll = (event) => {
      if (event.target?.closest?.('.tour-tooltip, .tour-modal')) return;
      event.preventDefault();
    };

    document.addEventListener('wheel', preventUserScroll, { passive: false });
    document.addEventListener('touchmove', preventUserScroll, { passive: false });

    return () => {
      document.removeEventListener('wheel', preventUserScroll);
      document.removeEventListener('touchmove', preventUserScroll);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (step.kind !== 'spotlight') return;
    if (step.requiresPage && currentPage !== step.requiresPage) {
      onChangePage(step.requiresPage);
    }
  }, [isOpen, step, currentPage, onChangePage]);

  useLayoutEffect(() => {
    if (!isOpen || step.kind !== 'spotlight') {
      return undefined;
    }

    let cancelled = false;
    let frameId = 0;
    let timerId = 0;
    let attempts = 0;
    let observer = null;
    let hasScrolled = false;
    const MAX_ATTEMPTS = 120;

    const updateFor = (targetEl) => {
      if (cancelled || !targetEl) return;
      const r = targetEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setMeasurement({
          stepId: step.id,
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
        });
      }
    };

    const scrollTargetIntoView = (targetEl) => {
      if (targetEl.closest('.bottom-swipe-nav')) return;
      const r = targetEl.getBoundingClientRect();
      const vh = window.innerHeight;
      const desiredTop = vh * 0.25;
      const delta = r.top - desiredTop;
      if (Math.abs(delta) > 8) {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      }
    };

    const measure = () => {
      if (cancelled) return;
      const targetEl =
        document.querySelector(step.target) ??
        (step.fallbackTarget ? document.querySelector(step.fallbackTarget) : null);

      if (targetEl) {
        if (!hasScrolled) {
          hasScrolled = true;
          scrollTargetIntoView(targetEl);
        }

        updateFor(targetEl);

        if (typeof ResizeObserver !== 'undefined' && !observer) {
          observer = new ResizeObserver(() => updateFor(targetEl));
          observer.observe(targetEl);
        }

        timerId = window.setTimeout(() => updateFor(targetEl), 480);
        return;
      }

      if (attempts < MAX_ATTEMPTS) {
        attempts += 1;
        frameId = requestAnimationFrame(measure);
      }
    };

    measure();

    const onScrollOrResize = () => measure();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (timerId) window.clearTimeout(timerId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, step, currentPage]);

  function handleAdvance() {
    if (isLast) {
      setStepIndex(0);
      setMeasurement(null);
      onComplete();
      return;
    }

    const nextIndex = stepIndex + 1;
    const nextStep = STEPS[nextIndex];

    if (step.advanceTo && currentPage !== step.advanceTo) {
      onChangePage(step.advanceTo);
    }
    if (
      nextStep?.requiresPage &&
      currentPage !== nextStep.requiresPage &&
      step.advanceTo !== nextStep.requiresPage
    ) {
      onChangePage(nextStep.requiresPage);
    }

    setStepIndex(nextIndex);
  }

  function handleSkip() {
    setStepIndex(0);
    setMeasurement(null);
    onComplete();
  }

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  if (step.kind === 'modal') {
    return createPortal(
      <ModalView
        step={step}
        onAdvance={handleAdvance}
        onSkip={handleSkip}
        isFirst={isFirst}
      />,
      document.body,
    );
  }

  if (!rect) {
    return createPortal(
      <div
        className="tour-backdrop tour-backdrop--loading"
        role="dialog"
        aria-modal="true"
        onClick={handleAdvance}
      />,
      document.body,
    );
  }

  return createPortal(
    <SpotlightView
      step={step}
      rect={rect}
      viewport={viewport}
      onAdvance={handleAdvance}
      onSkip={handleSkip}
      stepIndex={stepIndex}
      totalSteps={STEPS.length}
    />,
    document.body,
  );
}
