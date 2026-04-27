import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import '../styles/invite-print.css';

function QrImage({ text }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!src) {
    return (
      <div
        style={{
          width: 160,
          height: 160,
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          color: '#666',
        }}
      >
        Genererer...
      </div>
    );
  }

  return <img src={src} alt="QR-kode" width={160} height={160} style={{ display: 'block' }} />;
}

export function InvitePrintOverlay({ invites, onClose }) {
  useEffect(() => {
    document.body.classList.add('invite-print-mode');
    return () => document.body.classList.remove('invite-print-mode');
  }, []);

  return (
    <div className="invite-print-overlay">
      <div className="invite-print-toolbar">
        <div>
          <strong>Utskrift av {invites.length} invitasjoner</strong>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#444' }}>
            Klikk «Skriv ut» og velg «Lagre som PDF» eller en skriver. Hver elev finner sin
            rute, skanner QR-koden og blir tatt til invitasjonsflyten.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="action-button"
            onClick={() => window.print()}
          >
            Skriv ut
          </button>
          <button
            type="button"
            className="action-button action-button--ghost"
            onClick={onClose}
          >
            Lukk
          </button>
        </div>
      </div>

      <div className="invite-print-grid">
        {invites.map((invite) => (
          <div key={invite.email} className="invite-print-card">
            <div className="invite-print-card__header">
              <strong className="invite-print-card__name">{invite.name}</strong>
              {invite.className ? (
                <span className="invite-print-card__class">{invite.className}</span>
              ) : null}
            </div>
            <div className="invite-print-card__qr">
              <QrImage text={invite.link} />
            </div>
            <dl className="invite-print-card__meta">
              <dt>E-post</dt>
              <dd>{invite.email}</dd>
              <dt>Kode</dt>
              <dd className="invite-print-card__code">{invite.code}</dd>
            </dl>
            <p className="invite-print-card__hint">
              Skann QR-koden, eller gå til <strong>{invite.shortHost}/invite</strong> og
              skriv inn e-post + kode.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
