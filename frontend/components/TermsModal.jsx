import { createPortal } from 'react-dom';
import {
  TERMS_CONTACT_EMAIL,
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
  TERMS_VERSION,
} from '../data/termsContent.js';

export function TermsModal({ isOpen, onClose }) {
  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="settings-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="settings-modal terms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        data-swipe-lock="true"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="settings-modal__header">
          <div>
            <p className="eyebrow">Russeknute · knuteloop.no</p>
            <h3 id="terms-modal-title">Brukervilkår og personvern</h3>
            <p className="settings-meta">
              Versjon {TERMS_VERSION} · Ikrafttredelse {TERMS_LAST_UPDATED}
            </p>
          </div>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={onClose}
          >
            Lukk
          </button>
        </div>

        <div className="terms-modal__body">
          {TERMS_SECTIONS.map((section, index) => (
            <section key={section.heading} className="terms-section">
              <h4 className="terms-section__heading">
                {index + 1}. {section.heading}
              </h4>
              {section.body.map((paragraph, idx) => (
                <p key={idx} className="terms-section__paragraph">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <p className="terms-section__paragraph">
            For spørsmål eller henvendelser knyttet til disse vilkårene:{' '}
            <a href={`mailto:${TERMS_CONTACT_EMAIL}`}>{TERMS_CONTACT_EMAIL}</a>
          </p>
        </div>

        <div className="settings-modal__footer">
          <button type="button" className="action-button" onClick={onClose}>
            Lukk
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
