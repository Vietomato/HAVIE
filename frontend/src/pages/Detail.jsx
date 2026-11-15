import React from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Plus, Minus, Star, Truck, ShieldCheck, Heart, RotateCw, PackageSearch } from 'lucide-react';
import { formatDate, money } from '../data';
import { useProduct, useProductReviews, useProducts } from '../api/queries.js';
import { useStore } from '../context/StoreContext.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { BlockSkeleton } from '../components/Skeleton.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { RevealItem } from '../components/motion.jsx';
import { describeScalePosition, parseSpecScale } from '../utils/specScale.js';
import {
  FALLBACK_PRODUCT_IMAGE,
  getDefaultVariant,
  getProductSpecifications,
  getShoeColor,
  getShoeSize,
  usesShoePicker,
  getDiscountPercent,
  hasValidPrice,
  isVariantActive,
  isVariantPurchasable,
  localizeVariantName,
  showFallbackImage,
} from '../utils/product.js';

function getAttributes(variant) {
  const attributes = variant?.attributes;
  return attributes && typeof attributes === 'object' && !Array.isArray(attributes)
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
  const hasRealName = originalName && !/^default title$/i.test(originalName);
  const parts = [];

  if (categorySlug === 'shoes') {
    const size = Number(String(attributes.size ?? '').replace(',', '.'));
    const system = String(attributes.sizeSystem ?? '').trim().toUpperCase();
    const hasSize = Number.isFinite(size) && size > 0 && ['EU', 'US', 'UK', 'CM'].includes(system);

    if (hasSize) parts.push(`${system} ${size}`);
    if (attributes.color) parts.push(String(attributes.color));
    if (hasSize) return parts.join(' / ');
    if (hasRealName) return `${localizeVariantName(originalName)} — chưa cập nhật size`;
    return parts.length ? `${parts.join(' / ')} — chưa cập nhật size` : 'Chưa cập nhật size';
  }

  if (attributes.weight) parts.push(String(attributes.weight));
  if (attributes.grip) parts.push(String(attributes.grip));
  if (attributes.color) parts.push(String(attributes.color));
  if (parts.length) return parts.join(' / ');
  return hasRealName ? localizeVariantName(originalName) : 'Phiên bản tiêu chuẩn';
}

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
  const productQuery = useProduct(id);
  const product = productQuery.data || null;
  const loading = productQuery.isPending || (productQuery.isError && productQuery.isFetching);
  const loadError = productQuery.error;
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [pendingAction, setPendingAction] = useState(null);
  const [syncedProductId, setSyncedProductId] = useState(null);

  // Secondary sections must not take the product page down when they fail.
  const reviewsQuery = useProductReviews(product?.id);
  const reviews = reviewsQuery.data?.data || [];
  const reviewsError = reviewsQuery.error
    ? reviewsQuery.error.message || 'Chưa tải được đánh giá.'
    : '';
  const categorySlugForRelated = product?.category?.slug;
  const relatedQuery = useProducts(
    { category: categorySlugForRelated, pageSize: 5 },
    { enabled: Boolean(categorySlugForRelated) },
  );
  const related = (relatedQuery.data?.data || []).filter((x) => x.id !== product?.id).slice(0, 4);

  // Reset the per-product selection whenever a different product is shown.
  if (product && product.id !== syncedProductId) {
    setSyncedProductId(product.id);
    setSelectedVariant(usesShoePicker(product) ? null : getDefaultVariant(product));
    setSelectedColor(null);
    setActiveImage(0);
    setQty(1);
  }

  const { add, favorites, toggleFavorite } = useStore();
  const navigate = useNavigate();
  usePageTitle(product?.name || 'Chi tiết sản phẩm');

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
              onClick={() => productQuery.refetch()}
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

  const allVariants = product.variants || [];
  const variants = allVariants.filter(isVariantActive);
  const shoePicker = usesShoePicker(product);
  const shoeColors = shoePicker
    ? [...new Set(variants.map(getShoeColor).filter(Boolean))]
    : [];
  const needsColorChoice = shoeColors.length > 1;
  const activeColor = needsColorChoice ? selectedColor : shoeColors[0] || null;
  const shoeSizeVariants = shoePicker
    ? variants.filter((v) => !shoeColors.length || getShoeColor(v) === activeColor)
    : [];
  const shoeSizes = [...new Set(shoeSizeVariants.map(getShoeSize).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const selectedSize = selectedVariant ? getShoeSize(selectedVariant) : null;
  const previewVariant =
    selectedVariant ||
    (shoePicker && activeColor ? variants.find((v) => getShoeColor(v) === activeColor) : null);
  const variantImages = getImages(getAttributes(previewVariant).imageUrls);
  const specifications = getProductSpecifications(product, selectedVariant);
  const productImages = getImages(product.imageUrls);
  // Shared images may show another color, so never mix them into a variant's gallery.
  const galleryImages = variantImages.length ? variantImages : productImages;
  const images = galleryImages.length ? galleryImages : [FALLBACK_PRODUCT_IMAGE];
  const showsSharedImages =
    variantImages.length === 0 &&
    variants.some((v) => getImages(getAttributes(v).imageUrls).length > 0);
  const categorySlug = product.category?.slug;
  const priceVariant =
    selectedVariant || variants.find(hasValidPrice) || allVariants.find(hasValidPrice);
  const currentPrice = priceVariant?.price;
  const oldPrice = priceVariant?.oldPrice;
  const discount = getDiscountPercent(currentPrice, oldPrice);
  const canBuy = isVariantPurchasable(selectedVariant);
  const maxStock = canBuy ? selectedVariant.stockQuantity : 0;
  const isFavorite = favorites.includes(product.id);
  const reviewCount = product.reviewCount ?? reviews.length;

  const chooseShoeColor = (color) => {
    setSelectedColor(color);
    const sameSize = selectedSize
      ? variants.find((v) => getShoeColor(v) === color && getShoeSize(v) === selectedSize)
      : null;
    setSelectedVariant(sameSize && isVariantPurchasable(sameSize) ? sameSize : null);
    setActiveImage(0);
    setQty(1);
  };

  const missingShoeChoice =
    shoePicker && !selectedVariant
      ? needsColorChoice && !activeColor
        ? 'Vui lòng chọn mẫu và size trước khi đặt hàng'
        : 'Vui lòng chọn size trước khi đặt hàng'
      : '';

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
              alt={
                product.name +
                (selectedVariant ? ' — ' + getVariantLabel(selectedVariant, categorySlug) : '')
              }
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
                  <img
                    src={url}
                    alt=""
                    width="80"
                    height="80"
                    loading="lazy"
                    onError={showFallbackImage}
                  />
                </button>
              ))}
            </div>
          )}
          {showsSharedImages && (
            <p className="muted-text">
              Ảnh chung của sản phẩm; chưa có ảnh riêng cho phiên bản đang chọn.
            </p>
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
          <small className="muted-text">Giá niêm yết</small>
          <div className="detail-price">
            {hasValidPrice(priceVariant) ? money(currentPrice) : 'Liên hệ báo giá'}
            {discount > 0 && (
              <>
                <del>{money(oldPrice)}</del>
                <span className="detail-discount">-{discount}%</span>
              </>
            )}
          </div>
          {product.description && <p className="detail-description">{product.description}</p>}

          {shoePicker ? (
            <>
              {needsColorChoice && (
                <fieldset className="variant-picker">
                  <legend>Chọn mẫu / màu sắc</legend>
                  <div className="variant-chips">
                    {shoeColors.map((color) => (
                      <label
                        key={color}
                        className={'variant-chip' + (activeColor === color ? ' active' : '')}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="shoe-color"
                          checked={activeColor === color}
                          onChange={() => chooseShoeColor(color)}
                        />
                        {color}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset className="variant-picker" disabled={needsColorChoice && !activeColor}>
                <legend>Chọn size</legend>
                <div className="variant-chips">
                  {shoeSizes.map((size) => {
                    const sizeVariant = shoeSizeVariants.find((v) => getShoeSize(v) === size);
                    const available = Boolean(activeColor || !needsColorChoice) &&
                      isVariantPurchasable(sizeVariant);
                    return (
                      <label
                        key={size}
                        className={
                          'variant-chip' +
                          (selectedSize === size ? ' active' : '') +
                          (available ? '' : ' is-disabled')
                        }
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="shoe-size"
                          checked={selectedSize === size}
                          disabled={!available}
                          onChange={() => {
                            setSelectedVariant(sizeVariant);
                            setQty(1);
                          }}
                        />
                        {size}
                        {!available && activeColor && <span className="sr-only"> (hết hàng)</span>}
                      </label>
                    );
                  })}
                </div>
                <p
                  className={
                    'variant-stock-info ' + (canBuy && maxStock <= 5 ? 'low' : '')
                  }
                  role={missingShoeChoice ? 'status' : undefined}
                >
                  {missingShoeChoice ||
                    (!canBuy
                      ? 'Sản phẩm tạm hết hàng'
                      : maxStock <= 5
                        ? `Chỉ còn ${maxStock} sản phẩm`
                        : 'Còn hàng')}
                </p>
              </fieldset>
            </>
          ) : variants.length > 0 ? (
            <fieldset className="variant-picker">
              <legend>{categorySlug === 'shoes' ? 'Chọn size / màu sắc' : 'Chọn phiên bản'}</legend>
              <div className="variant-chips">
                {variants.map((v) => {
                  const available = isVariantPurchasable(v);
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
                          setActiveImage(0);
                          setQty(1);
                        }}
                      />
                      {getVariantLabel(v, categorySlug)}
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
              </p>
            </fieldset>
          ) : (
            <p className="variant-stock-info">Chưa có phiên bản đang bán.</p>
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
              {pendingAction === 'add'
                ? 'ĐANG THÊM...'
                : canBuy
                  ? 'THÊM VÀO GIỎ'
                  : missingShoeChoice
                    ? needsColorChoice && !activeColor ? 'CHỌN MẪU VÀ SIZE' : 'CHỌN SIZE'
                    : 'TẠM HẾT HÀNG'}
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
          {specifications.length > 0 && (
            <div className="detail-specs">
              <h2>Thông số & đặc tính</h2>
              <ul>
                {specifications.map((s, index) => {
                  const scale = parseSpecScale(s);
                  if (!scale) return <li key={`${index}-${s}`}>{s}</li>;
                  return (<li key={`${index}-${s}`} className="spec-scale" aria-label={`${scale.label}: ${describeScalePosition(scale, scale.label)}`}><div className="spec-scale__top"><span className="spec-scale__label">{scale.label}</span><strong className="spec-scale__value">{describeScalePosition(scale, scale.label)}</strong></div><div className="spec-scale__track" aria-hidden="true">{Array.from({ length: scale.steps }, (_, step) => (<span key={step} className={step === scale.position ? 'active' : ''} />))}</div><div className="spec-scale__ends" aria-hidden="true"><span>{scale.left}</span><span>{scale.right}</span></div></li>);
                })}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="reviews-section" id="reviews">
        <h2>
          ĐÁNH GIÁ KHÁCH HÀNG ({reviewCount})
        </h2>
        {reviewsError ? (
          <p className="muted-text" role="alert">
            {reviewsError}
          </p>
        ) : reviews.length ? (
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
            CÓ THỂ BẠN CŨNG THÍCH
          </h2>
          <div className="products-grid">
            {related.map((p, index) => (
              <RevealItem key={p.id} index={index}>
                <ProductCard product={p} />
              </RevealItem>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
