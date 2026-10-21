import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Search,
  UserRound,
  ShoppingBag,
  Menu,
  X,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Star,
  Truck,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  ChartNoAxesColumn,
  Settings,
  LogOut,
  CheckCircle2,
  ChevronDown,
  Heart,
  QrCode,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { money } from './data';
import {
  authApi,
  catalogApi,
  cartApi,
  orderApi,
  reviewApi,
  adminApi,
  addressApi,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from './api';
import './style.tailwind.css';

const Store = createContext(null);

function StoreProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [cart, setCart] = useState({ items: [] });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('havie-favorites')) || [];
    } catch {
      return [];
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);

  // Initialize Account
  useEffect(() => {
    authApi
      .getMe()
      .then((user) => setAccount(user))
      .catch(() => setAccount(null))
      .finally(() => setAuthLoading(false));
  }, []);

  // Fetch Cart on mount and on account change
  const refreshCart = async () => {
    try {
      setCartLoading(true);
      const res = await cartApi.getCart();
      setCart(res || { items: [] });
    } catch (e) {
      console.error('Error loading cart:', e);
    } finally {
      setCartLoading(false);
    }
  };

  useEffect(() => {
    refreshCart();
  }, [account]);

  useEffect(() => {
    localStorage.setItem('havie-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const add = async (variantId, quantity = 1) => {
    try {
      const updated = await cartApi.addItem(variantId, quantity);
      setCart(updated);
      return { success: true };
    } catch (err) {
      alert(err.message || 'Không thể thêm vào giỏ hàng.');
      return { success: false, error: err };
    }
  };

  const update = async (itemId, quantity) => {
    try {
      const updated = await cartApi.updateItem(itemId, quantity);
      setCart(updated);
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật giỏ hàng.');
    }
  };

  const remove = async (itemId) => {
    try {
      const updated = await cartApi.removeItem(itemId);
      setCart(updated);
    } catch (err) {
      alert(err.message || 'Lỗi xóa khỏi giỏ hàng.');
    }
  };

  const toggleFavorite = (id) =>
    setFavorites((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    setAccount(res.user);
    await refreshCart();
    return res.user;
  };

  const register = async (payload) => {
    const res = await authApi.register(payload);
    setAccount(res.user);
    await refreshCart();
    return res.user;
  };

  const logout = async () => {
    await authApi.logout();
    setAccount(null);
    await refreshCart();
  };

  const count = (cart?.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = (cart?.items || []).reduce(
    (sum, item) => sum + (item.variant?.price || 0) * item.quantity,
    0,
  );

  return (
    <Store.Provider
      value={{
        account,
        setAccount,
        login,
        register,
        logout,
        authLoading,
        cart,
        refreshCart,
        add,
        update,
        remove,
        count,
        subtotal,
        favorites,
        toggleFavorite,
      }}
    >
      {children}
    </Store.Provider>
  );
}

const useStore = () => useContext(Store);

function Header() {
  const { count, account } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    navigate('/products?q=' + encodeURIComponent(query));
    setOpen(false);
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="HAVIE home">
          HAVIE<span>.</span>
          <small>BADMINTON STORE</small>
        </Link>
        <nav className={'main-nav ' + (open ? 'open' : '')} aria-label="Main navigation">
          <NavLink to="/" onClick={() => setOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/products" onClick={() => setOpen(false)}>
            Shop
          </NavLink>
          <NavLink to="/products?category=rackets" onClick={() => setOpen(false)}>
            Collections
          </NavLink>
          <a href="/#about" onClick={() => setOpen(false)}>
            About
          </a>
        </nav>
        <form className="header-search" role="search" onSubmit={submit}>
          <label className="sr-only" htmlFor="site-search">
            Search products
          </label>
          <input
            id="site-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
          />
          <button aria-label="Search" type="submit">
            <Search size={20} />
          </button>
        </form>
        <div className="header-actions">
          {account?.role === 'ADMIN' && (
            <Link to="/admin" className="admin-shortcut-pill" title="Mở trang Quản trị HAVIE">
              <ShieldAlert size={14} /> Admin Studio
            </Link>
          )}
          <Link
            to="/auth"
            aria-label={account ? 'Your account' : 'Sign in'}
            title={account?.fullName || 'Tài khoản'}
          >
            <UserRound size={22} />
          </Link>
          <Link to="/cart" className="cart-icon" aria-label={'Cart with ' + count + ' items'}>
            <ShoppingBag size={22} />
            {count > 0 && <span>{count}</span>}
          </Link>
          <button
            className="mobile-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer" id="about">
      <div className="container footer-grid">
        <section>
          <Link className="footer-logo" to="/">
            HAVIE.
          </Link>
          <p>Play beyond limits.</p>
          <p>Built for the love of badminton.</p>
        </section>
        <section>
          <h3>EXPLORE</h3>
          <Link to="/products">Shop all</Link>
          <Link to="/products?category=rackets">Vợt cầu lông</Link>
          <Link to="/products?category=shoes">Giày cầu lông</Link>
        </section>
        <section>
          <h3>SUPPORT</h3>
          <a href="mailto:hello@havie.example">Contact us</a>
          <Link to="/cart">Shopping cart</Link>
          <Link to="/auth">My account</Link>
        </section>
        <section>
          <h3>FOLLOW THE GAME</h3>
          <p>Made for the court. Designed for everyday.</p>
          <span className="footer-note">Demo Storefront • API Contract v1 Integrated</span>
        </section>
      </div>
      <div className="container footer-bottom">
        © 2026 HAVIE Badminton Store <span>Designed with intention.</span>
      </div>
    </footer>
  );
}

function Shell({ children }) {
  return (
    <>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}

function ProductCard({ product }) {
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

function Home() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    catalogApi.getProducts({ pageSize: 4 }).then((res) => {
      setFeatured(res.data || []);
    });
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-line" /> EQUIPMENT FOR THE EVERYDAY ATHLETE
            </span>
            <h1>
              EVERY POINT
              <br />
              <em>MATTERS.</em>
            </h1>
            <p>
              Find your rhythm. Own your game. Gear made for every rally, from the first serve to
              match point.
            </p>
            <Link to="/products" className="btn btn-primary">
              EXPLORE THE COLLECTION <ArrowRight size={18} />
            </Link>
            <div className="hero-index">
              01 <span /> 03 <small>DESIGNED TO PLAY</small>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image">
              <img src="/images/product-1.svg" alt="HAVIE performance badminton racket" />
            </div>
            <div className="hero-sticker">
              MOVE
              <br />
              WITH
              <br />
              PURPOSE <ArrowRight size={23} />
            </div>
            <div className="hero-caption">THE COURT IS YOURS — 2026 COLLECTION</div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR FIT</span>
            <h2>
              SHOP BY CATEGORY<span className="dot">.</span>
            </h2>
          </div>
          <Link className="text-link" to="/products">
            SHOP ALL <ArrowRight size={17} />
          </Link>
        </div>
        <div className="category-grid">
          {[
            { name: 'Vợt cầu lông', slug: 'rackets', n: '01', img: 1 },
            { name: 'Giày cầu lông', slug: 'shoes', n: '02', img: 2 },
            { name: 'Trang phục', slug: 'apparel', n: '03', img: 4 },
            { name: 'Phụ kiện', slug: 'accessories', n: '04', img: 6 },
          ].map((c) => (
            <Link className="category-card" key={c.slug} to={'/products?category=' + c.slug}>
              <div className="category-image">
                <img src={'/images/product-' + c.img + '.svg'} alt="" />
              </div>
              <div className="category-label">
                <span>
                  {c.n} / {c.name.toUpperCase()}
                </span>
                <ArrowRight size={20} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section-products">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE COMMUNITY FAVORITES</span>
              <h2>
                BEST SELLERS<span className="dot">.</span>
              </h2>
            </div>
            <Link className="text-link" to="/products">
              VIEW ALL <ArrowRight size={17} />
            </Link>
          </div>
          <div className="products-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="campaign container">
        <div>
          <span className="eyebrow">THE HAVIE PHILOSOPHY</span>
          <h2>
            GOOD GEAR.
            <br />
            GREAT GAME.
          </h2>
          <p>
            Every movement matters. We believe the right equipment gives you the freedom to play
            your way.
          </p>
          <Link to="/products" className="btn btn-light">
            DISCOVER MORE <ArrowRight size={18} />
          </Link>
        </div>
        <div className="campaign-mark">
          H<span>.</span>
        </div>
      </section>

      <section className="perks container">
        <div>
          <Truck size={26} />
          <strong>READY FOR YOUR NEXT MATCH</strong>
          <span>Giao hàng toàn quốc & COD tiện lợi</span>
        </div>
        <div>
          <ShieldCheck size={26} />
          <strong>MADE FOR PERFORMANCE</strong>
          <span>Vợt & phụ kiện chính hãng HAVIE</span>
        </div>
        <div>
          <RotateCcw size={26} />
          <strong>SHOP WITH CONFIDENCE</strong>
          <span>Đổi trả thuận tiện & tư vấn tận tâm</span>
        </div>
      </section>
    </>
  );
}

function Listing() {
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

function Detail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const { add } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    catalogApi
      .getProduct(id)
      .then((p) => {
        setProduct(p);
        if (p?.variants?.length) {
          setSelectedVariant(p.variants[0]);
        }
        return catalogApi.getProductReviews(p.id);
      })
      .then((revRes) => {
        setReviews(revRes.data || []);
      })
      .catch((err) => {
        console.error(err);
        setProduct(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="container page-pad">Đang tải chi tiết sản phẩm...</div>;
  }

  if (!product) {
    return (
      <div className="container empty-state">
        <h1>Product not found</h1>
        <Link className="btn btn-primary" to="/products">
          BACK TO SHOP
        </Link>
      </div>
    );
  }

  const currentPrice = selectedVariant?.price || product.variants?.[0]?.price || 0;
  const oldPrice = selectedVariant?.oldPrice || product.variants?.[0]?.oldPrice;
  const maxStock = selectedVariant?.stockQuantity || 0;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    const res = await add(selectedVariant.id, qty);
    if (res.success) setAdded(true);
  };

  const handleBuyNow = async () => {
    if (!selectedVariant) return;
    const res = await add(selectedVariant.id, qty);
    if (res.success) navigate('/checkout');
  };

  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">HOME</Link> / <Link to="/products">SHOP</Link> / {product.name.toUpperCase()}
      </p>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            <img src={product.imageUrls?.[0] || '/images/product-1.svg'} alt={product.name} />
          </div>
          <div className="detail-thumbs">
            <img src={product.imageUrls?.[0] || '/images/product-1.svg'} alt="Product preview" />
            <span>HAVIE / PERFORMANCE SERIES</span>
          </div>
        </div>
        <section className="detail-info">
          <span className="eyebrow">
            {product.category?.name?.toUpperCase()} / HAVIE PERFORMANCE
          </span>
          <h1>
            {product.name}
            <span className="dot">.</span>
          </h1>
          <div className="rating">
            <Star size={16} fill="currentColor" /> {product.ratingAverage || 5.0}{' '}
            <span>• ({reviews.length} đánh giá khách hàng)</span>
          </div>
          <div className="detail-price">
            {money(currentPrice)} {oldPrice && <del>{money(oldPrice)}</del>}
          </div>
          <p className="detail-description">{product.description}</p>

          {/* Biến thể theo đúng Contract v1 */}
          {product.variants?.length > 0 && (
            <div className="variant-picker">
              <label>CHỌN PHIÊN BẢN / KÍCH THƯỚC (VARIANT):</label>
              <div className="variant-chips">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={'variant-chip ' + (selectedVariant?.id === v.id ? 'active' : '')}
                    onClick={() => {
                      setSelectedVariant(v);
                      setQty(1);
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
              <div className={'variant-stock-info ' + (maxStock <= 5 ? 'low' : '')}>
                {maxStock > 0
                  ? `SKU: ${selectedVariant?.sku} • Tồn kho khả dụng: ${maxStock} sản phẩm`
                  : 'Sản phẩm tạm hết hàng'}
              </div>
            </div>
          )}

          <div className="detail-specs">
            <h3>THÔNG SỐ & ĐẶC TÍNH</h3>
            <ul>
              {(product.specs || []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="quantity-row">
            <span>SỐ LƯỢNG</span>
            <div className="qty-control">
              <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus size={16} />
              </button>
              <output>{qty}</output>
              <button
                aria-label="Increase quantity"
                disabled={qty >= maxStock}
                onClick={() => setQty(Math.min(maxStock, qty + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn btn-primary"
              disabled={maxStock <= 0}
              onClick={handleAddToCart}
            >
              <ShoppingBag size={18} /> THÊM VÀO GIỎ HÀNG
            </button>
            <button
              className="btn btn-outline"
              disabled={maxStock <= 0}
              onClick={handleBuyNow}
            >
              MUA NGAY <ArrowRight size={17} />
            </button>
          </div>
          {added && (
            <p className="success-message" role="status">
              <CheckCircle2 size={17} /> Đã thêm vào giỏ hàng. <Link to="/cart">Xem giỏ hàng →</Link>
            </p>
          )}
          <div className="detail-assurance">
            <Truck size={19} /> Giao hàng nhanh 2-3 ngày <ShieldCheck size={19} /> Bảo hành chính hãng
          </div>
        </section>
      </div>

      {/* Customer Reviews Section */}
      <section className="reviews-section">
        <h2>
          ĐÁNH GIÁ KHÁCH HÀNG ({reviews.length})<span className="dot">.</span>
        </h2>
        {reviews.length ? (
          <div>
            {reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-header">
                  <strong>{r.userName}</strong>
                  <span>
                    <Star size={14} fill="currentColor" /> {r.rating}/5 •{' '}
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <p>{r.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="filter-tip">Chưa có đánh giá nào cho sản phẩm này.</p>
        )}
      </section>
    </div>
  );
}

function Cart() {
  const { cart, update, remove, subtotal } = useStore();
  const items = cart?.items || [];

  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">HOME</Link> / SHOPPING CART
      </p>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SELECTION</span>
          <h1>
            GIỎ HÀNG CỦA BẠN<span className="dot">.</span>
          </h1>
        </div>
      </div>
      {items.length ? (
        <div className="cart-layout">
          <section className="cart-items">
            <div className="cart-head">
              <span>SẢN PHẨM</span>
              <span>SỐ LƯỢNG</span>
              <span>TỔNG CỘNG</span>
            </div>
            {items.map((item) => (
              <article className="cart-item" key={item.id}>
                <Link to={'/products/' + (item.product?.slug || item.product?.id)} className="cart-thumb">
                  <img
                    src={item.product?.imageUrls?.[0] || '/images/product-1.svg'}
                    alt={item.product?.name}
                  />
                </Link>
                <div className="cart-item-desc">
                  <span className="eyebrow">{item.product?.category?.name || 'Vợt cầu lông'}</span>
                  <Link to={'/products/' + (item.product?.slug || item.product?.id)}>
                    {item.product?.name}
                  </Link>
                  <small className="font-bold text-[var(--forest)]">
                    Phiên bản: {item.variant?.name} ({item.variant?.sku})
                  </small>
                  <span>{money(item.variant?.price || 0)}</span>
                  <button onClick={() => remove(item.id)} className="remove-link">
                    <Trash2 size={15} /> XÓA
                  </button>
                </div>
                <div className="qty-control">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => update(item.id, item.quantity - 1)}
                  >
                    <Minus size={15} />
                  </button>
                  <output>{item.quantity}</output>
                  <button
                    aria-label="Increase quantity"
                    onClick={() => update(item.id, item.quantity + 1)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <strong>{money((item.variant?.price || 0) * item.quantity)}</strong>
              </article>
            ))}
            <Link to="/products" className="text-link back-shopping">
              <ArrowLeft size={18} /> TIẾP TỤC MUA SẮM
            </Link>
          </section>
          <aside className="summary">
            <h2>TỔNG ĐƠN HÀNG</h2>
            <div>
              <span>Tạm tính</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <span>Phí vận chuyển</span>
              <span>30.000 ₫ (toàn quốc)</span>
            </div>
            <div className="summary-total">
              <span>TỔNG THANH TOÁN</span>
              <strong>{money(subtotal + 30000)}</strong>
            </div>
            <Link className="btn btn-primary full" to="/checkout">
              TIẾN HÀNH ĐẶT HÀNG <ArrowRight size={17} />
            </Link>
            <p>Hỗ trợ thanh toán COD và Quét mã QR tiện lợi.</p>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={54} />
          <h2>Giỏ hàng của bạn đang trống.</h2>
          <p>Hãy khám phá các mẫu vợt và phụ kiện chất lượng cao của HAVIE.</p>
          <Link to="/products" className="btn btn-primary">
            KHÁM PHÁ BỘ SƯU TẬP <ArrowRight size={18} />
          </Link>
        </div>
      )}
    </div>
  );
}

function Checkout() {
  const { cart, subtotal, refreshCart, account } = useStore();
  const [name, setName] = useState(account?.fullName || '');
  const [phone, setPhone] = useState(account?.phone || '');
  const [street, setStreet] = useState('');
  const [ward, setWard] = useState('Phường 4');
  const [district, setDistrict] = useState('Gò Vấp');
  const [province, setProvince] = useState('TP. Hồ Chí Minh');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrOrder, setQrOrder] = useState(null);
  const navigate = useNavigate();

  const items = cart?.items || [];

  useEffect(() => {
    if (account) {
      if (!name) setName(account.fullName || '');
      if (!phone) setPhone(account.phone || '');
    }
  }, [account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!account) {
      alert('Vui lòng đăng nhập để tiến hành đặt hàng theo quy định của hệ thống.');
      navigate('/auth');
      return;
    }
    if (!items.length) return;

    try {
      setSubmitting(true);
      const res = await orderApi.createOrder({
        recipientName: name,
        recipientPhone: phone,
        shippingAddress: {
          province,
          district,
          ward,
          streetAddress: street,
        },
        paymentMethod,
        customerNote: note,
      });

      await refreshCart();
      setCreatedOrder(res);

      if (paymentMethod === 'MOCK_QR' && res.payment) {
        setQrOrder(res);
        setShowQrModal(true);
      }
    } catch (err) {
      alert(err.message || 'Có lỗi xảy ra khi tạo đơn hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmQrPayment = async () => {
    if (!qrOrder) return;
    try {
      const res = await orderApi.simulateQrPaymentSuccess(qrOrder.id);
      setCreatedOrder(res);
      setShowQrModal(false);
      alert('Thanh toán thành công! Trạng thái đơn hàng đã được cập nhật.');
    } catch (err) {
      alert('Lỗi xác nhận thanh toán.');
    }
  };

  return (
    <div className="container page-pad checkout-page">
      <p className="breadcrumbs">
        <Link to="/cart">CART</Link> / CHECKOUT
      </p>

      {/* QR Payment Modal */}
      {showQrModal && qrOrder && (
        <div className="qr-overlay">
          <div className="qr-modal">
            <h2>MÃ QR THANH TOÁN (MOCK_QR)</h2>
            <p>Đơn hàng: <strong>{qrOrder.orderCode}</strong></p>
            <div className="qr-box">
              <div className="qr-code-art">
                VIETQR DEMO<br />{money(qrOrder.totalAmount)}
              </div>
              <small>Hết hạn sau: 15 phút (Mô phỏng API)</small>
            </div>
            <p className="text-[13px] text-[var(--muted)]">
              Đây là cổng thanh toán mô phỏng theo Contract v1. Bạn có thể nhấn nút bên dưới để giả lập thanh toán thành công từ ngân hàng:
            </p>
            <div className="mt-[15px] flex gap-[10px]">
              <button className="btn btn-primary full" onClick={handleConfirmQrPayment}>
                XÁC NHẬN ĐÃ THANH TOÁN
              </button>
              <button className="btn btn-outline" onClick={() => setShowQrModal(false)}>
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      )}

      {createdOrder ? (
        <div className="empty-state">
          <CheckCircle2 size={62} color="var(--forest)" />
          <h1>Đặt hàng thành công!</h1>
          <p>
            Mã đơn hàng của bạn là <strong>{createdOrder.orderCode}</strong>.
          </p>
          <div className="mx-auto my-[15px] max-w-[400px] text-left">
            <p><strong>Người nhận:</strong> {createdOrder.recipientName} ({createdOrder.recipientPhone})</p>
            <p><strong>Địa chỉ:</strong> {createdOrder.shippingAddress}</p>
            <p><strong>Phương thức:</strong> {PAYMENT_METHOD_LABELS[createdOrder.paymentMethod]}</p>
            <p>
              <strong>Trạng thái: </strong>
              <span className={'status-badge ' + createdOrder.status}>
                {ORDER_STATUS_LABELS[createdOrder.status]}
              </span>
            </p>
            <p><strong>Tổng thanh toán:</strong> {money(createdOrder.totalAmount)}</p>
          </div>
          <div className="flex justify-center gap-3">
            <Link className="btn btn-primary" to="/auth?tab=orders">
              XEM LỊCH SỬ ĐƠN HÀNG
            </Link>
            <Link className="btn btn-outline" to="/">
              VỀ TRANG CHỦ
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">ONE LAST STEP</span>
              <h1>
                CHECKOUT<span className="dot">.</span>
              </h1>
            </div>
          </div>
          {!account && (
            <div className="quick-login-box mb-6">
              <p>⚠️ Theo API Contract v1: Bạn cần đăng nhập để hoàn tất đặt hàng.</p>
              <Link to="/auth" className="btn-mini">
                ĐĂNG NHẬP / ĐĂNG KÝ NGAY
              </Link>
            </div>
          )}
          <div className="cart-layout">
            <form id="checkout-form" className="checkout-form" onSubmit={handleSubmit}>
              <h2>THÔNG TIN GIAO HÀNG (API CONTRACT V1)</h2>
              <label>
                HỌ VÀ TÊN NGƯỜI NHẬN
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                SỐ ĐIỆN THOẠI
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0900000000"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  TỈNH / THÀNH PHỐ
                  <input
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                </label>
                <label>
                  QUẬN / HUYỆN
                  <input
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </label>
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <label>
                  PHƯỜNG / XÃ
                  <input required value={ward} onChange={(e) => setWard(e.target.value)} />
                </label>
                <label>
                  ĐỊA CHỈ SỐ NHÀ, ĐƯỜNG
                  <input
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ví dụ: 12 Nguyễn Văn Bảo"
                  />
                </label>
              </div>

              <h2 className="mt-6">PHƯƠNG THỨC THANH TOÁN</h2>
              <div className="flex flex-col gap-[10px]">
                <label className="flex items-center gap-[10px]">
                  <input
                    type="radio"
                    name="payment"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                  />
                  <span>Thanh toán khi nhận hàng (COD)</span>
                </label>
                <label className="flex items-center gap-[10px]">
                  <input
                    type="radio"
                    name="payment"
                    value="MOCK_QR"
                    checked={paymentMethod === 'MOCK_QR'}
                    onChange={() => setPaymentMethod('MOCK_QR')}
                  />
                  <span>Mã QR thanh toán mô phỏng (MOCK_QR VietQR)</span>
                </label>
              </div>

              <label className="mt-4">
                GHI CHÚ ĐƠN HÀNG (TÙY CHỌN)
                <textarea
                  rows="2"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Gọi trước khi giao"
                />
              </label>
            </form>

            <aside className="summary">
              <h2>ĐƠN HÀNG CỦA BẠN</h2>
              {items.map((item) => (
                <div key={item.id}>
                  <span>
                    {item.product?.name} ({item.variant?.name}) × {item.quantity}
                  </span>
                  <strong>{money((item.variant?.price || 0) * item.quantity)}</strong>
                </div>
              ))}
              <div>
                <span>Phí ship</span>
                <span>30.000 ₫</span>
              </div>
              <div className="summary-total">
                <span>TỔNG CỘNG</span>
                <strong>{money(subtotal + 30000)}</strong>
              </div>
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting || !items.length}
                className="btn btn-primary full"
              >
                {submitting ? 'ĐANG XỬ LÝ...' : 'ĐẶT HÀNG NGAY'} <ArrowRight size={18} />
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const { account, login, register, logout, setAccount } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (account && activeTab === 'orders') {
      orderApi.getMyOrders().then((res) => {
        setMyOrders(res || []);
      });
    }
  }, [account, activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (!fullName.trim()) return setError('Vui lòng nhập họ và tên.');
      if (password !== confirm) return setError('Mật khẩu xác nhận không khớp.');
    }

    try {
      setLoading(true);
      if (mode === 'signin') {
        const u = await login(email, password);
        if (u.role === 'ADMIN') navigate('/admin');
      } else {
        await register({ fullName, email, phone, password });
      }
    } catch (err) {
      setError(err.message || 'Lỗi xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCustomer = () => {
    setMode('signin');
    setEmail('viet@example.com');
    setPassword('MatKhau123!');
  };

  const fillDemoAdmin = () => {
    setMode('signin');
    setEmail('admin@havie.vn');
    setPassword('Admin123!');
  };

  const handleCancelOrder = async (orderId) => {
    const reason = prompt('Vui lòng nhập lý do hủy đơn:');
    if (!reason) return;
    try {
      await orderApi.cancelOrder(orderId, reason);
      const updated = await orderApi.getMyOrders();
      setMyOrders(updated || []);
      alert('Đã hủy đơn hàng thành công.');
    } catch (err) {
      alert(err.message || 'Không thể hủy đơn hàng.');
    }
  };

  return (
    <div className="auth-layout">
      <aside className="auth-art">
        <Link to="/" className="auth-brand">
          HAVIE.
        </Link>
        <div>
          <span className="eyebrow">WELCOME TO THE CLUB</span>
          <h1>
            PLAY
            <br />
            BEYOND
            <br />
            LIMITS<span>.</span>
          </h1>
          <p>Hệ thống tài khoản và đơn hàng theo chuẩn API Contract v1.</p>
        </div>
        <span>HAVIE ARCHITECTURE / 2026</span>
      </aside>
      <section className="auth-panel">
        <div className="auth-box">
          {account ? (
            <>
              <div className="account-tabs">
                <button
                  className={activeTab === 'profile' ? 'active' : ''}
                  onClick={() => setSearchParams({ tab: 'profile' })}
                >
                  HỒ SƠ TÀI KHOẢN
                </button>
                <button
                  className={activeTab === 'orders' ? 'active' : ''}
                  onClick={() => setSearchParams({ tab: 'orders' })}
                >
                  ĐƠN HÀNG CỦA TÔI
                </button>
              </div>

              {activeTab === 'profile' ? (
                <>
                  <span className="eyebrow">ROLE: {account.role}</span>
                  <h2>Xin chào, {account.fullName}.</h2>
                  <p>Email: {account.email}</p>
                  <p>Số điện thoại: {account.phone || 'Chưa cập nhật'}</p>

                  {account.role === 'ADMIN' && (
                    <div className="my-[18px]">
                      <Link to="/admin" className="btn btn-primary full">
                        TRUY CẬP ADMIN STUDIO →
                      </Link>
                    </div>
                  )}

                  <div className="mt-5 flex gap-[10px]">
                    <button className="btn btn-outline full" onClick={logout}>
                      ĐĂNG XUẤT
                    </button>
                    <Link to="/products" className="btn btn-primary full">
                      TIẾP TỤC MUA SẮM
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2>LỊCH SỬ ĐƠN HÀNG</h2>
                  {myOrders.length ? (
                    <div className="orders-list">
                      {myOrders.map((ord) => (
                        <div key={ord.id} className="order-card">
                          <div className="order-card-header">
                            <div>
                              <strong>{ord.orderCode}</strong>
                              <small className="block text-[var(--muted)]">
                                {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                              </small>
                            </div>
                            <span className={'status-badge ' + ord.status}>
                              {ORDER_STATUS_LABELS[ord.status] || ord.status}
                            </span>
                          </div>
                          <div className="order-card-items">
                            {ord.items.map((it) => (
                              <div key={it.id} className="order-item-row">
                                <span>
                                  {it.productName} ({it.variantName}) × {it.quantity}
                                </span>
                                <strong>{money(it.unitPrice * it.quantity)}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="order-card-footer">
                            <span>
                              Tổng: <strong>{money(ord.totalAmount)}</strong>
                            </span>
                            {['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(
                              ord.status,
                            ) && (
                              <button
                                className="btn-mini border-[#b91c1c] text-[#b91c1c]"
                                onClick={() => handleCancelOrder(ord.id)}
                              >
                                Hủy đơn
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Bạn chưa có đơn hàng nào.</p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Demo Helper Box */}
              <div className="quick-login-box">
                <p>⚡ Tài khoản thử nghiệm theo Contract v1:</p>
                <div className="quick-login-buttons">
                  <button type="button" className="btn-mini" onClick={fillDemoCustomer}>
                    Khách hàng: viet@example.com
                  </button>
                  <button type="button" className="btn-mini" onClick={fillDemoAdmin}>
                    Admin: admin@havie.vn
                  </button>
                </div>
              </div>

              <span className="eyebrow">YOUR HAVIE ACCOUNT</span>
              <h2>{mode === 'signin' ? 'Welcome back.' : 'Join the game.'}</h2>

              <div className="auth-tabs">
                <button
                  className={mode === 'signin' ? 'active' : ''}
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                >
                  SIGN IN
                </button>
                <button
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                >
                  SIGN UP
                </button>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                {mode === 'signup' && (
                  <>
                    <label>
                      HỌ VÀ TÊN
                      <input
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nguyễn Hoàng Việt"
                      />
                    </label>
                    <label>
                      SỐ ĐIỆN THOẠI
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0900000000"
                      />
                    </label>
                  </>
                )}
                <label>
                  EMAIL ADDRESS
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="viet@example.com"
                  />
                </label>
                <label>
                  PASSWORD
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    minLength={6}
                  />
                </label>
                {mode === 'signup' && (
                  <label>
                    XÁC NHẬN MẬT KHẨU
                    <input
                      required
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn btn-primary full" type="submit" disabled={loading}>
                  {loading ? 'ĐANG XỬ LÝ...' : mode === 'signin' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}{' '}
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Admin() {
  const { account } = useStore();
  const [tab, setTab] = useState('Overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminInventory, setAdminInventory] = useState([]);
  const [adminCustomers, setAdminCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantForAdjust, setSelectedVariantForAdjust] = useState(null);
  const [deltaQty, setDeltaQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('Kiểm kê thực tế');

  const reloadData = async () => {
    try {
      setLoading(true);
      const [dash, ords, prods, inv, custs] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getOrders(),
        adminApi.getProducts(),
        adminApi.getInventory(),
        adminApi.getCustomers(),
      ]);
      setDashboardData(dash);
      setAdminOrders(ords || []);
      setAdminProducts(prods || []);
      setAdminInventory(inv || []);
      setAdminCustomers(custs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.role === 'ADMIN') {
      reloadData();
    }
  }, [account]);

  if (!account || account.role !== 'ADMIN') {
    return (
      <div className="container page-pad empty-state">
        <ShieldAlert size={56} color="#b91c1c" />
        <h1>Yêu cầu quyền Quản trị viên (ADMIN)</h1>
        <p>Bạn cần đăng nhập tài khoản có `role = ADMIN` để truy cập trang này.</p>
        <div className="mt-5">
          <Link to="/auth" className="btn btn-primary">
            ĐẾN TRANG ĐĂNG NHẬP (chọn tài khoản Admin)
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await adminApi.updateOrderStatus(orderId, newStatus);
      await reloadData();
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật trạng thái đơn.');
    }
  };

  const handleRecordCod = async (orderId) => {
    try {
      await adminApi.recordCodPayment(orderId);
      await reloadData();
      alert('Đã ghi nhận thu tiền COD thành công!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!selectedVariantForAdjust) return;
    try {
      await adminApi.adjustStock({
        variantId: selectedVariantForAdjust.variantId,
        quantityDelta: Number(deltaQty),
        reason: adjustReason,
      });
      setSelectedVariantForAdjust(null);
      await reloadData();
      alert('Điều chỉnh tồn kho thành công!');
    } catch (err) {
      alert(err.message || 'Lỗi điều chỉnh tồn kho.');
    }
  };

  const handleToggleCustomer = async (customerId, currentStatus) => {
    const reason = prompt('Lý do thay đổi trạng thái tài khoản:');
    if (reason === null) return;
    try {
      await adminApi.updateCustomerStatus(customerId, !currentStatus, reason);
      await reloadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const nav = [
    ['Overview', LayoutDashboard],
    ['Orders', ClipboardList],
    ['Products', Package],
    ['Inventory', Settings],
    ['Customers', Users],
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          HAVIE.<small>ADMIN STUDIO v1</small>
        </Link>
        <nav aria-label="Admin navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={tab === label ? 'active' : ''}
              onClick={() => setTab(label)}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <Link to="/" className="admin-exit">
          <LogOut size={19} /> Về trang bán hàng
        </Link>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <span>STORE MANAGEMENT / {tab.toUpperCase()}</span>
          <strong>
            {account.fullName} <span className="admin-avatar">A</span>
          </strong>
        </header>

        <div className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">API CONTRACT V1 BACKOFFICE</span>
              <h1>
                {tab === 'Overview' ? 'Dashboard' : tab}
                <span className="dot">.</span>
              </h1>
            </div>
            <span className="demo-pill">CONTRACT PERSISTENT</span>
          </div>

          {/* Adjust Stock Modal */}
          {selectedVariantForAdjust && (
            <div className="qr-overlay">
              <div className="qr-modal text-left">
                <h2>ĐIỀU CHỈNH TỒN KHO (CONTRACT 4.4)</h2>
                <p>
                  Sản phẩm: <strong>{selectedVariantForAdjust.productName}</strong> (
                  {selectedVariantForAdjust.variantName})
                </p>
                <p>SKU: <strong>{selectedVariantForAdjust.sku}</strong></p>
                <p>Tồn kho hiện tại: <strong>{selectedVariantForAdjust.stockQuantity}</strong></p>
                <form onSubmit={handleAdjustStock}>
                  <label className="mt-[10px] mb-[5px] block">
                    SỐ LƯỢNG THAY ĐỔI (+ HOẶC -):
                    <input
                      type="number"
                      required
                      value={deltaQty}
                      onChange={(e) => setDeltaQty(e.target.value)}
                      placeholder="+5 hoặc -2"
                    />
                  </label>
                  <label className="mt-[10px] mb-[15px] block">
                    LÝ DO ĐIỀU CHỈNH:
                    <input
                      required
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-[10px]">
                    <button type="submit" className="btn btn-primary full">
                      XÁC NHẬN GHI SỔ
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setSelectedVariantForAdjust(null)}
                    >
                      HỦY
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {tab === 'Overview' && dashboardData && (
            <>
              <div className="stat-grid">
                <article className="stat-card">
                  <span>TỔNG DOANH THU (ĐÃ THU)</span>
                  <strong>{money(dashboardData.totalRevenue || 0)}</strong>
                  <small>Đơn COMPLETED & PAID</small>
                </article>
                <article className="stat-card">
                  <span>TỔNG ĐƠN HÀNG</span>
                  <strong>{dashboardData.totalOrders || 0}</strong>
                  <small>{dashboardData.pendingOrdersCount || 0} đơn đang chờ xử lý</small>
                </article>
                <article className="stat-card">
                  <span>CẢNH BÁO TỒN KHO</span>
                  <strong
                    className={
                      dashboardData.lowStockCount ? 'text-[#b91c1c]' : 'text-[inherit]'
                    }
                  >
                    {dashboardData.lowStockCount || 0}
                  </strong>
                  <small>Biến thể dưới ngưỡng an toàn (≤ 8)</small>
                </article>
                <article className="stat-card">
                  <span>KHÁCH HÀNG</span>
                  <strong>{dashboardData.totalCustomers || 0}</strong>
                  <small>Tài khoản khách hàng</small>
                </article>
              </div>

              <section className="admin-panel orders-panel mt-6">
                <div className="panel-title">
                  <h2>Đơn hàng gần đây</h2>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>MÃ ĐƠN</th>
                        <th>KHÁCH HÀNG</th>
                        <th>THANH TOÁN</th>
                        <th>TỔNG TIỀN</th>
                        <th>TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminOrders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td><strong>{o.orderCode}</strong></td>
                          <td>{o.recipientName}</td>
                          <td>
                            {o.paymentMethod} •{' '}
                            <span className={'status-badge ' + o.paymentStatus}>
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td>{money(o.totalAmount)}</td>
                          <td>
                            <span className={'status-badge ' + o.status}>
                              {ORDER_STATUS_LABELS[o.status] || o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {tab === 'Orders' && (
            <section className="admin-panel orders-panel">
              <div className="panel-title">
                <h2>Quản lý toàn bộ đơn hàng</h2>
                <span>{adminOrders.length} ĐƠN HÀNG</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>MÃ ĐƠN</th>
                      <th>NGÀY</th>
                      <th>KHÁCH HÀNG</th>
                      <th>ĐỊA CHỈ</th>
                      <th>TỔNG TIỀN</th>
                      <th>THANH TOÁN</th>
                      <th>CHUYỂN TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminOrders.map((o) => (
                      <tr key={o.id}>
                        <td><strong>{o.orderCode}</strong></td>
                        <td>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td>{o.recipientName}<br /><small>{o.recipientPhone}</small></td>
                        <td className="max-w-[200px] text-xs">{o.shippingAddress}</td>
                        <td><strong>{money(o.totalAmount)}</strong></td>
                        <td>
                          {o.paymentMethod} •{' '}
                          <span className={'status-badge ' + o.paymentStatus}>
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <select
                            value={o.status}
                            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          >
                            <option value="PENDING_PAYMENT">Chờ thanh toán</option>
                            <option value="PENDING_CONFIRMATION">Chờ xác nhận</option>
                            <option value="CONFIRMED">Đã xác nhận</option>
                            <option value="SHIPPING">Đang giao</option>
                            <option value="COMPLETED">Hoàn thành</option>
                            <option value="CANCELLED">Đã hủy</option>
                          </select>
                        </td>
                        <td>
                          {o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' && (
                            <button className="btn-mini" onClick={() => handleRecordCod(o.id)}>
                              Thu COD
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Products' && (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Danh mục sản phẩm & biến thể</h2>
                <span>{adminProducts.length} SẢN PHẨM</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SẢN PHẨM</th>
                      <th>DANH MỤC</th>
                      <th>BIẾN THỂ (VARIANTS)</th>
                      <th>ĐÁNH GIÁ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminProducts.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.category.name}</td>
                        <td>
                          {p.variants.map((v) => (
                            <div key={v.id} className="my-0.5 text-xs">
                              • {v.name} ({v.sku}): <strong>{money(v.price)}</strong> (Kho: {v.stockQuantity})
                            </div>
                          ))}
                        </td>
                        <td>★ {p.ratingAverage} ({p.reviewCount})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Inventory' && (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Quản lý tồn kho & Điều chỉnh kho (Inventory)</h2>
                <span>{adminInventory.length} BIẾN THỂ HÀNG</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>SẢN PHẨM</th>
                      <th>BIẾN THỂ</th>
                      <th>GIÁ BÁN</th>
                      <th>TỒN KHO</th>
                      <th>CẢNH BÁO</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminInventory.map((item) => (
                      <tr key={item.sku}>
                        <td><code>{item.sku}</code></td>
                        <td>{item.productName}</td>
                        <td>{item.variantName}</td>
                        <td>{money(item.price)}</td>
                        <td><strong>{item.stockQuantity}</strong></td>
                        <td>
                          {item.isLowStock ? (
                            <span className="status-badge CANCELLED">Sắp hết hàng (≤ 8)</span>
                          ) : (
                            <span className="status-badge COMPLETED">An toàn</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-mini"
                            onClick={() => {
                              setSelectedVariantForAdjust(item);
                              setDeltaQty(0);
                            }}
                          >
                            Điều chỉnh tồn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Customers' && (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Danh sách khách hàng</h2>
                <span>{adminCustomers.length} TÀI KHOẢN</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>HỌ TÊN</th>
                      <th>EMAIL</th>
                      <th>SỐ ĐIỆN THOẠI</th>
                      <th>SỐ ĐƠN ĐÃ ĐẶT</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminCustomers.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.fullName}</strong></td>
                        <td>{c.email}</td>
                        <td>{c.phone || 'Chưa có'}</td>
                        <td>{c.orderCount} đơn</td>
                        <td>
                          <span className={'status-badge ' + (c.isActive ? 'COMPLETED' : 'CANCELLED')}>
                            {c.isActive ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-mini"
                            onClick={() => handleToggleCustomer(c.id, c.isActive)}
                          >
                            {c.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route
            path="/*"
            element={
              <Shell>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<Listing />} />
                  <Route path="/products/:id" element={<Detail />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route
                    path="*"
                    element={
                      <div className="container empty-state">
                        <h1>Page not found.</h1>
                        <Link to="/" className="btn btn-primary">
                          BACK HOME
                        </Link>
                      </div>
                    }
                  />
                </Routes>
              </Shell>
            }
          />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
