import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Plus, Minus, Star, Truck, ShieldCheck, Heart, RotateCw, PackageSearch } from 'lucide-react';
import { formatDate, money } from '../data';
import { catalogApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { BlockSkeleton } from '../components/Skeleton.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import {
  FALLBACK_PRODUCT_IMAGE,
  getDefaultVariant,
  getDiscountPercent,
  isVariantInStock,
  localizeVariantName,
  showFallbackImage,
} from '../utils/product.js';

function Stars({ value }) {
  return (
    <span className="stars" role="img" aria-label={value + ' trên 5 sao'}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={15}
          fill={star <= Math.round(value) ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function Detail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);
  const { add, favorites, toggleFavorite } = useStore();
  const navigate = useNavigate();
  usePageTitle(product?.name || 'Chi tiết sản phẩm');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setReviews([]);
    setRelated([]);
    setActiveImage(0);
    setQty(1);

    catalogApi
      .getProduct(id)
      .then((p) => {
        if (!active) return;
        setProduct(p);
        setSelectedVariant(getDefaultVariant(p));

        // Secondary sections must not take the product page down when they fail.
        catalogApi
          .getProductReviews(p.id)
          .then((res) => active && setReviews(res.data || []))
          .catch(() => {});
        if (p.category?.slug) {
          catalogApi
            .getProducts({ category: p.category.slug, pageSize: 5 })
            .then((res) => {
              if (active) setRelated((res.data || []).filter((x) => x.id !== p.id).slice(0, 4));
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!active) return;
        setProduct(null);
        setLoadError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, retryCount]);

  if (loading) {
    return (
      <div className="container page-pad">
        <div className="detail-layout">
          <div className="detail-photo skeleton" />
          <BlockSkeleton label="Đang tải chi tiết sản phẩm..." rows={6} />
        </div>
      </div>
    );
  }

  if (!product) {
    const notFound = loadError?.status === 404;
    return (
      <div className="container empty-state">
        <PackageSearch size={54} aria-hidden="true" />
        <h1>{notFound ? 'Không tìm thấy sản phẩm' : 'Không thể tải sản phẩm'}</h1>
        <p>
          {notFound
            ? 'Sản phẩm có thể đã ngừng kinh doanh.'
            : loadError?.message || 'Vui lòng thử lại sau.'}
        </p>
        <div className="empty-actions">
          {!notFound && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setRetryCount(retryCount + 1)}
            >
              <RotateCw size={17} aria-hidden="true" /> THỬ LẠI
            </button>
          )}
          <Link className={notFound ? 'btn btn-primary' : 'btn btn-outline'} to="/products">
            QUAY LẠI CỬA HÀNG
          </Link>
        </div>
      </div>
    );
  }

  const images = product.imageUrls?.length ? product.imageUrls : [FALLBACK_PRODUCT_IMAGE];
  const currentPrice = selectedVariant?.price || 0;
  const oldPrice = selectedVariant?.oldPrice;
  const discount = getDiscountPercent(currentPrice, oldPrice);
  const canBuy = isVariantInStock(selectedVariant);
  const maxStock = canBuy ? selectedVariant.stockQuantity : 0;
  const isFavorite = favorites.includes(product.id);
  const reviewCount = product.reviewCount ?? reviews.length;

  const handleAddToCart = async () => {
    setPendingAction('add');
    await add(selectedVariant.id, qty);
    setPendingAction(null);
  };

  const handleBuyNow = async () => {
    setPendingAction('buy');
    const res = await add(selectedVariant.id, qty, { silent: true });
    setPendingAction(null);
    if (res.success) navigate('/checkout');
  };

  return (
    <div className="container page-pad">
      <Breadcrumbs
        items={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Cửa hàng', to: '/products' },
          { label: product.name },
        ]}
      />
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            <img
              src={images[activeImage]}
              alt={product.name}
              width="800"
              height="800"
              onError={showFallbackImage}
            />
          </div>
          {images.length > 1 && (
            <div className="detail-thumbs" role="group" aria-label="Chọn ảnh sản phẩm">
              {images.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  className={index === activeImage ? 'active' : ''}
                  aria-label={`Xem ảnh ${index + 1}`}
                  aria-pressed={index === activeImage}
                  onClick={() => setActiveImage(index)}
                >
                  <img src={url} alt="" width="80" height="80" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <section className="detail-info" aria-label="Thông tin sản phẩm">
          <span className="eyebrow">
            {product.category?.name?.toUpperCase()}
            {product.brand?.name ? ` / ${product.brand.name.toUpperCase()}` : ''}
          </span>
          <div className="detail-title">
            <h1>
              {product.name}
              <span className="dot">.</span>
            </h1>
            <button
              type="button"
              className={'favorite ' + (isFavorite ? 'selected' : '')}
              aria-label={'Yêu thích ' + product.name}
              aria-pressed={isFavorite}
              onClick={() => toggleFavorite(product.id)}
            >
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          </div>
          {product.ratingAverage > 0 ? (
            <a className="rating" href="#reviews">
              <Stars value={product.ratingAverage} /> {product.ratingAverage}
              <span>({reviewCount} đánh giá)</span>
            </a>
          ) : (
            <p className="rating">
              <span>Chưa có đánh giá</span>
            </p>
          )}
          <div className="detail-price">
            {money(currentPrice)}
            {discount > 0 && (
              <>
                <del>{money(oldPrice)}</del>
                <span className="detail-discount">-{discount}%</span>
              </>
            )}
          </div>
          {product.description && <p className="detail-description">{product.description}</p>}

          {product.variants?.length > 0 && (
            <fieldset className="variant-picker">
              <legend>Chọn phiên bản</legend>
              <div className="variant-chips">
                {product.variants.map((v) => {
                  const available = isVariantInStock(v);
                  return (
                    <label
                      key={v.id}
                      className={
                        'variant-chip' +
                        (selectedVariant?.id === v.id ? ' active' : '') +
                        (available ? '' : ' is-disabled')
                      }
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="variant"
                        checked={selectedVariant?.id === v.id}
                        disabled={!available}
                        onChange={() => {
                          setSelectedVariant(v);
                          setQty(1);
                        }}
                      />
                      {localizeVariantName(v.name)}
                      {!available && <span className="sr-only"> (hết hàng)</span>}
                    </label>
                  );
                })}
              </div>
              <p className={'variant-stock-info ' + (canBuy && maxStock <= 5 ? 'low' : '')}>
                {!canBuy
                  ? 'Sản phẩm tạm hết hàng'
                  : maxStock <= 5
                    ? `Chỉ còn ${maxStock} sản phẩm`
                    : 'Còn hàng'}
                {selectedVariant?.sku && <span> · Mã: {selectedVariant.sku}</span>}
              </p>
            </fieldset>
          )}

          <div className="quantity-row">
            <span id="quantity-label">Số lượng</span>
            <div className="qty-control" role="group" aria-labelledby="quantity-label">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={qty <= 1}
                onClick={() => setQty(Math.max(1, qty - 1))}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <output>{qty}</output>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={qty >= maxStock}
                onClick={() => setQty(Math.min(maxStock, qty + 1))}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canBuy || pendingAction !== null}
              onClick={handleAddToCart}
            >
              <ShoppingBag size={18} aria-hidden="true" />
              {pendingAction === 'add' ? 'ĐANG THÊM...' : canBuy ? 'THÊM VÀO GIỎ' : 'TẠM HẾT HÀNG'}
            </button>
            {canBuy && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={pendingAction !== null}
                onClick={handleBuyNow}
              >
                {pendingAction === 'buy' ? 'ĐANG XỬ LÝ...' : 'MUA NGAY'}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="detail-assurance">
            <li>
              <Truck size={19} aria-hidden="true" /> Giao hàng nhanh 2-3 ngày
            </li>
            <li>
              <ShieldCheck size={19} aria-hidden="true" /> Bảo hành chính hãng
            </li>
          </ul>
          {product.specs?.length > 0 && (
            <div className="detail-specs">
              <h2>Thông số & đặc tính</h2>
              <ul>
                {product.specs.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="reviews-section" id="reviews">
        <h2>
          ĐÁNH GIÁ KHÁCH HÀNG ({reviewCount})<span className="dot">.</span>
        </h2>
        {reviews.length ? (
          <div className="reviews-list">
            {reviews.map((r) => (
              <article key={r.id} className="review-item">
                <div className="review-header">
                  <strong>{r.userName}</strong>
                  <time dateTime={r.createdAt}>{formatDate(r.createdAt)}</time>
                </div>
                <Stars value={r.rating} />
                <p>{r.comment}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted-text">Chưa có đánh giá nào cho sản phẩm này.</p>
        )}
      </section>

      {related.length > 0 && (
        <section className="related">
          <h2>
            CÓ THỂ BẠN CŨNG THÍCH<span className="dot">.</span>
          </h2>
          <div className="products-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
