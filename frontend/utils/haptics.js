// Lett haptic-feedback-utility for mobil
// Bruk sparsomt: smaa pulser ved viktige handlinger (submit, like, vinn, feil)

let _hapticsEnabled = true;

export function setHapticsEnabled(enabled) {
  _hapticsEnabled = !!enabled;
  try {
    localStorage.setItem('knuteloop:haptics', enabled ? '1' : '0');
  } catch {}
}

export function getHapticsEnabled() {
  try {
    const stored = localStorage.getItem('knuteloop:haptics');
    if (stored === '0') return false;
  } catch {}
  return _hapticsEnabled;
}

function supports() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    getHapticsEnabled()
  );
}

function vibrate(pattern) {
  if (!supports()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignorer — noen nettlesere blokkerer uten brukerinteraksjon */
  }
}

// Forhaandsdefinerte monstre — hold dem korte
export const haptics = {
  /** Lett tap, f.eks. nav-skifte, knappetrykk */
  light: () => vibrate(8),
  /** Medium, f.eks. like, kommentar sendt */
  medium: () => vibrate(15),
  /** Suksess: kort dobbeltpuls */
  success: () => vibrate([12, 40, 18]),
  /** Advarsel/feil: tre korte */
  warning: () => vibrate([20, 30, 20, 30, 20]),
  /** Tung: f.eks. duell startet/vunnet */
  heavy: () => vibrate(30),
};
