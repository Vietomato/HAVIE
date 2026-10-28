import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react';
import { money } from '../data';
import { useStore } from '../context/StoreContext.jsx';
import { localizeVariantName } from '../utils/product.js';

export default function Cart() {
  const { cart, update, remove, subtotal } = useStore();
  const items = cart?.items || [];

  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">TRANG CHỦ</Link> / GIỎ HÀNG
      </p>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SELECTION</span>
          <h1>
            GIỎ HÀNG CỦA BẠN<span className="dot">.</span>
          </h1>
        </div>
      </div>
      {items.length ? (
        <div className="cart-layout">
          <section className="cart-items">
            <div className="cart-head">
              <span>SẢN PHẨM</span>
              <span>SỐ LƯỢNG</span>
              <span>TỔNG CỘNG</span>
            </div>
            {items.map((item) => (
              <article className="cart-item" key={item.id}>
                <Link to={'/products/' + (item.product?.slug || item.product?.id)} className="cart-thumb">
                  <img
                    src={item.product?.imageUrls?.[0] || '/images/product-1.svg'}
                    alt={item.product?.name}
                  />
                </Link>
                <div className="cart-item-desc">
                  <span className="eyebrow">{item.product?.category?.name || 'Vợt cầu lông'}</span>
                  <Link to={'/products/' + (item.product?.slug || item.product?.id)}>
                    {item.product?.name}
                  </Link>
                  <small className="font-bold text-[var(--forest)]">
                    Phiên bản: {localizeVariantName(item.variant?.name)} ({item.variant?.sku})
                  </small>
                  <span>{money(item.variant?.price || 0)}</span>
                  <button onClick={() => remove(item.id)} className="remove-link">
                    <Trash2 size={15} /> XÓA
                  </button>
                </div>
                <div className="qty-control">
                  <button
                    aria-label="Giảm số lượng"
                    onClick={() => update(item.id, item.quantity - 1)}
                  >
                    <Minus size={15} />
                  </button>
                  <output>{item.quantity}</output>
                  <button
                    aria-label="Tăng số lượng"
                    onClick={() => update(item.id, item.quantity + 1)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <strong>{money((item.variant?.price || 0) * item.quantity)}</strong>
              </article>
            ))}
            <Link to="/products" className="text-link back-shopping">
              <ArrowLeft size={18} /> TIẾP TỤC MUA SẮM
            </Link>
          </section>
          <aside className="summary">
            <h2>TỔNG ĐƠN HÀNG</h2>
            <div>
              <span>Tạm tính</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <span>Phí vận chuyển</span>
              <span>30.000 ₫ (toàn quốc)</span>
            </div>
            <div className="summary-total">
              <span>TỔNG THANH TOÁN</span>
              <strong>{money(subtotal + 30000)}</strong>
            </div>
            <Link className="btn btn-primary full" to="/checkout">
              TIẾN HÀNH ĐẶT HÀNG <ArrowRight size={17} />
            </Link>
            <p>Hỗ trợ thanh toán COD và Quét mã QR tiện lợi.</p>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={54} />
          <h2>Giỏ hàng của bạn đang trống.</h2>
          <p>Hãy khám phá các mẫu vợt và phụ kiện chất lượng cao của HAVIE.</p>
          <Link to="/products" className="btn btn-primary">
            KHÁM PHÁ BỘ SƯU TẬP <ArrowRight size={18} />
          </Link>
        </div>
      )}
    </div>
  );
}
