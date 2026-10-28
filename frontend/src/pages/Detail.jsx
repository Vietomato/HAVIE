import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Plus, Minus, Star, Truck, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { money } from '../data';
import { catalogApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';

export default function Detail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const { add } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    catalogApi
      .getProduct(id)
      .then((p) => {
        setProduct(p);
        if (p?.variants?.length) {
          setSelectedVariant(p.variants[0]);
        }
        return catalogApi.getProductReviews(p.id);
      })
      .then((revRes) => {
        setReviews(revRes.data || []);
      })
      .catch((err) => {
        console.error(err);
        setProduct(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="container page-pad">Đang tải chi tiết sản phẩm...</div>;
  }

  if (!product) {
    return (
      <div className="container empty-state">
        <h1>Product not found</h1>
        <Link className="btn btn-primary" to="/products">
          BACK TO SHOP
        </Link>
      </div>
    );
  }

  const currentPrice = selectedVariant?.price || product.variants?.[0]?.price || 0;
  const oldPrice = selectedVariant?.oldPrice || product.variants?.[0]?.oldPrice;
  const maxStock = selectedVariant?.stockQuantity || 0;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    const res = await add(selectedVariant.id, qty);
    if (res.success) setAdded(true);
  };

  const handleBuyNow = async () => {
    if (!selectedVariant) return;
    const res = await add(selectedVariant.id, qty);
    if (res.success) navigate('/checkout');
  };

  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">HOME</Link> / <Link to="/products">SHOP</Link> / {product.name.toUpperCase()}
      </p>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            <img src={product.imageUrls?.[0] || '/images/product-1.svg'} alt={product.name} />
          </div>
          <div className="detail-thumbs">
            <img src={product.imageUrls?.[0] || '/images/product-1.svg'} alt="Product preview" />
            <span>HAVIE / PERFORMANCE SERIES</span>
          </div>
        </div>
        <section className="detail-info">
          <span className="eyebrow">
            {product.category?.name?.toUpperCase()} / HAVIE PERFORMANCE
          </span>
          <h1>
            {product.name}
            <span className="dot">.</span>
          </h1>
          <div className="rating">
            <Star size={16} fill="currentColor" /> {product.ratingAverage || 5.0}{' '}
            <span>• ({reviews.length} đánh giá khách hàng)</span>
          </div>
          <div className="detail-price">
            {money(currentPrice)} {oldPrice && <del>{money(oldPrice)}</del>}
          </div>
          <p className="detail-description">{product.description}</p>

          {/* Biến thể theo đúng Contract v1 */}
          {product.variants?.length > 0 && (
            <div className="variant-picker">
              <label>CHỌN PHIÊN BẢN / KÍCH THƯỚC (VARIANT):</label>
              <div className="variant-chips">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={'variant-chip ' + (selectedVariant?.id === v.id ? 'active' : '')}
                    onClick={() => {
                      setSelectedVariant(v);
                      setQty(1);
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
              <div className={'variant-stock-info ' + (maxStock <= 5 ? 'low' : '')}>
                {maxStock > 0
                  ? `SKU: ${selectedVariant?.sku} • Tồn kho khả dụng: ${maxStock} sản phẩm`
                  : 'Sản phẩm tạm hết hàng'}
              </div>
            </div>
          )}

          <div className="detail-specs">
            <h3>THÔNG SỐ & ĐẶC TÍNH</h3>
            <ul>
              {(product.specs || []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="quantity-row">
            <span>SỐ LƯỢNG</span>
            <div className="qty-control">
              <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus size={16} />
              </button>
              <output>{qty}</output>
              <button
                aria-label="Increase quantity"
                disabled={qty >= maxStock}
                onClick={() => setQty(Math.min(maxStock, qty + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn btn-primary"
              disabled={maxStock <= 0}
              onClick={handleAddToCart}
            >
              <ShoppingBag size={18} /> THÊM VÀO GIỎ HÀNG
            </button>
            <button
              className="btn btn-outline"
              disabled={maxStock <= 0}
              onClick={handleBuyNow}
            >
              MUA NGAY <ArrowRight size={17} />
            </button>
          </div>
          {added && (
            <p className="success-message" role="status">
              <CheckCircle2 size={17} /> Đã thêm vào giỏ hàng. <Link to="/cart">Xem giỏ hàng →</Link>
            </p>
          )}
          <div className="detail-assurance">
            <Truck size={19} /> Giao hàng nhanh 2-3 ngày <ShieldCheck size={19} /> Bảo hành chính hãng
          </div>
        </section>
      </div>

      {/* Customer Reviews Section */}
      <section className="reviews-section">
        <h2>
          ĐÁNH GIÁ KHÁCH HÀNG ({reviews.length})<span className="dot">.</span>
        </h2>
        {reviews.length ? (
          <div>
            {reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-header">
                  <strong>{r.userName}</strong>
                  <span>
                    <Star size={14} fill="currentColor" /> {r.rating}/5 •{' '}
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <p>{r.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="filter-tip">Chưa có đánh giá nào cho sản phẩm này.</p>
        )}
      </section>
    </div>
  );
}
