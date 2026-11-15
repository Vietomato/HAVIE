import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Clock, Copy, ExternalLink, LoaderCircle } from 'lucide-react';
import { money } from '../data';
import { orderApi } from '../api';
import { useToast } from '../context/ToastContext.jsx';

const POLL_INTERVAL_MS = 3000;

function useCountdown(expiresAt) {
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    setLeft(Math.max(0, target - Date.now()));
    const id = window.setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const seconds = Math.ceil(left / 1000);
  const text = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return { expired: left <= 0, text };
}

function CopyRow({ label, value, copyValue = value, strong = false }) {
  const { notify } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(copyValue));
      notify({ message: `Đã sao chép ${label.toLowerCase()}.` });
    } catch {
      notify({ message: 'Không sao chép được, bạn hãy chép thủ công nhé.', type: 'error' });
    }
  };

  return (
    <div className="qr-row">
      <span>{label}</span>
      <strong className={strong ? 'qr-row-strong' : ''}>{value}</strong>
      <button type="button" className="qr-copy" onClick={copy} aria-label={`Sao chép ${label.toLowerCase()}`}>
        <Copy size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

// Màn thanh toán chuyển khoản QR (payOS): hiện mã QR, số tiền, nội dung, đồng hồ đếm ngược.
// Trang tự hỏi lại backend mỗi vài giây; khi payOS báo đã nhận tiền thì chuyển sang màn thành công.
export default function QrPayment({ order, payment, onPaid, onClosed }) {
  const [image, setImage] = useState('');
  const { expired, text } = useCountdown(payment.expiresAt);
  const callbacks = useRef({ onPaid, onClosed });
  callbacks.current = { onPaid, onClosed };

  useEffect(() => {
    let cancelled = false;
    if (!payment.qrCode) {
      setImage('');
      return undefined;
    }
    QRCode.toDataURL(payment.qrCode, { width: 288, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setImage(url))
      .catch(() => !cancelled && setImage(''));
    return () => {
      cancelled = true;
    };
  }, [payment.qrCode]);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const result = await orderApi.getOrderPayment(order.id);
        if (stopped) return;
        if (result.order.paymentStatus === 'PAID') {
          stopped = true;
          callbacks.current.onPaid?.(result.order);
        } else if (result.order.status !== 'PENDING_PAYMENT') {
          stopped = true;
          callbacks.current.onClosed?.(result.order);
        }
      } catch {
        // Lỗi mạng tạm thời: lần sau hỏi lại.
      }
    };
    const id = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [order.id]);

  return (
    <section className="qr-payment" aria-label="Thanh toán chuyển khoản QR">
      <header className="qr-head">
        <div>
          <span className="eyebrow">THANH TOÁN TRƯỚC</span>
          <h1>Quét mã để thanh toán</h1>
          <p>
            Đơn <strong>{order.orderCode}</strong> sẽ được ghi nhận ngay khi ngân hàng báo đã nhận tiền.
          </p>
        </div>
        <div className={'qr-timer' + (expired ? ' expired' : '')} role="timer" aria-live="off">
          <Clock size={16} aria-hidden="true" />
          {expired ? 'Đã hết hạn' : `Còn ${text}`}
        </div>
      </header>

      <div className="qr-body">
        <div className="qr-code">
          {image ? (
            <img src={image} alt="Mã QR thanh toán chuyển khoản" width="288" height="288" />
          ) : (
            <div className="qr-code-placeholder">
              {payment.qrCode ? 'Đang tạo mã QR…' : 'Chưa có mã QR, hãy mở trang thanh toán.'}
            </div>
          )}
          <small>Mở app ngân hàng, chọn quét mã QR</small>
        </div>

        <div className="qr-info">
          <CopyRow label="Số tiền" value={money(payment.amount)} copyValue={payment.amount} strong />
          <CopyRow label="Nội dung" value={payment.transferContent} strong />
          <p className="qr-hint">
            Giữ đúng số tiền và nội dung chuyển khoản. Bạn không cần bấm gì thêm: trang sẽ tự cập nhật khi
            thanh toán thành công.
          </p>
          <p className="qr-waiting" role="status">
            <LoaderCircle size={16} aria-hidden="true" /> Đang chờ thanh toán…
          </p>
        </div>
      </div>

      <div className="qr-actions">
        {payment.checkoutUrl && (
          <a className="btn btn-primary" href={payment.checkoutUrl} target="_blank" rel="noopener noreferrer">
            MỞ TRANG THANH TOÁN <ExternalLink size={16} aria-hidden="true" />
          </a>
        )}
        <Link className="btn btn-outline" to="/account/orders">
          XEM ĐƠN HÀNG CỦA TÔI
        </Link>
      </div>
      {expired && (
        <p className="muted-text">Mã đã hết hạn và đơn sẽ được hủy. Bạn có thể đặt lại đơn mới.</p>
      )}
    </section>
  );
}
