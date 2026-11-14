import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, X, ShieldCheck } from 'lucide-react';
import { OrdersIcon, FavoriteIcon, PlayerIcon, ShuttleBagIcon } from './SportIcons.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { m } from './motion.jsx';
import Logo from './Logo.jsx';

export default function Header() {
  const { count, account, favorites } = useStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const urlQuery = pathname === '/products' ? new URLSearchParams(search).get('q') || '' : '';
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => setQuery(urlQuery), [urlQuery]);
  useEffect(() => setOpen(false), [pathname, search, hash]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const isCollection =
    pathname === '/products' && new URLSearchParams(search).get('category') === 'rackets';
  const activeItem =
    pathname === '/'
      ? 'home'
      : pathname === '/about'
        ? 'about'
        : pathname === '/products' || pathname.startsWith('/products/')
          ? isCollection
            ? 'collection'
            : 'store'
          : null;
  const navProps = (item) => ({
    className: activeItem === item ? 'active' : undefined,
    'aria-current': activeItem === item ? 'page' : undefined,
  });

  const submit = (e) => {
    e.preventDefault();
    const term = query.trim();
    navigate(term ? '/products?q=' + encodeURIComponent(term) : '/products');
  };

  const searchFields = (id) => (
    <>
      <label className="sr-only" htmlFor={id}>
        Tìm kiếm sản phẩm
      </label>
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm vợt, giày, phụ kiện..."
      />
      <button aria-label="Tìm kiếm" type="submit">
        <Search size={20} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="Trang chủ HAVIE">
          <Logo />
        </Link>
        <nav
          id="main-nav"
          className={'main-nav ' + (open ? 'open' : '')}
          aria-label="Điều hướng chính"
        >
          <form className="header-search nav-search" role="search" onSubmit={submit}>
            {searchFields('mobile-site-search')}
          </form>
          <Link to="/" {...navProps('home')}>
            Trang chủ
          </Link>
          <Link to="/products" {...navProps('store')}>
            Cửa hàng
          </Link>
          <Link to="/products?category=rackets" {...navProps('collection')}>
            Vợt cầu lông
          </Link>
          <Link to="/about" {...navProps('about')}>
            Về chúng tôi
          </Link>
          {account?.role === 'CUSTOMER' && (
            <Link to="/account/orders" className="nav-mobile-only">
              Đơn hàng của tôi
            </Link>
          )}
        </nav>
        <form className="header-search desktop-search" role="search" onSubmit={submit}>
          {searchFields('site-search')}
        </form>
        <div className="header-actions">
          {account?.role === 'ADMIN' && (
            <Link to="/admin" className="admin-shortcut-pill">
              <ShieldCheck size={15} aria-hidden="true" /> <span>Quản trị</span>
            </Link>
          )}
          {account?.role === 'CUSTOMER' && (
            <Link
              to="/account/orders"
              className={
                'header-icon header-orders-link ' +
                (pathname === '/account/orders' ? 'active' : '')
              }
              aria-label="Lịch sử đơn hàng"
              aria-current={pathname === '/account/orders' ? 'page' : undefined}
              title="Lịch sử đơn hàng"
            >
              <OrdersIcon size={22} aria-hidden="true" />
            </Link>
          )}
          <Link
            to="/favorites"
            className={'header-icon cart-icon ' + (pathname === '/favorites' ? 'active' : '')}
            aria-label={'Sản phẩm yêu thích: ' + favorites.length}
            title="Sản phẩm yêu thích"
          >
            <FavoriteIcon size={22} aria-hidden="true" />
            {favorites.length > 0 && (
              <m.span
                key={favorites.length}
                aria-hidden="true"
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 12 }}
              >
                {favorites.length}
              </m.span>
            )}
          </Link>
          <Link
            to="/auth"
            className={'header-icon ' + (pathname === '/auth' ? 'active' : '')}
            aria-label={account ? 'Tài khoản của bạn' : 'Đăng nhập'}
            title={account?.fullName || 'Đăng nhập'}
          >
            <PlayerIcon size={22} aria-hidden="true" />
          </Link>
          <Link
            to="/cart"
            className={'header-icon cart-icon ' + (pathname === '/cart' ? 'active' : '')}
            aria-label={'Giỏ hàng có ' + count + ' sản phẩm'}
            title="Giỏ hàng"
          >
            <ShuttleBagIcon size={22} aria-hidden="true" />
            {count > 0 && (
              <m.span
                key={count}
                aria-hidden="true"
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 12 }}
              >
                {count}
              </m.span>
            )}
          </Link>
          <button
            type="button"
            className="header-icon mobile-toggle"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
