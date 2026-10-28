import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Star, Heart } from 'lucide-react';
import { money } from '../data';
import { useStore } from '../context/StoreContext.jsx';

export default function ProductCard({ product }) {
  const { add, favorites, toggleFavorite } = useStore();
  const navigate = useNavigate();
  const defaultVariant = product.variants?.[0];
  const displayPrice = defaultVariant?.price || 0;
  const imageUrl = product.imageUrls?.[0] || '/images/product-1.svg';

  return (
    <article className="product-card">
      <div className="product-media">
        <Link to={'/products/' + (product.slug || product.id)} aria-label={'View ' + product.name}>
          <img src={imageUrl} alt={product.name} loading="lazy" />
        </Link>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button
          className={'favorite ' + (favorites.includes(product.id) ? 'selected' : '')}
          aria-label={'Favorite ' + product.name}
          onClick={() => toggleFavorite(product.id)}
        >
          <Heart size={19} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="product-meta">
        <span>{product.category?.name || 'Badminton'}</span>
        <span>
          <Star size={13} fill="currentColor" /> {product.ratingAverage || 5.0}
        </span>
      </div>
      <Link to={'/products/' + (product.slug || product.id)} className="product-name">
        {product.name}
      </Link>
      <div className="product-bottom">
        <strong>{money(displayPrice)}</strong>
        <button
          className="add-small"
          aria-label={'Add ' + product.name + ' to cart'}
          onClick={async () => {
            if (defaultVariant) {
              await add(defaultVariant.id, 1);
              navigate('/cart');
            }
          }}
        >
          <Plus size={19} />
        </button>
      </div>
    </article>
  );
}
