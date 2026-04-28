import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const VISIT_COUNT_KEY = 'pwa_visit_count';
const DISMISSED_KEY = 'pwa_install_dismissed';
const MIN_VISITS_BEFORE_PROMPT = 3;

function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari sets navigator.standalone — but der fyrer uansett ikke
  // beforeinstallprompt så vi viser ikke prompten på iOS.
  return Boolean(window.navigator?.standalone);
}

function readDismissed() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return true;
  }
}

function readAndIncrementVisitCount() {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(VISIT_COUNT_KEY);
    const previous = Number.isFinite(Number(raw)) ? Number(raw) : 0;
    const next = previous + 1;
    window.localStorage.setItem(VISIT_COUNT_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

export function PwaInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Inkrement visit count én gang per app-load.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (isStandalone()) return undefined;

    const count = readAndIncrementVisitCount();
    const dismissed = readDismissed();

    function handleBeforeInstall(event) {
      // Hindrer browser-default mini-banner.
      event.preventDefault();
      setDeferredEvent(event);

      if (!dismissed && count >= MIN_VISITS_BEFORE_PROMPT) {
        setIsVisible(true);
      }
    }

    function handleInstalled() {
      setIsVisible(false);
      setDeferredEvent(null);
      try {
        window.localStorage.setItem(DISMISSED_KEY, '1');
      } catch {
        // ignore
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  function handleDismiss() {
    setIsLeaving(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    window.setTimeout(() => {
      setIsVisible(false);
      setIsLeaving(false);
    }, 220);
  }

  async function handleAccept() {
    if (!deferredEvent) {
      setIsVisible(false);
      return;
    }
    try {
      deferredEvent.prompt();
      const { outcome } = (await deferredEvent.userChoice) ?? {};
      if (outcome === 'accepted' || outcome === 'dismissed') {
        try {
          window.localStorage.setItem(DISMISSED_KEY, '1');
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setDeferredEvent(null);
      setIsVisible(false);
    }
  }

  if (!isVisible || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`pwa-install-prompt${isLeaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-labelledby="pwa-install-title"
    >
      <div className="pwa-install-prompt__icon" aria-hidden="true">
        🪢
      </div>
      <div className="pwa-install-prompt__copy">
        <p id="pwa-install-title" className="pwa-install-prompt__title">
          Legg til Russeknute på hjem-skjermen?
        </p>
        <p className="pwa-install-prompt__sub">
          Raskere tilgang neste gang — ingen ekstra app å laste ned.
        </p>
        <div className="pwa-install-prompt__actions">
          <button
            type="button"
            className="pwa-install-prompt__btn pwa-install-prompt__btn--ghost"
            onClick={handleDismiss}
          >
            Senere
          </button>
          <button
            type="button"
            className="pwa-install-prompt__btn pwa-install-prompt__btn--primary"
            onClick={handleAccept}
          >
            Ja!
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
