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
          <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <div className="product-meta">
        <span>{product.category?.name || 'Cầu lông'}</span>
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
    </article>
  );
}
