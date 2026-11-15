import React from 'react';
import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart } from 'lucide-react';
import { catalogApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { RevealItem } from '../components/motion.jsx';

export default function Favorites() {
  usePageTitle('Sản phẩm yêu thích');
  const { favorites, toggleFavorite } = useStore();
  // Snapshot of the saved ids: un-favoriting filters the list below without refetching.
  const [savedIds] = useState(favorites);
  const results = useQueries({
    queries: savedIds.map((id) => ({
      queryKey: ['product', id],
      queryFn: () => catalogApi.getProduct(id),
    })),
  });
  const loading = results.some((r) => r.isPending);
  const products = results.filter((r) => r.data).map((r) => r.data);

  // Products that no longer exist cannot be shown, so drop them from the saved list.
  useEffect(() => {
    results.forEach((result, index) => {
      if (result.error?.status === 404 && favorites.includes(savedIds[index])) toggleFavorite(savedIds[index]);
    });
  }, [results.map((r) => r.status).join()]);

  const visible = products.filter((product) => favorites.includes(product.id));

  return (
    <div className="container page-pad">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Yêu thích' }]} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">DANH SÁCH CỦA BẠN</span>
          <h1>
            SẢN PHẨM YÊU THÍCH
          </h1>
          <p>Danh sách được lưu trên trình duyệt này.</p>
        </div>
        {!loading && <span>{visible.length} sản phẩm</span>}
      </div>
      {loading ? (
        <ProductGridSkeleton count={Math.min(favorites.length, 4)} />
      ) : visible.length ? (
        <div className="products-grid">
          {visible.map((product, index) => (
            <RevealItem key={product.id} index={index}>
              <ProductCard product={product} />
            </RevealItem>
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
