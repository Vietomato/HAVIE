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
import { catalogApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';
import { localizeVariantName } from '../utils/product.js';

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
  const [reviews, setReviews] = useState([]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
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
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container empty-state">
        <h1>Không thể hiển thị sản phẩm</h1>
        {productError && <p role="alert">{productError}</p>}

        <Link className="btn btn-primary" to="/products">
          QUAY LẠI CỬA HÀNG
        </Link>
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
          <span className="eyebrow">
            {product.category?.name?.toUpperCase()} / HIỆU SUẤT HAVIE
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
              >
                <Minus size={16} />
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
                <Plus size={16} />
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
            </button>
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
        )}
      </section>
    </div>
  );
}