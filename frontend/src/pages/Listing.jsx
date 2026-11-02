import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard.jsx';

const PAGE_SIZE = 24;

export default function Listing() {
  const [params, setParams] = useSearchParams();

  const category = params.get('category') || 'All';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'featured';

  const rawPage = Number(params.get('page') || 1);
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [draft, setDraft] = useState(q);
  const [productsList, setProductsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    setDraft(q);
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    catalogApi
      .getCategories()
      .then((categories) => {
        if (!cancelled) {
          setCategoriesList(categories || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCategoriesError(error.message || 'Không thể tải danh mục.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setProductsError('');

    catalogApi
      .getProducts({
        category,
        q,
        sort,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return;

        const products = Array.isArray(res.data) ? res.data : [];
        const total = res.meta?.total ?? products.length;
        const totalPages = Math.max(1, res.meta?.totalPages ?? 1);

        setProductsList(products);
        setPagination({ total, totalPages });
      })
      .catch((error) => {
        if (cancelled) return;

        setProductsList([]);
        setPagination({ total: 0, totalPages: 1 });
        setProductsError(error.message || 'Không thể tải sản phẩm.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category, q, sort, page, retryCount]);

  const change = (key, value) => {
    const next = new URLSearchParams(params);

    if (
      !value ||
      value === 'All' ||
      value === 'featured' ||
      (key === 'page' && Number(value) === 1)
    ) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }

    if (key !== 'page') {
      next.delete('page');
    }

    setParams(next);
  };

  const clearFilters = () => {
    setDraft('');
    setParams({});
  };

  const paginationStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 28,
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

        <span aria-live="polite">
          {loading ? 'ĐANG TẢI...' : `${pagination.total} SẢN PHẨM`}
        </span>
      </div>

      <div className="catalog-layout">
        <aside className="filters">
          <h2>
            <SlidersHorizontal size={19} /> BỘ LỌC
          </h2>

          <h3>DANH MỤC</h3>

          <div className="filter-options">
            <button
              type="button"
              className={category === 'All' ? 'active' : ''}
              onClick={() => change('category', 'All')}
            >
              Tất cả
            </button>

            {categoriesList.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  category === item.slug || category === item.name
                    ? 'active'
                    : ''
                }
                onClick={() => change('category', item.slug)}
              >
                {item.name}
              </button>
            ))}
          </div>

          {categoriesError && <p role="alert">{categoriesError}</p>}

          <p className="filter-tip">
            Chọn trang bị phù hợp cho trận đấu tiếp theo của bạn.
          </p>
        </aside>

        <section
          className="catalog-main"
          aria-label="Danh sách sản phẩm"
          aria-busy={loading}
        >
          <div className="catalog-toolbar">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                change('q', draft.trim());
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
                onChange={(event) => setDraft(event.target.value)}
              />

              <button type="submit">Tìm kiếm</button>
            </form>

            <label className="sort-select">
              SẮP XẾP:{' '}
              <select
                value={sort}
                onChange={(event) => change('sort', event.target.value)}
              >
                <option value="featured">Nổi bật</option>
                <option value="price_asc">Giá: thấp đến cao</option>
                <option value="price_desc">Giá: cao đến thấp</option>
                <option value="rating_desc">Đánh giá cao</option>
              </select>
              <ChevronDown size={16} />
            </label>
          </div>

          {loading ? (
            <p role="status">Đang tải danh sách sản phẩm...</p>
          ) : productsError ? (
            <div className="empty-state" role="alert">
              <h2>Không thể tải sản phẩm.</h2>
              <p>{productsError}</p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                THỬ LẠI
              </button>
            </div>
          ) : productsList.length > 0 ? (
            <>
              <div className="products-grid catalog-grid">
                {productsList.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <nav
                  aria-label="Phân trang sản phẩm"
                  style={paginationStyle}
                >
                  <button
                    type="button"
                    className="btn"
                    disabled={page <= 1}
                    onClick={() => change('page', page - 1)}
                  >
                    Trang trước
                  </button>

                  <span aria-live="polite">
                    Trang {page} / {pagination.totalPages}
                  </span>

                  <button
                    type="button"
                    className="btn"
                    disabled={page >= pagination.totalPages}
                    onClick={() => change('page', page + 1)}
                  >
                    Trang sau
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <h2>
                {page > 1
                  ? 'Trang này không có sản phẩm.'
                  : 'Không tìm thấy sản phẩm.'}
              </h2>

              <p>Hãy thử từ khóa hoặc danh mục khác.</p>

              {page > 1 && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => change('page', 1)}
                >
                  VỀ TRANG ĐẦU
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary"
                onClick={clearFilters}
              >
                XÓA BỘ LỌC
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}