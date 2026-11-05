import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart } from 'lucide-react';
import { catalogApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

export default function Favorites() {
  usePageTitle('Sản phẩm yêu thích');
  const { favorites, toggleFavorite } = useStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(favorites.length > 0);

  // Loaded once: un-favoriting filters the list below without refetching.
  useEffect(() => {
    let active = true;

    Promise.allSettled(favorites.map((id) => catalogApi.getProduct(id))).then((results) => {
      if (!active) return;
      setProducts(results.filter((r) => r.status === 'fulfilled').map((r) => r.value));
      setLoading(false);

      // Products that no longer exist cannot be shown, so drop them from the saved list.
      results.forEach((result, index) => {
        if (result.status === 'rejected' && result.reason?.status === 404) {
          toggleFavorite(favorites[index]);
        }
      });
    });

    return () => {
      active = false;
    };
  }, []);

  const visible = products.filter((product) => favorites.includes(product.id));

  return (
    <div className="container page-pad">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Yêu thích' }]} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">DANH SÁCH CỦA BẠN</span>
          <h1>
            SẢN PHẨM YÊU THÍCH<span className="dot">.</span>
          </h1>
          <p>Danh sách được lưu trên trình duyệt này.</p>
        </div>
        {!loading && <span>{visible.length} sản phẩm</span>}
      </div>
      {loading ? (
        <ProductGridSkeleton count={Math.min(favorites.length, 4)} />
      ) : visible.length ? (
        <div className="products-grid">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Heart size={54} aria-hidden="true" />
          <h2>Chưa có sản phẩm yêu thích</h2>
          <p>Bấm vào biểu tượng trái tim trên sản phẩm để lưu lại xem sau.</p>
          <Link to="/products" className="btn btn-primary">
            KHÁM PHÁ SẢN PHẨM <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
