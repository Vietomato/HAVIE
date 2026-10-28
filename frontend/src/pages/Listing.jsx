import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard.jsx';

export default function Listing() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || 'All';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'featured';
  const [draft, setDraft] = useState(q);
  const [productsList, setProductsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');

  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    catalogApi
      .getCategories()
      .then(setCategoriesList)
      .catch((error) => setCategoriesError(error.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setProductsError('');
    catalogApi
      .getProducts({ category, q, sort })
      .then((res) => {
        setProductsList(res.data || []);
      })
      .catch((error) => {
        setProductsList([]);
        setProductsError(error.message);
      })
      .finally(() => setLoading(false));
  }, [category, q, sort]);

  const change = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'All' || value === 'featured') next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">TRANG CHỦ</Link> / CỬA HÀNG
      </p>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BỘ SƯU TẬP HAVIE</span>
          <h1>
            BỘ SƯU TẬP<span className="dot">.</span>
          </h1>
          <p>Trang bị chỉn chu cho mọi trình độ và phong cách chơi.</p>
        </div>
        <span>{productsList.length} SẢN PHẨM</span>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <h2>
            <SlidersHorizontal size={19} /> BỘ LỌC
          </h2>
          <h3>DANH MỤC</h3>
          <div className="filter-options">
            <button
              className={category === 'All' ? 'active' : ''}
              onClick={() => change('category', 'All')}
            >
              Tất cả
            </button>
            {categoriesList.map((c) => (
              <button
                key={c.id}
                className={category === c.slug || category === c.name ? 'active' : ''}
                onClick={() => change('category', c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {categoriesError && <p role="alert">{categoriesError}</p>}
          <p className="filter-tip">Chọn trang bị phù hợp cho trận đấu tiếp theo của bạn.</p>
        </aside>
        <section className="catalog-main" aria-label="Danh sách sản phẩm">
          <div className="catalog-toolbar">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change('q', draft);
              }}
            >
              <label className="sr-only" htmlFor="catalog-search">
                Tìm trong danh mục sản phẩm
              </label>
              <Search size={18} />
              <input
                id="catalog-search"
                placeholder="Tìm trong bộ sưu tập"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit">Tìm kiếm</button>
            </form>
            <label className="sort-select">
              SẮP XẾP:{' '}
              <select value={sort} onChange={(e) => change('sort', e.target.value)}>
                <option value="featured">Nổi bật</option>
                <option value="price_asc">Giá: thấp đến cao</option>
                <option value="price_desc">Giá: cao đến thấp</option>
                <option value="rating_desc">Đánh giá cao</option>
              </select>
              <ChevronDown size={16} />
            </label>
          </div>
          {loading ? (
            <p>Đang tải danh sách sản phẩm...</p>
          ) : productsError ? (
            <div className="empty-state" role="alert">
              <h2>Không thể tải sản phẩm.</h2>
              <p>{productsError}</p>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                THỬ LẠI
              </button>
            </div>
          ) : productsList.length ? (
            <div className="products-grid catalog-grid">
              {productsList.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Không tìm thấy sản phẩm.</h2>
              <p>Hãy thử từ khóa hoặc danh mục khác.</p>
              <button className="btn btn-primary" onClick={() => setParams({})}>
                XÓA BỘ LỌC
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
