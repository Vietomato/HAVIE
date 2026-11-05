import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, LogIn, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { money, SHIPPING_FEE } from '../data';
import { orderApi, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../api';
import { useStore } from '../context/StoreContext.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { BlockSkeleton } from '../components/Skeleton.jsx';
import TextField from '../components/TextField.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { FALLBACK_PRODUCT_IMAGE, getCartProduct, localizeVariantName } from '../utils/product.js';

const STEPS = ['Giỏ hàng', 'Giao hàng', 'Hoàn tất'];
const PHONE_PATTERN = /^(0|\+84)\d{9}$/;

const EMPTY_ADDRESS = { name: '', phone: '', province: '', district: '', ward: '', street: '' };

const REQUIRED_MESSAGES = {
  name: 'Vui lòng nhập họ tên người nhận.',
  phone: 'Vui lòng nhập số điện thoại.',
  province: 'Vui lòng nhập tỉnh/thành phố.',
  district: 'Vui lòng nhập quận/huyện.',
  ward: 'Vui lòng nhập phường/xã.',
  street: 'Vui lòng nhập số nhà, tên đường.',
};

function validate(form) {
  const errors = {};
  Object.entries(REQUIRED_MESSAGES).forEach(([field, message]) => {
    if (!form[field].trim()) errors[field] = message;
  });
  if (!errors.phone && !PHONE_PATTERN.test(form.phone.replace(/[\s.-]/g, ''))) {
    errors.phone = 'Số điện thoại chưa đúng, ví dụ: 0901234567.';
  }
  return errors;
}

function CheckoutSteps({ current }) {
  return (
    <ol className="checkout-steps" aria-label="Các bước đặt hàng">
      {STEPS.map((step, index) => (
        <li
          key={step}
          className={index < current ? 'complete' : index === current ? 'current' : ''}
          aria-current={index === current ? 'step' : undefined}
        >
          <span>{index < current ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  );
}

export default function Checkout() {
  usePageTitle('Đặt hàng');
  const { cart, cartLoading, subtotal, refreshCart, account, authLoading } = useStore();
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  const items = cart?.items || [];

  useEffect(() => {
    if (account) {
      setForm((current) => ({
        ...current,
        name: current.name || account.fullName || '',
        phone: current.phone || account.phone || '',
      }));
    }
  }, [account]);

  const fieldProps = (field) => ({
    id: 'checkout-' + field,
    value: form[field],
    error: errors[field],
    onChange: (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById('checkout-' + firstInvalid)?.focus();
      return;
    }

    try {
      setSubmitting(true);
      const res = await orderApi.createOrder({
        recipientName: form.name.trim(),
        recipientPhone: form.phone.replace(/[\s.-]/g, ''),
        shippingAddress: {
          province: form.province.trim(),
          district: form.district.trim(),
          ward: form.ward.trim(),
          streetAddress: form.street.trim(),
        },
        paymentMethod: 'COD',
        customerNote: note.trim(),
      });

      await refreshCart();
      setCreatedOrder(res);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      setSubmitError(err.message || 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdOrder) {
    return (
      <div className="container page-pad checkout-page">
        <CheckoutSteps current={3} />
        <section className="order-success">
          <CheckCircle2 size={56} aria-hidden="true" />
          <h1>Đặt hàng thành công!</h1>
          <p>
            Mã đơn hàng của bạn là <strong>{createdOrder.orderCode}</strong>
          </p>
          <dl>
            <div>
              <dt>Người nhận</dt>
              <dd>
                {createdOrder.recipientName} ({createdOrder.recipientPhone})
              </dd>
            </div>
            <div>
              <dt>Địa chỉ</dt>
              <dd>{createdOrder.shippingAddress}</dd>
            </div>
            <div>
              <dt>Thanh toán</dt>
              <dd>{PAYMENT_METHOD_LABELS[createdOrder.paymentMethod]}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <span className={'status-badge ' + createdOrder.status}>
                  {ORDER_STATUS_LABELS[createdOrder.status]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Tổng thanh toán</dt>
              <dd>
                <strong>{money(createdOrder.totalAmount)}</strong>
              </dd>
            </div>
          </dl>
          <div className="empty-actions">
            <Link className="btn btn-primary" to="/account/orders">
              THEO DÕI ĐƠN HÀNG
            </Link>
            <Link className="btn btn-outline" to="/products">
              TIẾP TỤC MUA SẮM
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: 'Trang chủ', to: '/' },
        { label: 'Giỏ hàng', to: '/cart' },
        { label: 'Đặt hàng' },
      ]}
    />
  );

  if (authLoading || (cartLoading && !items.length)) {
    return (
      <div className="container page-pad checkout-page">
        {breadcrumbs}
        <BlockSkeleton label="Đang tải thông tin đặt hàng..." rows={4} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container page-pad checkout-page">
        {breadcrumbs}
        <div className="empty-state">
          <LogIn size={54} aria-hidden="true" />
          <h1>Đăng nhập để đặt hàng</h1>
          <p>Đơn hàng được lưu vào tài khoản để bạn tiện theo dõi.</p>
          <Link to="/auth?returnTo=%2Fcheckout" className="btn btn-primary">
            ĐĂNG NHẬP / ĐĂNG KÝ <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container page-pad checkout-page">
        {breadcrumbs}
        <div className="empty-state">
          <ShoppingBag size={54} aria-hidden="true" />
          <h1>Giỏ hàng đang trống</h1>
          <p>Hãy thêm sản phẩm vào giỏ trước khi đặt hàng.</p>
          <Link to="/products" className="btn btn-primary">
            KHÁM PHÁ SẢN PHẨM <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-pad checkout-page">
      {breadcrumbs}
      <div className="page-heading">
        <div>
          <span className="eyebrow">BƯỚC CUỐI CÙNG</span>
          <h1>
            ĐẶT HÀNG<span className="dot">.</span>
          </h1>
        </div>
      </div>
      <CheckoutSteps current={1} />
      <div className="cart-layout">
        <form id="checkout-form" className="checkout-form" onSubmit={handleSubmit} noValidate>
          <section className="form-card">
            <h2>
              <Truck size={20} aria-hidden="true" /> Thông tin giao hàng
            </h2>
            <div className="form-grid">
              <TextField label="Họ và tên người nhận" autoComplete="name" {...fieldProps('name')} />
              <TextField
                label="Số điện thoại"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="0901234567"
                {...fieldProps('phone')}
              />
              <TextField
                label="Tỉnh / Thành phố"
                autoComplete="address-level1"
                {...fieldProps('province')}
              />
              <TextField
                label="Quận / Huyện"
                autoComplete="address-level2"
                {...fieldProps('district')}
              />
              <TextField label="Phường / Xã" autoComplete="address-level3" {...fieldProps('ward')} />
              <TextField
                label="Số nhà, tên đường"
                autoComplete="street-address"
                placeholder="Ví dụ: 12 Nguyễn Văn Bảo"
                {...fieldProps('street')}
              />
            </div>
            <TextField
              as="textarea"
              id="checkout-note"
              label="Ghi chú đơn hàng (không bắt buộc)"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Gọi trước khi giao"
            />
          </section>

          <section className="form-card">
            <h2>
              <ShieldCheck size={20} aria-hidden="true" /> Phương thức thanh toán
            </h2>
            <label className="payment-option">
              <input type="radio" name="payment" value="COD" checked readOnly />
              <span>
                <strong>Thanh toán khi nhận hàng (COD)</strong>
                <small>Bạn thanh toán bằng tiền mặt cho nhân viên giao hàng.</small>
              </span>
            </label>
          </section>
        </form>

        <aside className="summary" aria-label="Đơn hàng của bạn">
          <h2>ĐƠN HÀNG CỦA BẠN</h2>
          <ul className="summary-items">
            {items.map((item) => {
              const product = getCartProduct(item);
              return (
                <li key={item.id}>
                  <img
                    src={product.imageUrls?.[0] || FALLBACK_PRODUCT_IMAGE}
                    alt=""
                    width="52"
                    height="52"
                  />
                  <span>
                    {product.name}
                    <small>
                      {localizeVariantName(item.variant?.name)} × {item.quantity}
                    </small>
                  </span>
                  <strong>{money((item.variant?.price || 0) * item.quantity)}</strong>
                </li>
              );
            })}
          </ul>
          <div>
            <span>Tạm tính</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>Phí vận chuyển</span>
            <span>{money(SHIPPING_FEE)}</span>
          </div>
          <div className="summary-total">
            <span>TỔNG CỘNG</span>
            <strong>{money(subtotal + SHIPPING_FEE)}</strong>
          </div>
          {submitError && (
            <p className="inline-alert" role="alert">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            form="checkout-form"
            disabled={submitting}
            className="btn btn-primary full"
          >
            {submitting ? 'ĐANG XỬ LÝ...' : 'ĐẶT HÀNG NGAY'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </aside>
      </div>
    </div>
  );
}
