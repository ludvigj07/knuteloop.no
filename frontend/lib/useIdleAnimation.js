import { useEffect, useRef } from 'react';

const IDLE_EVENTS = [
  'mousemove',
  'touchstart',
  'keydown',
  'pointermove',
  'scroll',
  'click',
];

export function useIdleAnimation(callback, { timeout = 30000 } = {}) {
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);
  const lastTriggerRef = useRef(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    function clearTimer() {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleTrigger() {
      clearTimer();
      if (document.visibilityState !== 'visible') return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (document.visibilityState !== 'visible') return;
        lastTriggerRef.current = Date.now();
        try {
          callbackRef.current?.();
        } catch {
          // ignore
        }
        // Reschedule after firing
        scheduleTrigger();
      }, timeout);
    }

    function handleActivity() {
      // Don't reset within first 250ms after a trigger so animation can play
      if (Date.now() - lastTriggerRef.current < 250) return;
      scheduleTrigger();
    }

    function handleVisibility() {
      if (document.visibilityState !== 'visible') {
        clearTimer();
      } else {
        scheduleTrigger();
      }
    }

    IDLE_EVENTS.forEach((eventName) => {
      const isPassive = eventName === 'scroll' || eventName === 'touchstart';
      window.addEventListener(eventName, handleActivity, isPassive ? { passive: true } : false);
    });
    document.addEventListener('visibilitychange', handleVisibility);

    scheduleTrigger();

    return () => {
      clearTimer();
      IDLE_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [timeout]);
}
