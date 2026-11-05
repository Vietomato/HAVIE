import React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, X, RotateCw, SearchX } from 'lucide-react';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const PAGE_SIZE = 12;

const PRICE_RANGES = [
  { key: 'under-1m', label: 'Dưới 1 triệu', maxPrice: 999999 },
  { key: '1m-3m', label: '1 - 3 triệu', minPrice: 1000000, maxPrice: 3000000 },
  { key: '3m-5m', label: '3 - 5 triệu', minPrice: 3000000, maxPrice: 5000000 },
  { key: 'over-5m', label: 'Trên 5 triệu', minPrice: 5000000 },
];

const getPageNumbers = (current, total) => {
  const pages = [];
  for (let page = 1; page <= total; page += 1) {
    if (page === 1 || page === total || Math.abs(page - current) <= 1) pages.push(page);
  }
  return pages;
};

function FilterGroup({ title, options, value, onChange }) {
  return (
    <div className="filter-group">
      <h3 id={'filter-' + title}>{title}</h3>
      <div className="filter-options" role="group" aria-labelledby={'filter-' + title}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Listing() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || 'All';
  const brand = params.get('brand') || 'All';
  const price = params.get('price') || 'All';
  const inStock = params.get('inStock') === 'true';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'featured';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(q);
  const [productsList, setProductsList] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [categoriesList, setCategoriesList] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const activeCategory = categoriesList.find((c) => c.slug === category || c.name === category);
  const activeBrand = brandsList.find((b) => b.slug === brand);
  const activePrice = PRICE_RANGES.find((range) => range.key === price);
  usePageTitle(activeCategory?.name || 'Cửa hàng');

  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    catalogApi.getCategories().then(setCategoriesList).catch(() => setCategoriesList([]));
    catalogApi.getBrands().then(setBrandsList).catch(() => setBrandsList([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProductsError('');
    catalogApi
      .getProducts({
        category,
        brand,
        q,
        sort,
        page,
        pageSize: PAGE_SIZE,
        minPrice: activePriceValue(price, 'minPrice'),
        maxPrice: activePriceValue(price, 'maxPrice'),
        inStock: inStock ? 'true' : undefined,
      })
      .then((res) => {
        if (!active) return;
        setProductsList(res.data || []);
        setMeta(res.meta || { total: res.data?.length || 0, totalPages: 1 });
      })
      .catch((error) => {
        if (!active) return;
        setProductsList([]);
        setMeta({ total: 0, totalPages: 1 });
        setProductsError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, brand, price, inStock, q, sort, page, retryCount]);

  const change = (key, value) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (!value || value === 'All' || value === 'featured') next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  const activeFilters = [
    q && { key: 'q', label: `Từ khóa: ${q}` },
    activeCategory && { key: 'category', label: activeCategory.name },
    activeBrand && { key: 'brand', label: activeBrand.name },
    activePrice && { key: 'price', label: activePrice.label },
    inStock && { key: 'inStock', label: 'Còn hàng' },
  ].filter(Boolean);

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (sort !== 'featured') next.set('sort', sort);
    setParams(next);
  };

  return (
    <div className="container page-pad">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Cửa hàng' }]} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">BỘ SƯU TẬP HAVIE</span>
          <h1>
            {(activeCategory?.name || 'Tất cả sản phẩm').toUpperCase()}
            <span className="dot">.</span>
          </h1>
          <p>Trang bị chỉn chu cho mọi trình độ và phong cách chơi.</p>
        </div>
        <span role="status">{loading ? 'Đang tải...' : `${meta.total} sản phẩm`}</span>
      </div>
      <div className="catalog-toolbar">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            change('q', draft.trim());
          }}
        >
          <label className="sr-only" htmlFor="catalog-search">
            Tìm trong danh mục sản phẩm
          </label>
          <Search size={18} aria-hidden="true" />
          <input
            id="catalog-search"
            type="search"
            enterKeyHint="search"
            placeholder="Tìm trong bộ sưu tập"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit">Tìm</button>
        </form>
        <div className="catalog-toolbar-row">
          <button
            type="button"
            className="filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            Bộ lọc{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
          </button>
          <div className="sort-select">
            <label htmlFor="catalog-sort">Sắp xếp</label>
            <div>
              <select id="catalog-sort" value={sort} onChange={(e) => change('sort', e.target.value)}>
                <option value="featured">Nổi bật</option>
                <option value="newest">Mới nhất</option>
                <option value="price_asc">Giá: thấp đến cao</option>
                <option value="price_desc">Giá: cao đến thấp</option>
                <option value="rating_desc">Đánh giá cao</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <div className="catalog-layout">
        <aside
          id="catalog-filters"
          className={'filters' + (filtersOpen ? ' open' : '')}
          aria-label="Bộ lọc sản phẩm"
        >
          <h2>
            <SlidersHorizontal size={19} aria-hidden="true" /> BỘ LỌC
          </h2>
          <FilterGroup
            title="DANH MỤC"
            value={activeCategory?.slug || category}
            onChange={(value) => change('category', value)}
            options={[
              { value: 'All', label: 'Tất cả' },
              ...categoriesList.map((c) => ({ value: c.slug, label: c.name })),
            ]}
          />
          {brandsList.length > 0 && (
            <FilterGroup
              title="THƯƠNG HIỆU"
              value={brand}
              onChange={(value) => change('brand', value)}
              options={[
                { value: 'All', label: 'Tất cả' },
                ...brandsList.map((b) => ({ value: b.slug, label: b.name })),
              ]}
            />
          )}
          <FilterGroup
            title="KHOẢNG GIÁ"
            value={price}
            onChange={(value) => change('price', value)}
            options={[
              { value: 'All', label: 'Tất cả' },
              ...PRICE_RANGES.map((range) => ({ value: range.key, label: range.label })),
            ]}
          />
          <label className="filter-check">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => change('inStock', e.target.checked ? 'true' : '')}
            />
            Chỉ hiện sản phẩm còn hàng
          </label>
        </aside>
        <section className="catalog-main" aria-label="Danh sách sản phẩm">
          {activeFilters.length > 0 && (
            <ul className="active-filters" aria-label="Bộ lọc đang áp dụng">
              {activeFilters.map((filter) => (
                <li key={filter.key}>
                  <button
                    type="button"
                    aria-label={'Bỏ lọc ' + filter.label}
                    onClick={() => change(filter.key, '')}
                  >
                    {filter.label} <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="clear-filters" onClick={clearFilters}>
                  Xóa tất cả
                </button>
              </li>
            </ul>
          )}

          {loading ? (
            <ProductGridSkeleton count={6} className="catalog-grid" />
          ) : productsError ? (
            <div className="empty-state" role="alert">
              <h2>Không thể tải sản phẩm</h2>
              <p>{productsError}</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setRetryCount(retryCount + 1)}
              >
                <RotateCw size={17} aria-hidden="true" /> THỬ LẠI
              </button>
            </div>
          ) : productsList.length ? (
            <>
              <div className="products-grid catalog-grid">
                {productsList.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {meta.totalPages > 1 && (
                <nav className="pagination" aria-label="Phân trang sản phẩm">
                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  {getPageNumbers(page, meta.totalPages).map((number) => (
                    <button
                      key={number}
                      type="button"
                      className={number === page ? 'active' : ''}
                      aria-label={'Trang ' + number}
                      aria-current={number === page ? 'page' : undefined}
                      onClick={() => goToPage(number)}
                    >
                      {number}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={page >= meta.totalPages}
                    onClick={() => goToPage(page + 1)}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <SearchX size={48} aria-hidden="true" />
              <h2>{page > 1 ? 'Trang này không có sản phẩm' : 'Không tìm thấy sản phẩm'}</h2>
              <p>Hãy thử từ khóa hoặc bộ lọc khác.</p>
              <div className="empty-actions">
                {page > 1 && (
                  <button type="button" className="btn btn-outline" onClick={() => goToPage(1)}>
                    VỀ TRANG ĐẦU
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={clearFilters}>
                  XÓA BỘ LỌC
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function activePriceValue(key, field) {
  return PRICE_RANGES.find((range) => range.key === key)?.[field];
}
