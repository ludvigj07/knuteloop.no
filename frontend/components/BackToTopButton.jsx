import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const SHOW_THRESHOLD = 800;

export function BackToTopButton({ scrollContainer = null }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const target = scrollContainer ?? window;

    function getScrollTop() {
      if (target === window) {
        return window.scrollY ?? document.documentElement.scrollTop ?? 0;
      }
      return target.scrollTop ?? 0;
    }

    function handleScroll() {
      setIsVisible(getScrollTop() > SHOW_THRESHOLD);
    }

    handleScroll();
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [scrollContainer]);

  function handleClick() {
    const target = scrollContainer ?? window;
    if (target === window) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } else {
      target.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  return (
    <button
      type="button"
      className={`back-to-top-btn${isVisible ? ' is-visible' : ''}`}
      onClick={handleClick}
      aria-label="Tilbake til toppen"
      tabIndex={isVisible ? 0 : -1}
    >
      <ArrowUp size={22} strokeWidth={2.4} />
    </button>
  );
}
