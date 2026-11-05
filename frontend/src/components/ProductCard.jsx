import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Star, Heart } from 'lucide-react';
import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Star, Heart, ChevronRight, LoaderCircle } from 'lucide-react';
import { money } from '../data';
import { useStore } from '../context/StoreContext.jsx';
import {
  FALLBACK_PRODUCT_IMAGE,
  PRODUCT_BADGE_LABELS,
  getDefaultVariant,
  getDiscountPercent,
  getProductPath,
  isVariantInStock,
  showFallbackImage,
} from '../utils/product.js';

export default function ProductCard({ product }) {
  const { add, favorites, toggleFavorite } = useStore();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const variants = Array.isArray(product.variants)
    ? product.variants
    : [];

  const pricedVariants = variants.filter(
    (variant) =>
      Number.isSafeInteger(variant.price) &&
      variant.price > 0,
  );

  const purchasableVariants = pricedVariants.filter(
    (variant) =>
      variant.isAvailable === true &&
      variant.stockQuantity > 0,
  );

  // Ưu tiên giá của biến thể đang bán, còn hàng.
  // Nếu chưa có hàng, vẫn hiển thị giá đã lưu trong database.
  const displayVariants = purchasableVariants.length
    ? purchasableVariants
    : pricedVariants;

  const displayVariant = displayVariants.reduce(
    (lowest, variant) =>
      !lowest || variant.price < lowest.price ? variant : lowest,
    null,
  );

  const canBuy = purchasableVariants.length > 0;
  const isReferencePrice = !canBuy && Boolean(displayVariant);
  const productUrl = '/products/' + (product.slug || product.id);
  const imageUrl = product.imageUrls?.[0] || '/images/product-1.svg';
  const isFavorite = favorites.includes(product.id);

  async function handleAdd() {
    if (!canBuy || !displayVariant || adding) return;

    setAdding(true);
    setError('');

    try {
      await add(displayVariant.id, 1);
      navigate('/cart');
    } catch (err) {
      setError(err?.message || 'Chưa thể thêm sản phẩm vào giỏ.');
    } finally {
      setAdding(false);
    }
  }
  const [adding, setAdding] = useState(false);
  const variant = getDefaultVariant(product);
  const variants = product.variants || [];
  const inStock = variants.some(isVariantInStock);
  const hasOptions = variants.length > 1;
  const hasPriceRange = new Set(variants.map(({ price }) => price)).size > 1;
  const lowestPrice = variants.length ? Math.min(...variants.map(({ price }) => price)) : 0;
  const discount = getDiscountPercent(variant?.price, variant?.oldPrice);
  const isFavorite = favorites.includes(product.id);
  const path = getProductPath(product);

  const handleAdd = async () => {
    setAdding(true);
    await add(variant.id, 1);
    setAdding(false);
  };

  return (
    <article className={'product-card' + (inStock ? '' : ' is-sold-out')}>
      <div className="product-media">
        <Link to={productUrl} aria-label={'Xem ' + product.name}>
          <img src={imageUrl} alt={product.name} loading="lazy" />
        </Link>

        {product.badge && (
          <span className="product-badge">
            {PRODUCT_BADGE_LABELS[product.badge] || product.badge}
          </span>
        )}

        <Link to={path} aria-label={'Xem ' + product.name}>
          <img
            src={product.imageUrls?.[0] || FALLBACK_PRODUCT_IMAGE}
            alt=""
            width="600"
            height="636"
            loading="lazy"
            onError={showFallbackImage}
          />
        </Link>
        <div className="product-tags">
          {!inStock && <span className="product-badge is-muted">HẾT HÀNG</span>}
          {inStock && discount > 0 && <span className="product-badge is-sale">-{discount}%</span>}
          {inStock && product.badge && (
            <span className="product-badge">
              {PRODUCT_BADGE_LABELS[product.badge] || product.badge}
            </span>
          )}
        </div>
        <button
          type="button"
          className={'favorite ' + (isFavorite ? 'selected' : '')}
          aria-label={'Yêu thích ' + product.name}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(product.id)}
        >
          <Heart
            size={19}
            fill={isFavorite ? 'currentColor' : 'none'}
          />
          <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      <div className="product-meta">
        <span>{product.category?.name || 'Cầu lông'}</span>
        <span>
          {product.reviewCount > 0 ? (
            <>
              <Star size={13} fill="currentColor" />{' '}
              {product.ratingAverage}
            </>
          ) : (
            'Chưa có đánh giá'
          )}
        </span>
      </div>

      <Link to={productUrl} className="product-name">
        {product.ratingAverage > 0 && (
          <span aria-label={'Đánh giá ' + product.ratingAverage + ' trên 5'}>
            <Star size={13} fill="currentColor" aria-hidden="true" /> {product.ratingAverage}
          </span>
        )}
      </div>
      <Link to={path} className="product-name">
        {product.name}
      </Link>

      <div className="product-bottom">
        <div>
          {isReferencePrice && (
            <small style={{ display: 'block' }}>Giá niêm yết</small>
          )}
          <strong>
            {displayVariant
              ? money(displayVariant.price)
              : 'Liên hệ báo giá'}
          </strong>
        </div>

        <button
          type="button"
          className="add-small"
          disabled={!canBuy || adding}
          aria-label={
            canBuy
              ? 'Thêm ' + product.name + ' vào giỏ hàng'
              : product.name + ' hiện chưa có hàng để đặt mua'
          }
          title={canBuy ? 'Thêm vào giỏ' : 'Chưa có hàng để đặt mua'}
          onClick={handleAdd}
          style={{
            opacity: !canBuy || adding ? 0.45 : 1,
            cursor: !canBuy || adding ? 'not-allowed' : 'pointer',
          }}
        >
          <Plus size={19} />
        </button>
        <div className="product-price">
          <strong>
            {hasPriceRange && <small>Từ </small>}
            {money(hasPriceRange ? lowestPrice : variant?.price || 0)}
          </strong>
          {!hasPriceRange && discount > 0 && <del>{money(variant.oldPrice)}</del>}
        </div>
        {inStock && hasOptions && (
          <Link className="add-small" to={path} aria-label={'Chọn phiên bản ' + product.name}>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        )}
        {inStock && !hasOptions && (
          <button
            type="button"
            className="add-small"
            aria-label={'Thêm ' + product.name + ' vào giỏ hàng'}
            disabled={adding}
            onClick={handleAdd}
          >
            {adding ? (
              <LoaderCircle className="spin" size={19} aria-hidden="true" />
            ) : (
              <Plus size={20} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {!canBuy && (
        <small style={{ display: 'block', marginTop: 8 }}>
          Chưa có hàng để đặt mua
        </small>
      )}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
    </article>
  );
}
}
