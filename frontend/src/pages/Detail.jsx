import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowRight,
  Plus,
  Minus,
  Star,
  Truck,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { money } from '../data';
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

const FALLBACK_IMAGE = '/images/product-1.svg';

function getAttributes(variant) {
  const attributes = variant?.attributes;

  return attributes &&
    typeof attributes === 'object' &&
    !Array.isArray(attributes)
    ? attributes
    : {};
}

function getImages(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((url) => typeof url === 'string')
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];
}

function getVariantLabel(variant, categorySlug) {
  const attributes = getAttributes(variant);
  const originalName = String(variant.name || '').trim();
  const hasRealName =
    originalName && !/^default title$/i.test(originalName);

  const parts = [];

  if (categorySlug === 'shoes') {
    const size = Number(
      String(attributes.size ?? '').replace(',', '.'),
    );

    const system = String(attributes.sizeSystem ?? '')
      .trim()
      .toUpperCase();

    const hasSize =
      Number.isFinite(size) &&
      size > 0 &&
      ['EU', 'US', 'UK', 'CM'].includes(system);

    if (hasSize) parts.push(`${system} ${size}`);
    if (attributes.color) parts.push(String(attributes.color));

    if (!hasSize) {
      return hasRealName
        ? `${localizeVariantName(originalName)} — chưa cập nhật size`
        : parts.length
          ? `${parts.join(' / ')} — chưa cập nhật size`
          : 'Chưa cập nhật size';
    }

    return parts.join(' / ');
  }

  if (attributes.weight) parts.push(String(attributes.weight));
  if (attributes.grip) parts.push(String(attributes.grip));
  if (attributes.color) parts.push(String(attributes.color));

  if (parts.length) return parts.join(' / ');

  return hasRealName
    ? localizeVariantName(originalName)
    : 'Phiên bản tiêu chuẩn';
}

function getStock(variant) {
  if (
    variant?.isAvailable !== true ||
    !Number.isSafeInteger(variant.stockQuantity)
  ) {
    return 0;
  }

  return Math.max(0, variant.stockQuantity);
}

function hasValidPrice(variant) {
  return Number.isSafeInteger(variant?.price) && variant.price > 0;
}

