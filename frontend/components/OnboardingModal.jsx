import { useState } from 'react';
import { createPortal } from 'react-dom';

const SLIDES = [
  {
    icon: '🪢',
    title: 'Velkommen til Russeknute!',
    body: 'Her samler vi alle russeknutene for kullet vårt på ett sted. Du kan sende inn knuter, se andres og følge med på hvem som leder.',
  },
  {
    icon: '📸',
    title: 'Send inn en knute',
    body: 'Gå til «Knuter»-fanen, trykk på en knute og last opp bevis. Du velger selv om du vil sende til godkjenning eller poste anonymt i feeden.',
  },
  {
    icon: '✨',
    title: 'Se alle knutene i feeden',
    body: 'I feeden ser du hva alle andre har postet. Du kan gi stjerner og kommentere, og følge med på hvem som har flest fullførte knuter.',
  },
  {
    icon: '👤',
    title: 'Din profil og dine knuter',
    body: 'Under «Profiler» finner du din og andres profiler. Her ser du alle fullførte knuter, badges og rangeringen din.',
  },
];

export function OnboardingModal({ isOpen, onComplete }) {
  const [slideIndex, setSlideIndex] = useState(0);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const isLast = slideIndex === SLIDES.length - 1;
  const slide = SLIDES[slideIndex];

  function handleNext() {
    if (isLast) {
      onComplete();
    } else {
      setSlideIndex((i) => i + 1);
    }
  }

  return createPortal(
    <div className="onboarding-backdrop" role="presentation">
      <div
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        data-swipe-lock="true"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="onboarding-modal__top">
          <button type="button" className="onboarding-skip" onClick={onComplete}>
            Hopp over
          </button>
        </div>

        <div className="onboarding-modal__slide" key={slideIndex}>
          <div className="onboarding-slide__icon" aria-hidden="true">
            {slide.icon}
          </div>
          <h2 id="onboarding-title" className="onboarding-slide__title">
            {slide.title}
          </h2>
          <p className="onboarding-slide__body">{slide.body}</p>
        </div>

        <div className="onboarding-modal__footer">
          <div className="onboarding-dots" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`onboarding-dot${i === slideIndex ? ' onboarding-dot--active' : ''}`}
              />
            ))}
          </div>
          <button type="button" className="action-button onboarding-cta" onClick={handleNext}>
            {isLast ? 'Kom i gang!' : 'Neste'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
