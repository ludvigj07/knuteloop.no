import { KnotIcon } from './KnotIcon.jsx';

export function LoadingSplash({ message = 'Henter knuter…' }) {
  return (
    <div className="loading-splash" role="status" aria-live="polite">
      <div className="loading-splash__inner">
        <div className="loading-splash__icon" aria-hidden="true">
          <KnotIcon size={96} />
        </div>
        <h1 className="loading-splash__brand">Knuteloop</h1>
        <p className="loading-splash__message">{message}</p>
        <div className="loading-splash__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <span className="visually-hidden">Laster innhold…</span>
    </div>
  );
}
