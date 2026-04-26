import { KnotIcon } from './KnotIcon.jsx';

export function LoadingSplash() {
  return (
    <div className="loading-splash" role="status" aria-live="polite">
      <div className="loading-splash__inner">
        <div className="loading-splash__icon" aria-hidden="true">
          <KnotIcon size={120} />
        </div>
        <h1 className="loading-splash__brand">Russeknute</h1>
        <div className="loading-splash__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <span className="visually-hidden">Laster…</span>
    </div>
  );
}
