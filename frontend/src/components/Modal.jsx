import React from 'react';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

// Native <dialog> provides the focus trap, the top layer and focus return on close.
export default function Modal({ open, onClose, title, children, wide = false, busy = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={'modal' + (wide ? ' modal-wide' : '')}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {open && (
        <>
          <header className="modal-header">
            <h2 id={titleId}>{title}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Đóng hộp thoại"
              disabled={busy}
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  );
}
