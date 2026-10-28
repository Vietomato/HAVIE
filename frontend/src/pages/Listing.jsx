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

  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    catalogApi.getCategories().then((cats) => {
      setCategoriesList(cats || []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    catalogApi
      .getProducts({ category, q, sort })
      .then((res) => {
        setProductsList(res.data || []);
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
        <Link to="/">HOME</Link> / SHOP
      </p>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE HAVIE EDIT</span>
          <h1>
            THE COLLECTION<span className="dot">.</span>
          </h1>
          <p>Thoughtful equipment for every level of play.</p>
        </div>
        <span>{productsList.length} PRODUCTS</span>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <h2>
            <SlidersHorizontal size={19} /> FILTERS
          </h2>
          <h3>CATEGORIES</h3>
          <div className="filter-options">
            <button
              className={category === 'All' ? 'active' : ''}
              onClick={() => change('category', 'All')}
            >
              All
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
          <p className="filter-tip">Find the right equipment for your next match.</p>
        </aside>
        <section className="catalog-main" aria-label="Products">
          <div className="catalog-toolbar">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change('q', draft);
              }}
            >
              <label className="sr-only" htmlFor="catalog-search">
                Search catalog
              </label>
              <Search size={18} />
              <input
                id="catalog-search"
                placeholder="Search the collection"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit">Search</button>
            </form>
            <label className="sort-select">
              SORT BY{' '}
              <select value={sort} onChange={(e) => change('sort', e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price_asc">Price: Low to high</option>
                <option value="price_desc">Price: High to low</option>
                <option value="rating_desc">Top rated</option>
              </select>
              <ChevronDown size={16} />
            </label>
          </div>
          {loading ? (
            <p>Đang tải danh sách sản phẩm...</p>
          ) : productsList.length ? (
            <div className="products-grid catalog-grid">
              {productsList.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No products found.</h2>
              <p>Try another search or category.</p>
              <button className="btn btn-primary" onClick={() => setParams({})}>
                CLEAR FILTERS
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
