import React from 'react';
import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';

// <input type="datetime-local"> works in local time without a timezone suffix.
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);
const optionalNumber = (value) => (value === '' ? null : Number(value));

function createVoucherForm(voucher) {
  if (!voucher) {
    return {
      code: '',
      description: '',
      discountType: 'PERCENT',
      discountValue: '',
      maxDiscount: '',
      minOrderAmount: '0',
      usageLimit: '',
      startsAt: '',
      endsAt: '',
      isActive: true,
    };
  }
  return {
    code: voucher.code,
    description: voucher.description || '',
    discountType: voucher.discountType,
    discountValue: String(voucher.discountValue),
    maxDiscount: voucher.maxDiscount === null ? '' : String(voucher.maxDiscount),
    minOrderAmount: String(voucher.minOrderAmount),
    usageLimit: voucher.usageLimit === null ? '' : String(voucher.usageLimit),
    startsAt: toLocalInput(voucher.startsAt),
    endsAt: toLocalInput(voucher.endsAt),
    isActive: voucher.isActive,
  };
}

export default function VoucherFormModal({ open, voucher, onClose, onSaved }) {
  const { notify } = useToast();
  const [form, setForm] = useState(() => createVoucherForm(voucher));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(createVoucherForm(voucher));
    setFormError('');
  }, [open, voucher]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const isPercent = form.discountType === 'PERCENT';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscount: isPercent ? optionalNumber(form.maxDiscount) : null,
      minOrderAmount: Number(form.minOrderAmount || 0),
      usageLimit: optionalNumber(form.usageLimit),
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      isActive: form.isActive,
    };

    try {
      setSaving(true);
      if (voucher) await adminApi.updateVoucher(voucher.id, payload);
      else await adminApi.createVoucher(payload);
      notify({ message: voucher ? 'Đã cập nhật mã giảm giá.' : 'Đã tạo mã giảm giá.' });
      await onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Không thể lưu mã giảm giá.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={voucher ? 'Cập nhật mã giảm giá' : 'Tạo mã giảm giá'}
      busy={saving}
    >
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Mã
            <input
              required
              data-autofocus
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_\-]+"
              title="Chữ, số, gạch ngang hoặc gạch dưới"
              className="voucher-code-input"
              value={form.code}
              onChange={(event) => updateField('code', event.target.value)}
              placeholder="Ví dụ: HAVIE10"
            />
          </label>
          <label>
            Loại giảm
            <select
              value={form.discountType}
              onChange={(event) => updateField('discountType', event.target.value)}
            >
              <option value="PERCENT">Theo phần trăm (%)</option>
              <option value="FIXED">Số tiền cố định (đ)</option>
            </select>
          </label>
          <label>
            {isPercent ? 'Mức giảm (%)' : 'Mức giảm (đ)'}
            <input
              required
              type="number"
              min={1}
              max={isPercent ? 100 : undefined}
              step={1}
              value={form.discountValue}
              onChange={(event) => updateField('discountValue', event.target.value)}
            />
          </label>
          {isPercent && (
            <label>
              Giảm tối đa (đ, không bắt buộc)
              <input
                type="number"
                min={1}
                step={1}
                value={form.maxDiscount}
                onChange={(event) => updateField('maxDiscount', event.target.value)}
              />
            </label>
          )}
          <label>
            Tiền hàng tối thiểu (đ)
            <input
              type="number"
              min={0}
              step={1}
              value={form.minOrderAmount}
              onChange={(event) => updateField('minOrderAmount', event.target.value)}
            />
          </label>
          <label>
            Số lượt dùng (để trống = không giới hạn)
            <input
              type="number"
              min={Math.max(1, voucher?.usedCount || 0)}
              step={1}
              value={form.usageLimit}
              onChange={(event) => updateField('usageLimit', event.target.value)}
            />
          </label>
          <label>
            Bắt đầu
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => updateField('startsAt', event.target.value)}
            />
          </label>
          <label>
            Kết thúc
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => updateField('endsAt', event.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => updateField('isActive', event.target.checked)}
            />
            Đang áp dụng
          </label>
        </div>

        <label>
          Mô tả cho khách (không bắt buộc)
          <input
            maxLength={200}
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            placeholder="Ví dụ: Giảm 10% cho đơn từ 1 triệu"
          />
        </label>

        {formError && (
          <p className="inline-alert" role="alert">
            {formError}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            HỦY
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'ĐANG LƯU...' : 'LƯU MÃ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
