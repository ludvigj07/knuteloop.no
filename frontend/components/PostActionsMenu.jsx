import { useEffect, useRef, useState } from 'react';

export function PostActionsMenu({
  align = 'right',
  className = '',
  isDeleting = false,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleDelete() {
    setIsOpen(false);
    onDelete?.();
  }

  return (
    <div
      ref={menuRef}
      className={`post-actions-menu post-actions-menu--${align} ${className}`.trim()}
    >
      <button
        type="button"
        className="post-actions-menu__trigger"
        onClick={() => setIsOpen((current) => !current)}
        disabled={isDeleting}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Flere valg for innlegg"
        title="Flere valg"
      >
        {isDeleting ? '...' : '\u22EE'}
      </button>

      {isOpen ? (
        <div className="post-actions-menu__dropdown" role="menu">
          <button
            type="button"
            className="post-actions-menu__item"
            role="menuitem"
            disabled
          >
            <span aria-hidden="true">{'\u270E'}</span>
            <span>Rediger innlegg</span>
          </button>
          <button
            type="button"
            className="post-actions-menu__item post-actions-menu__item--danger"
            role="menuitem"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <span aria-hidden="true">{'\u{1F5D1}\uFE0F'}</span>
            <span>Slett innlegg</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
