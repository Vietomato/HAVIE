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
} from 'lucide-react';
import { products, categories, money } from './data';
import './style.css';
const Store = createContext(null);
const safeRead = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => safeRead('havie-cart', []));
  const [orders, setOrders] = useState(() => safeRead('havie-orders', []));
  const [account, setAccount] = useState(() => safeRead('havie-account', null));
  const [favorites, setFavorites] = useState(() => safeRead('havie-favorites', []));
  useEffect(() => localStorage.setItem('havie-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('havie-orders', JSON.stringify(orders)), [orders]);
  useEffect(() => localStorage.setItem('havie-account', JSON.stringify(account)), [account]);
  useEffect(() => localStorage.setItem('havie-favorites', JSON.stringify(favorites)), [favorites]);
  const add = (id, quantity = 1) =>
    setCart((current) => {
      const existing = current.find((item) => item.id === id);
      return existing
        ? current.map((item) =>
            item.id === id ? { ...item, quantity: item.quantity + quantity } : item,
          )
        : [...current, { id, quantity }];
    });
  const update = (id, quantity) =>
    setCart((current) =>
      quantity <= 0
        ? current.filter((item) => item.id !== id)
        : current.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  const toggleFavorite = (id) =>
    setFavorites((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + (products.find((p) => p.id === item.id)?.price ?? 0) * item.quantity,
    0,
  );
  return (
    <Store.Provider
      value={{
        cart,
        add,
        update,
        count,
        subtotal,
        orders,
        setOrders,
        setCart,
        account,
        setAccount,
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
          <NavLink to="/products?category=Rackets" onClick={() => setOpen(false)}>
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
          <Link
            to="/auth"
            aria-label={account ? 'Your account' : 'Sign in'}
            title={account?.name || 'Account'}
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
          <Link to="/products?category=Rackets">Rackets</Link>
          <Link to="/products?category=Shoes">Shoes</Link>
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
          <span className="footer-note">Demo storefront • No real payments</span>
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
  return (
    <article className="product-card">
      <div className="product-media">
        <Link to={'/products/' + product.id} aria-label={'View ' + product.name}>
          <img src={'/images/product-' + product.id + '.svg'} alt={product.name} loading="lazy" />
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
        <span>{product.category}</span>
        <span>
          <Star size={13} fill="currentColor" /> {product.rating}
        </span>
      </div>
      <Link to={'/products/' + product.id} className="product-name">
        {product.name}
      </Link>
      <div className="product-bottom">
        <strong>{money(product.price)}</strong>
        <button
          className="add-small"
          aria-label={'Add ' + product.name + ' to cart'}
          onClick={() => {
            add(product.id);
            navigate('/cart');
          }}
        >
          <Plus size={19} />
        </button>
      </div>
    </article>
  );
}
function Home() {
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
            { name: 'Rackets', n: '01', img: 1 },
            { name: 'Shoes', n: '02', img: 2 },
            { name: 'Apparel', n: '03', img: 4 },
            { name: 'Accessories', n: '04', img: 6 },
          ].map((c) => (
            <Link className="category-card" key={c.name} to={'/products?category=' + c.name}>
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
            {products.slice(0, 4).map((p) => (
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
          <span>Delivery information at checkout</span>
        </div>
        <div>
          <ShieldCheck size={26} />
          <strong>MADE FOR PERFORMANCE</strong>
          <span>Carefully selected essentials</span>
        </div>
        <div>
          <RotateCcw size={26} />
          <strong>SHOP WITH CONFIDENCE</strong>
          <span>Simple and thoughtful experience</span>
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
  useEffect(() => setDraft(q), [q]);
  const filtered = useMemo(() => {
    const items = products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (p.name + ' ' + p.category).toLowerCase().includes(q.toLowerCase()),
    );
    return [...items].sort((a, b) =>
      sort === 'price-low'
        ? a.price - b.price
        : sort === 'price-high'
          ? b.price - a.price
          : sort === 'rating'
            ? b.rating - a.rating
            : a.id - b.id,
    );
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
        <span>{filtered.length} PRODUCTS</span>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <h2>
            <SlidersHorizontal size={19} /> FILTERS
          </h2>
          <h3>CATEGORIES</h3>
          <div className="filter-options">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                onClick={() => change('category', c)}
              >
                {c}
                <span>
                  {c === 'All' ? products.length : products.filter((p) => p.category === c).length}
                </span>
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
                <option value="price-low">Price: Low to high</option>
                <option value="price-high">Price: High to low</option>
                <option value="rating">Top rated</option>
              </select>
              <ChevronDown size={16} />
            </label>
          </div>
          {filtered.length ? (
            <div className="products-grid catalog-grid">
              {filtered.map((p) => (
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
  const product = products.find((p) => p.id === Number(id));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useStore();
  const navigate = useNavigate();
  useEffect(() => {
    setQty(1);
    setAdded(false);
  }, [id]);
  if (!product)
    return (
      <div className="container empty-state">
        <h1>Product not found</h1>
        <Link className="btn btn-primary" to="/products">
          BACK TO SHOP
        </Link>
      </div>
    );
  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">HOME</Link> / <Link to="/products">SHOP</Link> / {product.name.toUpperCase()}
      </p>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            <img src={'/images/product-' + product.id + '.svg'} alt={product.name} />
          </div>
          <div className="detail-thumbs">
            <img src={'/images/product-' + product.id + '.svg'} alt="Product preview" />
            <span>HAVIE / PERFORMANCE SERIES</span>
          </div>
        </div>
        <section className="detail-info">
          <span className="eyebrow">{product.category.toUpperCase()} / HAVIE PERFORMANCE</span>
          <h1>
            {product.name}
            <span className="dot">.</span>
          </h1>
          <div className="rating">
            <Star size={16} fill="currentColor" /> {product.rating}{' '}
            <span>• Performance collection</span>
          </div>
          <div className="detail-price">
            {money(product.price)} {product.oldPrice && <del>{money(product.oldPrice)}</del>}
          </div>
          <p className="detail-description">{product.description}</p>
          <div className="detail-specs">
            <h3>PRODUCT DETAILS</h3>
            <ul>
              {product.specs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="quantity-row">
            <span>QUANTITY</span>
            <div className="qty-control">
              <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus size={16} />
              </button>
              <output>{qty}</output>
              <button aria-label="Increase quantity" onClick={() => setQty(Math.min(99, qty + 1))}>
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                add(product.id, qty);
                setAdded(true);
              }}
            >
              <ShoppingBag size={18} /> ADD TO CART
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                add(product.id, qty);
                navigate('/cart');
              }}
            >
              BUY NOW <ArrowRight size={17} />
            </button>
          </div>
          {added && (
            <p className="success-message" role="status">
              <CheckCircle2 size={17} /> Added to cart. <Link to="/cart">View cart →</Link>
            </p>
          )}
          <div className="detail-assurance">
            <Truck size={19} /> Shipping calculated at checkout <ShieldCheck size={19} /> Secure
            demo experience
          </div>
        </section>
      </div>
      <section className="section related">
        <div className="section-heading">
          <h2>
            YOU MAY ALSO LIKE<span className="dot">.</span>
          </h2>
        </div>
        <div className="products-grid">
          {products
            .filter((p) => p.id !== product.id)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
    </div>
  );
}
function Auth() {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const { account, setAccount } = useStore();
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must have at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setAccount({ name: mode === 'signup' ? name.trim() : email.split('@')[0], email });
    navigate('/');
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
          <p>For the moments that make the game yours.</p>
        </div>
        <span>THE COURT IS CALLING. / 2026</span>
      </aside>
      <section className="auth-panel">
        <div className="auth-box">
          {account ? (
            <>
              <span className="eyebrow">YOUR ACCOUNT</span>
              <h2>
                Welcome back,
                <br />
                {account.name}.
              </h2>
              <p>Signed in locally as {account.email}</p>
              <button
                className="btn btn-primary full"
                onClick={() => {
                  setAccount(null);
                  setPassword('');
                }}
              >
                SIGN OUT
              </button>
              <Link to="/products" className="text-link">
                CONTINUE SHOPPING <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <span className="eyebrow">YOUR HAVIE ACCOUNT</span>
              <h2>{mode === 'signin' ? 'Welcome back.' : 'Join the game.'}</h2>
              <p>
                {mode === 'signin'
                  ? 'Sign in to continue your journey.'
                  : 'Create an account to get started.'}
              </p>
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
              <form onSubmit={submit} className="auth-form">
                {mode === 'signup' && (
                  <label>
                    FULL NAME
                    <input
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </label>
                )}
                <label>
                  EMAIL ADDRESS
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  PASSWORD
                  <input
                    required
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                  />
                </label>
                {mode === 'signup' && (
                  <label>
                    CONFIRM PASSWORD
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Confirm password"
                    />
                  </label>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn btn-primary full" type="submit">
                  {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'} <ArrowRight size={18} />
                </button>
              </form>
              <p className="auth-disclaimer">
                Demo only. No real authentication or password storage.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
function Cart() {
  const { cart, update, subtotal } = useStore();
  return (
    <div className="container page-pad">
      <p className="breadcrumbs">
        <Link to="/">HOME</Link> / SHOPPING CART
      </p>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SELECTION</span>
          <h1>
            YOUR CART<span className="dot">.</span>
          </h1>
        </div>
      </div>
      {cart.length ? (
        <div className="cart-layout">
          <section className="cart-items">
            <div className="cart-head">
              <span>PRODUCT</span>
              <span>QUANTITY</span>
              <span>TOTAL</span>
            </div>
            {cart.map((item) => {
              const p = products.find((x) => x.id === item.id);
              if (!p) return null;
              return (
                <article className="cart-item" key={item.id}>
                  <Link to={'/products/' + p.id} className="cart-thumb">
                    <img src={'/images/product-' + p.id + '.svg'} alt={p.name} />
                  </Link>
                  <div className="cart-item-desc">
                    <span className="eyebrow">{p.category}</span>
                    <Link to={'/products/' + p.id}>{p.name}</Link>
                    <span>{money(p.price)}</span>
                    <button onClick={() => update(p.id, 0)} className="remove-link">
                      <Trash2 size={15} /> REMOVE
                    </button>
                  </div>
                  <div className="qty-control">
                    <button
                      aria-label={'Decrease ' + p.name}
                      onClick={() => update(p.id, item.quantity - 1)}
                    >
                      <Minus size={15} />
                    </button>
                    <output>{item.quantity}</output>
                    <button
                      aria-label={'Increase ' + p.name}
                      onClick={() => update(p.id, Math.min(99, item.quantity + 1))}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <strong>{money(p.price * item.quantity)}</strong>
                </article>
              );
            })}
            <Link to="/products" className="text-link back-shopping">
              <ArrowLeft size={18} /> CONTINUE SHOPPING
            </Link>
          </section>
          <aside className="summary">
            <h2>ORDER SUMMARY</h2>
            <div>
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="summary-total">
              <span>TOTAL</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <Link className="btn btn-primary full" to="/checkout">
              PROCEED TO CHECKOUT <ArrowRight size={17} />
            </Link>
            <p>Demo checkout. No payment will be processed.</p>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={54} />
          <h2>Your cart is empty.</h2>
          <p>Good gear is waiting for you.</p>
          <Link to="/products" className="btn btn-primary">
            EXPLORE THE COLLECTION <ArrowRight size={18} />
          </Link>
        </div>
      )}
    </div>
  );
}
function Checkout() {
  const { cart, subtotal, setCart, orders, setOrders, account } = useStore();
  const [done, setDone] = useState(false);
  const [name, setName] = useState(account?.name || '');
  const [email, setEmail] = useState(account?.email || '');
  const [address, setAddress] = useState('');
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    if (!cart.length) return;
    setOrders([
      {
        id: 'HV-' + Date.now().toString().slice(-7),
        customer: name,
        email,
        total: subtotal,
        status: 'Pending',
        date: new Date().toLocaleDateString('en-GB'),
        items: cart,
      },
      ...orders,
    ]);
    setCart([]);
    setDone(true);
  };
  return (
    <div className="container page-pad checkout-page">
      <p className="breadcrumbs">
        <Link to="/cart">CART</Link> / CHECKOUT
      </p>
      {done ? (
        <div className="empty-state">
          <CheckCircle2 size={62} />
          <h1>Order placed!</h1>
          <p>Your demo order has been saved locally. No real payment was processed.</p>
          <Link className="btn btn-primary" to="/">
            BACK TO HOME
          </Link>
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
          <div className="cart-layout">
            <form id="checkout-form" className="checkout-form" onSubmit={submit}>
              <h2>CONTACT & DELIVERY</h2>
              <label>
                FULL NAME
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                EMAIL
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                DELIVERY ADDRESS
                <textarea
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows="3"
                />
              </label>
              <p className="form-hint">
                This is a frontend demonstration. Do not enter real personal details.
              </p>
            </form>
            <aside className="summary">
              <h2>YOUR ORDER</h2>
              {cart.map((item) => {
                const p = products.find((x) => x.id === item.id);
                return p ? (
                  <div key={item.id}>
                    <span>
                      {p.name} × {item.quantity}
                    </span>
                    <strong>{money(p.price * item.quantity)}</strong>
                  </div>
                ) : null;
              })}
              <div className="summary-total">
                <span>TOTAL</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <button
                type="submit"
                form="checkout-form"
                disabled={!cart.length}
                className="btn btn-primary full"
              >
                PLACE DEMO ORDER <ArrowRight size={18} />
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
const demoOrders = [
  { id: 'HV-1024', customer: 'Alex Nguyen', total: 1290000, status: 'Pending', date: '14/10/2026' },
  { id: 'HV-1023', customer: 'Jamie Tran', total: 2440000, status: 'Shipping', date: '13/10/2026' },
  { id: 'HV-1022', customer: 'Taylor Le', total: 850000, status: 'Completed', date: '12/10/2026' },
];
function Admin() {
  const { orders, setOrders } = useStore();
  const [tab, setTab] = useState('Overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const allOrders = [...orders, ...demoOrders];
  const nav = [
    ['Overview', LayoutDashboard],
    ['Products', Package],
    ['Orders', ClipboardList],
    ['Customers', Users],
    ['Reports', ChartNoAxesColumn],
    ['Settings', Settings],
  ];
  return (
    <div className="admin-app">
      <aside className={'admin-sidebar ' + (mobileOpen ? 'open' : '')}>
        <Link to="/" className="admin-brand">
          HAVIE.<small>ADMIN STUDIO</small>
        </Link>
        <nav aria-label="Admin navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={tab === label ? 'active' : ''}
              onClick={() => {
                setTab(label);
                setMobileOpen(false);
              }}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <Link to="/" className="admin-exit">
          <LogOut size={19} /> Back to store
        </Link>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <button
            className="admin-mobile"
            aria-label="Toggle admin navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu />
          </button>
          <span>STORE MANAGEMENT / {tab.toUpperCase()}</span>
          <strong>
            HAVIE ADMIN <span className="admin-avatar">H</span>
          </strong>
        </header>
        <div className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">HAVIE OPERATIONS</span>
              <h1>
                {tab === 'Overview' ? 'Dashboard' : tab}
                <span className="dot">.</span>
              </h1>
              <p>Manage your store with clarity.</p>
            </div>
            <span className="demo-pill">DEMO DATA</span>
          </div>
          {tab === 'Overview' ? (
            <>
              <div className="stat-grid">
                {[
                  [
                    'TOTAL REVENUE',
                    money(48500000 + orders.reduce((s, o) => s + o.total, 0)),
                    '+12.8% this month',
                  ],
                  ['TOTAL ORDERS', String(128 + orders.length), '+8.2% this month'],
                  ['PRODUCTS', String(products.length), 'Catalog items'],
                  ['CUSTOMERS', '1,240', '+32 new this month'],
                ].map(([label, value, sub]) => (
                  <article className="stat-card" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{sub}</small>
                  </article>
                ))}
              </div>
              <div className="admin-charts">
                <section className="admin-panel">
                  <div className="panel-title">
                    <h2>Revenue overview</h2>
                    <span>APR — OCT 2026</span>
                  </div>
                  <div className="bar-chart">
                    {[38, 57, 49, 75, 64, 92, 81].map((n, i) => (
                      <div key={i} className="bar-col">
                        <span style={{ height: n + '%' }} />
                        <small>{['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT'][i]}</small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="admin-panel">
                  <div className="panel-title">
                    <h2>Order status</h2>
                  </div>
                  {[
                    ['Pending', 12],
                    ['Shipping', 26],
                    ['Completed', 83],
                    ['Cancelled', 7],
                  ].map(([label, n]) => (
                    <div className="status-row" key={label}>
                      <span>{label}</span>
                      <strong>{n}</strong>
                    </div>
                  ))}
                </section>
              </div>
              <OrdersTable orders={allOrders} setOrders={setOrders} demoCount={demoOrders.length} />
            </>
          ) : tab === 'Orders' ? (
            <OrdersTable orders={allOrders} setOrders={setOrders} demoCount={demoOrders.length} />
          ) : tab === 'Products' ? (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Product catalog</h2>
                <span>{products.length} ITEMS</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>CATEGORY</th>
                      <th>PRICE</th>
                      <th>RATING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.category}</td>
                        <td>{money(p.price)}</td>
                        <td>{p.rating} / 5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="admin-panel admin-placeholder">
              <Package size={42} />
              <h2>{tab} module</h2>
              <p>
                This section is a frontend placeholder. Connect your API to manage real{' '}
                {tab.toLowerCase()} data.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
function OrdersTable({ orders, setOrders, demoCount }) {
  const change = (id, status) =>
    setOrders((current) => current.map((o) => (o.id === id ? { ...o, status } : o)));
  return (
    <section className="admin-panel orders-panel">
      <div className="panel-title">
        <h2>Recent orders</h2>
        <span>
          {orders.length} ORDERS (INCLUDING {demoCount} SAMPLES)
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ORDER ID</th>
              <th>CUSTOMER</th>
              <th>DATE</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.customer}</td>
                <td>{o.date}</td>
                <td>{money(o.total)}</td>
                <td>
                  {o.id.startsWith('HV-10') ? (
                    <span className="status-chip">{o.status}</span>
                  ) : (
                    <select
                      aria-label={'Status for ' + o.id}
                      value={o.status}
                      onChange={(e) => change(o.id, e.target.value)}
                    >
                      <option>Pending</option>
                      <option>Shipping</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
