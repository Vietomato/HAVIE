import React from 'react';
import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import TextField from './TextField.jsx';

export default function ReasonDialog({ open, title, description, confirmLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy đơn.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      await onConfirm(reason.trim());
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'Không thể hủy đơn hàng.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} busy={busy}>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {description && <p className="modal-text">{description}</p>}
        <TextField
          as="textarea"
          id="cancel-reason"
          label="Lý do hủy đơn"
          rows={3}
          maxLength={500}
          data-autofocus
          value={reason}
          error={error}
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
            GIỮ ĐƠN HÀNG
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? 'ĐANG XỬ LÝ...' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
