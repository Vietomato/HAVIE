import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, ArrowLeft, Plus, Minus, Trash2, LogIn } from 'lucide-react';
import { money, SHIPPING_FEE } from '../data';
import { useStore } from '../context/StoreContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { BlockSkeleton } from '../components/Skeleton.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import {
  FALLBACK_PRODUCT_IMAGE,
  getCartProduct,
  getProductPath,
  localizeVariantName,
} from '../utils/product.js';

export default function Cart() {
  usePageTitle('Giỏ hàng');
  const { account, authLoading, cart, cartLoading, add, update, remove, subtotal, count } = useStore();
  const { notify } = useToast();
  const [busyItem, setBusyItem] = useState(null);
  const items = cart?.items || [];

  const changeQuantity = async (item, quantity) => {
    setBusyItem(item.id);
    await update(item.id, quantity);
    setBusyItem(null);
  };

  const removeItem = async (item) => {
    setBusyItem(item.id);
    const removed = await remove(item.id);
    setBusyItem(null);
    if (removed) {
      notify({
        message: `Đã xóa ${getCartProduct(item).name || 'sản phẩm'} khỏi giỏ hàng.`,
        action: {
          label: 'Hoàn tác',
          onClick: () => add(item.variant.id, item.quantity, { silent: true }),
        },
      });
    }
  };

  const loading = authLoading || (cartLoading && !items.length);

  return (
    <div className="container page-pad">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng' }]} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">LỰA CHỌN CỦA BẠN</span>
          <h1>
            GIỎ HÀNG CỦA BẠN<span className="dot">.</span>
          </h1>
        </div>
        {items.length > 0 && <span>{count} sản phẩm</span>}
      </div>
      {loading ? (
        <BlockSkeleton label="Đang tải giỏ hàng..." rows={3} />
      ) : !account ? (
        <div className="empty-state">
          <LogIn size={54} aria-hidden="true" />
          <h2>Đăng nhập để xem giỏ hàng</h2>
          <p>Giỏ hàng được lưu theo tài khoản của bạn.</p>
          <div className="empty-actions">
            <Link to="/auth?returnTo=%2Fcart" className="btn btn-primary">
              ĐĂNG NHẬP <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/products" className="btn btn-outline">
              TIẾP TỤC MUA SẮM
            </Link>
          </div>
        </div>
      ) : items.length ? (
        <div className="cart-layout">
          <section className="cart-items" aria-label="Sản phẩm trong giỏ hàng">
            <div className="cart-head" aria-hidden="true">
              <span>SẢN PHẨM</span>
              <span>SỐ LƯỢNG</span>
              <span>THÀNH TIỀN</span>
            </div>
            {items.map((item) => {
              const product = getCartProduct(item);
              const stock = item.variant?.stockQuantity;
              const atStockLimit = stock !== undefined && item.quantity >= stock;
              const busy = busyItem === item.id;
              return (
                <article className="cart-item" key={item.id} aria-busy={busy}>
                  <Link to={getProductPath(product)} className="cart-thumb" tabIndex={-1} aria-hidden="true">
                    <img
                      src={product.imageUrls?.[0] || FALLBACK_PRODUCT_IMAGE}
                      alt=""
                      width="105"
                      height="105"
                    />
                  </Link>
                  <div className="cart-item-desc">
                    <Link to={getProductPath(product)}>{product.name}</Link>
                    <small>
                      {localizeVariantName(item.variant?.name)} · {money(item.variant?.price || 0)}
                    </small>
                    {item.quantity > stock && (
                      <small className="field-error">Chỉ còn {stock} sản phẩm trong kho.</small>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(item)}
                      className="remove-link"
                      disabled={busy}
                      aria-label={'Xóa ' + product.name + ' khỏi giỏ hàng'}
                    >
                      <Trash2 size={15} aria-hidden="true" /> Xóa
                    </button>
                  </div>
                  <div className="qty-control" role="group" aria-label={'Số lượng ' + product.name}>
                    <button
                      type="button"
                      aria-label="Giảm số lượng"
                      disabled={busy || item.quantity <= 1}
                      onClick={() => changeQuantity(item, item.quantity - 1)}
                    >
                      <Minus size={15} aria-hidden="true" />
                    </button>
                    <output>{item.quantity}</output>
                    <button
                      type="button"
                      aria-label="Tăng số lượng"
                      disabled={busy || atStockLimit}
                      onClick={() => changeQuantity(item, item.quantity + 1)}
                    >
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  </div>
                  <strong>{money((item.variant?.price || 0) * item.quantity)}</strong>
                </article>
              );
            })}
            <Link to="/products" className="text-link back-shopping">
              <ArrowLeft size={18} aria-hidden="true" /> TIẾP TỤC MUA SẮM
            </Link>
          </section>
          <aside className="summary" aria-label="Tổng đơn hàng">
            <h2>TỔNG ĐƠN HÀNG</h2>
            <div>
              <span>Tạm tính</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <span>Phí vận chuyển</span>
              <span>{money(SHIPPING_FEE)}</span>
            </div>
            <div className="summary-total">
              <span>TỔNG THANH TOÁN</span>
              <strong>{money(subtotal + SHIPPING_FEE)}</strong>
            </div>
            <Link className="btn btn-primary full" to="/checkout">
              TIẾN HÀNH ĐẶT HÀNG <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <p>Thanh toán khi nhận hàng (COD).</p>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={54} aria-hidden="true" />
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Hãy khám phá các mẫu vợt và phụ kiện của HAVIE.</p>
          <Link to="/products" className="btn btn-primary">
            KHÁM PHÁ BỘ SƯU TẬP <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
