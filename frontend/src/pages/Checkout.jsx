import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { money } from '../data';
import { orderApi, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../api';
import { useStore } from '../context/StoreContext.jsx';

export default function Checkout() {
  const { cart, subtotal, refreshCart, account } = useStore();
  const [name, setName] = useState(account?.fullName || '');
  const [phone, setPhone] = useState(account?.phone || '');
  const [street, setStreet] = useState('');
  const [ward, setWard] = useState('Phường 4');
  const [district, setDistrict] = useState('Gò Vấp');
  const [province, setProvince] = useState('TP. Hồ Chí Minh');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrOrder, setQrOrder] = useState(null);
  const navigate = useNavigate();

  const items = cart?.items || [];

  useEffect(() => {
    if (account) {
      if (!name) setName(account.fullName || '');
      if (!phone) setPhone(account.phone || '');
    }
  }, [account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!account) {
      alert('Vui lòng đăng nhập để tiến hành đặt hàng theo quy định của hệ thống.');
      navigate('/auth');
      return;
    }
    if (!items.length) return;

    try {
      setSubmitting(true);
      const res = await orderApi.createOrder({
        recipientName: name,
        recipientPhone: phone,
        shippingAddress: {
          province,
          district,
          ward,
          streetAddress: street,
        },
        paymentMethod,
        customerNote: note,
      });

      await refreshCart();
      setCreatedOrder(res);

      if (paymentMethod === 'MOCK_QR' && res.payment) {
        setQrOrder(res);
        setShowQrModal(true);
      }
    } catch (err) {
      alert(err.message || 'Có lỗi xảy ra khi tạo đơn hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmQrPayment = async () => {
    if (!qrOrder) return;
    try {
      const res = await orderApi.simulateQrPaymentSuccess(qrOrder.id);
      setCreatedOrder(res);
      setShowQrModal(false);
      alert('Thanh toán thành công! Trạng thái đơn hàng đã được cập nhật.');
    } catch (err) {
      alert('Lỗi xác nhận thanh toán.');
    }
  };

  return (
    <div className="container page-pad checkout-page">
      <p className="breadcrumbs">
        <Link to="/cart">CART</Link> / CHECKOUT
      </p>

      {/* QR Payment Modal */}
      {showQrModal && qrOrder && (
        <div className="qr-overlay">
          <div className="qr-modal">
            <h2>MÃ QR THANH TOÁN (MOCK_QR)</h2>
            <p>Đơn hàng: <strong>{qrOrder.orderCode}</strong></p>
            <div className="qr-box">
              <div className="qr-code-art">
                VIETQR DEMO<br />{money(qrOrder.totalAmount)}
              </div>
              <small>Hết hạn sau: 15 phút (Mô phỏng API)</small>
            </div>
            <p className="text-[13px] text-[var(--muted)]">
              Đây là cổng thanh toán mô phỏng theo Contract v1. Bạn có thể nhấn nút bên dưới để giả lập thanh toán thành công từ ngân hàng:
            </p>
            <div className="mt-[15px] flex gap-[10px]">
              <button className="btn btn-primary full" onClick={handleConfirmQrPayment}>
                XÁC NHẬN ĐÃ THANH TOÁN
              </button>
              <button className="btn btn-outline" onClick={() => setShowQrModal(false)}>
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      )}

      {createdOrder ? (
        <div className="empty-state">
          <CheckCircle2 size={62} color="var(--forest)" />
          <h1>Đặt hàng thành công!</h1>
          <p>
            Mã đơn hàng của bạn là <strong>{createdOrder.orderCode}</strong>.
          </p>
          <div className="mx-auto my-[15px] max-w-[400px] text-left">
            <p><strong>Người nhận:</strong> {createdOrder.recipientName} ({createdOrder.recipientPhone})</p>
            <p><strong>Địa chỉ:</strong> {createdOrder.shippingAddress}</p>
            <p><strong>Phương thức:</strong> {PAYMENT_METHOD_LABELS[createdOrder.paymentMethod]}</p>
            <p>
              <strong>Trạng thái: </strong>
              <span className={'status-badge ' + createdOrder.status}>
                {ORDER_STATUS_LABELS[createdOrder.status]}
              </span>
            </p>
            <p><strong>Tổng thanh toán:</strong> {money(createdOrder.totalAmount)}</p>
          </div>
          <div className="flex justify-center gap-3">
            <Link className="btn btn-primary" to="/auth?tab=orders">
              XEM LỊCH SỬ ĐƠN HÀNG
            </Link>
            <Link className="btn btn-outline" to="/">
              VỀ TRANG CHỦ
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">ONE LAST STEP</span>
              <h1>
                CHECKOUT<span className="dot">.</span>
              </h1>
            </div>
          </div>
          {!account && (
            <div className="quick-login-box mb-6">
              <p>⚠️ Theo API Contract v1: Bạn cần đăng nhập để hoàn tất đặt hàng.</p>
              <Link to="/auth" className="btn-mini">
                ĐĂNG NHẬP / ĐĂNG KÝ NGAY
              </Link>
            </div>
          )}
          <div className="cart-layout">
            <form id="checkout-form" className="checkout-form" onSubmit={handleSubmit}>
              <h2>THÔNG TIN GIAO HÀNG (API CONTRACT V1)</h2>
              <label>
                HỌ VÀ TÊN NGƯỜI NHẬN
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                SỐ ĐIỆN THOẠI
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0900000000"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  TỈNH / THÀNH PHỐ
                  <input
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                </label>
                <label>
                  QUẬN / HUYỆN
                  <input
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </label>
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <label>
                  PHƯỜNG / XÃ
                  <input required value={ward} onChange={(e) => setWard(e.target.value)} />
                </label>
                <label>
                  ĐỊA CHỈ SỐ NHÀ, ĐƯỜNG
                  <input
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ví dụ: 12 Nguyễn Văn Bảo"
                  />
                </label>
              </div>

              <h2 className="mt-6">PHƯƠNG THỨC THANH TOÁN</h2>
              <div className="flex flex-col gap-[10px]">
                <label className="flex items-center gap-[10px]">
                  <input
                    type="radio"
                    name="payment"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                  />
                  <span>Thanh toán khi nhận hàng (COD)</span>
                </label>
                <label className="flex items-center gap-[10px]">
                  <input
                    type="radio"
                    name="payment"
                    value="MOCK_QR"
                    checked={paymentMethod === 'MOCK_QR'}
                    onChange={() => setPaymentMethod('MOCK_QR')}
                  />
                  <span>Mã QR thanh toán mô phỏng (MOCK_QR VietQR)</span>
                </label>
              </div>

              <label className="mt-4">
                GHI CHÚ ĐƠN HÀNG (TÙY CHỌN)
                <textarea
                  rows="2"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Gọi trước khi giao"
                />
              </label>
            </form>

            <aside className="summary">
              <h2>ĐƠN HÀNG CỦA BẠN</h2>
              {items.map((item) => (
                <div key={item.id}>
                  <span>
                    {item.product?.name} ({item.variant?.name}) × {item.quantity}
                  </span>
                  <strong>{money((item.variant?.price || 0) * item.quantity)}</strong>
                </div>
              ))}
              <div>
                <span>Phí ship</span>
                <span>30.000 ₫</span>
              </div>
              <div className="summary-total">
                <span>TỔNG CỘNG</span>
                <strong>{money(subtotal + 30000)}</strong>
              </div>
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting || !items.length}
                className="btn btn-primary full"
              >
                {submitting ? 'ĐANG XỬ LÝ...' : 'ĐẶT HÀNG NGAY'} <ArrowRight size={18} />
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