function ProductImage({ src, alt, ...props }) {
  const [failed, setFailed] = useState(false);

  return (
    <img
      {...props}
      src={failed ? FALLBACK_IMAGE : src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

export default function Detail() {
  const { id } = useParams();

  // Tạo lại trạng thái khi chuyển sang sản phẩm khác.
  return <ProductDetail key={id} productKey={id} />;
}

function ProductDetail({ productKey }) {
  const navigate = useNavigate();
  const { add } = useStore();

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [productError, setProductError] = useState('');
  const [reviewsError, setReviewsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const mountedRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    async function loadProduct() {
      try {
        const result = await catalogApi.getProduct(productKey);

        if (cancelled) return;

        if (!result?.id) {
          throw new Error('Không tìm thấy sản phẩm.');
        }

        setProduct(result);

        const availableVariants = Array.isArray(result.variants)
          ? result.variants.filter(
              (variant) => variant.isAvailable === true,
            )
          : [];

        setSelectedVariant(
          availableVariants.find(
            (variant) =>
              getStock(variant) > 0 && hasValidPrice(variant),
          ) ||
            availableVariants[0] ||
            null,
        );

        setLoading(false);

        try {
          const reviewResult =
            await catalogApi.getProductReviews(result.id);

          if (!cancelled) {
            setReviews(
              Array.isArray(reviewResult?.data)
                ? reviewResult.data
                : [],
            );
          }
        } catch (error) {
          if (!cancelled) {
            setReviewsError(
              error.message || 'Chưa tải được đánh giá.',
            );
          }
        } finally {
          if (!cancelled) setReviewsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setProductError(
            error.message || 'Không thể tải sản phẩm.',
          );
          setReviewsLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [productKey]);

  if (loading) {
    return (
      <div className="container page-pad" role="status">
        Đang tải chi tiết sản phẩm...
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
        <h1>Không thể hiển thị sản phẩm</h1>
        {productError && <p role="alert">{productError}</p>}

        <Link className="btn btn-primary" to="/products">
          QUAY LẠI CỬA HÀNG
        </Link>
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

  const allVariants = Array.isArray(product.variants)
    ? product.variants
    : [];

  const variants = allVariants.filter(
    (variant) => variant.isAvailable === true,
  );

  const priceVariant =
    selectedVariant ||
    variants.find(hasValidPrice) ||
    allVariants.find(hasValidPrice);

  const currentPrice = priceVariant?.price;
  const oldPrice = priceVariant?.oldPrice;
  const maxStock = getStock(selectedVariant);

  const canBuy =
    Boolean(selectedVariant) &&
    hasValidPrice(selectedVariant) &&
    maxStock > 0;

  const variantImages = getImages(
    getAttributes(selectedVariant).imageUrls,
  );

  const productImages = getImages(product.imageUrls);

  // Không trộn ảnh chung có thể khác màu vào gallery riêng.
  const galleryImages = variantImages.length
    ? variantImages
    : productImages;

  const imageUrl =
    galleryImages[activeImageIndex] ||
    galleryImages[0] ||
    FALLBACK_IMAGE;

  const variantLabel = selectedVariant
    ? getVariantLabel(selectedVariant, product.category?.slug)
    : '';

  const reviewCount = product.reviewCount ?? reviews.length;
  const rating = Number(product.ratingAverage);

  function selectVariant(variant) {
    if (submittingRef.current) return;

    setSelectedVariant(variant);
    setActiveImageIndex(0);
    setQty(1);
    setAdded(false);
    setActionError('');
  }

  async function submitPurchase(buyNow) {
    if (
      submittingRef.current ||
      !canBuy ||
      !Number.isSafeInteger(qty) ||
      qty < 1 ||
      qty > maxStock
    ) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setAdded(false);
    setActionError('');

    try {
      const result = await add(selectedVariant.id, qty);

      if (!mountedRef.current) return;

      if (!result?.success) {
        setActionError(
          result?.error?.message ||
            'Không thể thêm sản phẩm vào giỏ hàng.',
        );
        return;
      }

      if (buyNow) {
        navigate('/checkout');
      } else {
        setAdded(true);
      }
    } catch (error) {
      if (mountedRef.current) {
        setActionError(
          error.message || 'Không thể thêm sản phẩm vào giỏ hàng.',
        );
      }
    } finally {
      submittingRef.current = false;

      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">TRANG CHỦ</Link> /{' '}
        <Link to="/products">CỬA HÀNG</Link> /{' '}
        {product.name.toUpperCase()}
      </p>

      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            <ProductImage
              key={imageUrl}
              src={imageUrl}
              alt={
                product.name +
                (variantLabel ? ` — ${variantLabel}` : '')
              }
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          <div
            className="detail-thumbs"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {galleryImages.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={`Xem ảnh ${index + 1} của ${product.name}`}
                aria-pressed={activeImageIndex === index}
                onClick={() => setActiveImageIndex(index)}
                style={{
                  padding: 3,
                  background: '#fff',
                  cursor: 'pointer',
                  border:
                    activeImageIndex === index
                      ? '2px solid #166534'
                      : '1px solid #dbe3ee',
                  borderRadius: 8,
                }}
              >
                <ProductImage
                  key={url}
                  src={url}
                  alt={`${product.name} — ảnh ${index + 1}`}
                  loading="lazy"
                  style={{
                    display: 'block',
                    width: 64,
                    height: 64,
                    objectFit: 'contain',
                  }}
                />
              </button>
            ))}
          </div>

          {selectedVariant && variantImages.length === 0 && (
            <p className="filter-tip">
              Ảnh chung của sản phẩm; chưa có ảnh riêng cho
              phiên bản đang chọn.
            </p>
          )}
        </div>

        <section className="detail-info">
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

          <h1>
            {product.name}
            <span className="dot">.</span>
          </h1>

          <div className="rating">
            {reviewCount > 0 && Number.isFinite(rating) ? (
              <>
                <Star size={16} fill="currentColor" />
                {' '}{rating}{' '}
                <span>• ({reviewCount} đánh giá khách hàng)</span>
              </>
            ) : (
              <span>Chưa có đánh giá khách hàng</span>
            )}
          </div>

          <small>Giá niêm yết</small>

          <div className="detail-price">
            {Number.isSafeInteger(currentPrice) && currentPrice > 0
              ? money(currentPrice)
              : 'Liên hệ báo giá'}

            {Number.isFinite(oldPrice) &&
              oldPrice > currentPrice && (
                <del>{money(oldPrice)}</del>
              )}
          </div>

          {product.description && (
            <p className="detail-description">
              {product.description}
            </p>
          )}

          <div className="variant-picker">
            <p>
              <strong>
                {product.category?.slug === 'shoes'
                  ? 'CHỌN SIZE / MÀU SẮC:'
                  : 'CHỌN PHIÊN BẢN:'}
              </strong>
            </p>

            {variants.length > 0 ? (
              <div className="variant-chips">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={
                      'variant-chip ' +
                      (selectedVariant?.id === variant.id
                        ? 'active'
                        : '')
                    }
                    aria-pressed={selectedVariant?.id === variant.id}
                    disabled={submitting}
                    onClick={() => selectVariant(variant)}
                  >
                    {getVariantLabel(
                      variant,
                      product.category?.slug,
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p>Chưa có phiên bản đang bán.</p>
            )}

            <div
              className={
                'variant-stock-info ' +
                (maxStock <= 5 ? 'low' : '')
              }
            >
              {selectedVariant
                ? maxStock > 0
                  ? `SKU: ${selectedVariant.sku} • Tồn kho: ${maxStock} sản phẩm`
                  : 'Phiên bản này hiện chưa có hàng.'
                : 'Chưa có phiên bản để lựa chọn.'}
            </div>
          </div>

          <div className="detail-specs">
            <h3>THÔNG SỐ & ĐẶC TÍNH</h3>

            {product.specs?.length > 0 ? (
              <ul>
                {product.specs.map((spec, index) => (
                  <li key={`${index}-${spec}`}>{spec}</li>
                ))}
              </ul>
            ) : (
              <p>Thông số chi tiết đang được cập nhật.</p>
            )}
          </div>

          <div className="quantity-row">
            <span>SỐ LƯỢNG</span>

            <div className="qty-control">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={!canBuy || submitting || qty <= 1}
                onClick={() =>
                  setQty((current) => Math.max(1, current - 1))
                }
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

              <output aria-live="polite">{qty}</output>

              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={!canBuy || submitting || qty >= maxStock}
                onClick={() =>
                  setQty((current) =>
                    Math.min(maxStock, current + 1),
                  )
                }
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canBuy || submitting}
              onClick={() => submitPurchase(false)}
            >
              <ShoppingBag size={18} />
              {submitting ? 'ĐANG XỬ LÝ...' : 'THÊM VÀO GIỎ HÀNG'}
            </button>

            <button
              type="button"
              className="btn btn-outline"
              disabled={!canBuy || submitting}
              onClick={() => submitPurchase(true)}
            >
              MUA NGAY <ArrowRight size={17} />
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

          {actionError && (
            <p role="alert" style={{ color: '#b91c1c' }}>
              {actionError}
            </p>
          )}

          {added && (
            <p className="success-message" role="status">
              <CheckCircle2 size={17} />
              Đã thêm vào giỏ hàng.{' '}
              <Link to="/cart">Xem giỏ hàng →</Link>
            </p>
          )}

          <div className="detail-assurance">
            <Truck size={19} /> Giao hàng nhanh 2-3 ngày
            <ShieldCheck size={19} /> Bảo hành chính hãng
          </div>
        </section>
      </div>

      <section className="reviews-section">
        <h2>
          ĐÁNH GIÁ KHÁCH HÀNG ({reviewCount})
          <span className="dot">.</span>
        </h2>

        {reviewsLoading ? (
          <p role="status">Đang tải đánh giá...</p>
        ) : reviewsError ? (
          <p role="alert">{reviewsError}</p>
        ) : reviews.length > 0 ? (
          <div>
            {reviews.map((review) => (
              <div key={review.id} className="review-item">
                <div className="review-header">
                  <strong>{review.userName}</strong>

                  <span>
                    <Star size={14} fill="currentColor" />
                    {' '}{review.rating}/5 •{' '}
                    {new Date(
                      review.createdAt,
                    ).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <p>{review.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="filter-tip">
            Chưa có đánh giá nào cho sản phẩm này.
          </p>
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