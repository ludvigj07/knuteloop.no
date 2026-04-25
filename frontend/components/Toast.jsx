import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Liten "snackbar" som vises nederst på skjermen og forsvinner av seg selv.
// Brukes som bekreftelse etter handlinger som å sende inn en knute.
export function Toast({ message, type = 'success', durationMs = 3200, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return undefined;
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), durationMs);
    const remove = window.setTimeout(() => {
      onClose?.();
    }, durationMs + 240);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
  }, [message, durationMs, onClose]);

  if (!message || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`toast toast--${type} ${visible ? 'is-visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast__icon" aria-hidden="true">
        {type === 'success' ? '✓' : type === 'error' ? '!' : '•'}
      </span>
      <span className="toast__message">{message}</span>
    </div>,
    document.body,
  );
}
