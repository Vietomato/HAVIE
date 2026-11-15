import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, LoaderCircle, BadgeCheck } from 'lucide-react';
import Modal from './Modal.jsx';
import TextField from './TextField.jsx';
import { reviewApi } from '../api';

const ratingLabels = ['', 'Rất không hài lòng', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];

export default function ProductReviewDialog({ productId, productName, onClose, onSaved }) {
  const groupId = useId();
  const [eligibility, setEligibility] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setEligibility(null);
    reviewApi.getEligibility(productId).then((result) => {
      if (cancelled) return;
      setEligibility(result); setRating(result.review?.rating ?? 0); setComment(result.review?.comment ?? '');
    }).catch((failure) => { if (!cancelled) setError(failure.message || 'Chưa kiểm tra được điều kiện đánh giá.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId, retry]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!rating) { setError('Bạn hãy chọn số sao trước khi gửi nhé.'); return; }
    setBusy(true); setError('');
    try {
      const result = eligibility.review
        ? await reviewApi.updateReview(eligibility.review.id, { rating, comment })
        : await reviewApi.createReview({ productId, rating, comment });
      onSaved?.(result.review, result.summary);
      onClose();
    } catch (failure) { setError(failure.message || 'Chưa gửi được đánh giá. Bạn thử lại nhé.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open title={eligibility?.review ? 'Sửa đánh giá của bạn' : 'Đánh giá sản phẩm'} onClose={onClose} busy={busy}>
      <p className="mb-5 break-words font-semibold text-slate-900">{productName}</p>
      {loading ? (
        <p className="flex items-center gap-2 text-slate-600" role="status"><LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang kiểm tra đơn hàng…</p>
      ) : eligibility?.canReview ? (
        <form onSubmit={submit} className="form-stack">
          <p className="flex items-center gap-2 text-sm text-emerald-700"><BadgeCheck size={18} aria-hidden="true" />Đã mua hàng tại HAVIE</p>
          <fieldset disabled={busy}>
            <legend className="mb-2 font-semibold">Mức độ hài lòng</legend>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <label key={star} className="cursor-pointer">
                  <input type="radio" name={groupId} value={star} checked={rating === star} onChange={() => setRating(star)} aria-label={`${star} sao`} className="peer sr-only" required />
                  <span className="flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-amber-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 motion-reduce:transition-none">
                    <Star size={29} className={star <= rating ? 'text-amber-500' : 'text-slate-300'} fill={star <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 min-h-5 text-sm text-slate-600" aria-live="polite">{rating ? `${rating}/5 — ${ratingLabels[rating]}` : 'Chọn từ 1 đến 5 sao'}</p>
          </fieldset>
          <TextField as="textarea" id={`${groupId}-comment`} label="Nhận xét của bạn (không bắt buộc)" rows={4} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} disabled={busy} hint={`${comment.length}/2.000 ký tự. Bạn có thể chia sẻ cảm nhận về sản phẩm.`} />
          {eligibility.review?.isVisible === false && <p className="text-sm text-slate-600">Đánh giá này hiện chưa hiển thị công khai.</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>ĐỂ SAU</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !rating}>{busy ? 'ĐANG LƯU…' : eligibility.review ? 'LƯU THAY ĐỔI' : 'GỬI ĐÁNH GIÁ'}</button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-slate-600" role={error ? 'alert' : undefined}>{error || eligibility?.message}</p>
          <div className="flex flex-wrap gap-3">
            {error ? <button type="button" className="btn btn-outline" onClick={() => setRetry((value) => value + 1)}>THỬ LẠI</button> : <Link to="/account/orders" className="btn btn-primary" onClick={onClose}>XEM ĐƠN HÀNG</Link>}
            <button type="button" className="btn btn-outline" onClick={onClose}>ĐÓNG</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
