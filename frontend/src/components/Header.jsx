import React from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, UserRound, ShoppingBag, Menu, X, ShieldAlert } from 'lucide-react';
import { useStore } from '../context/StoreContext.jsx';

export default function Header() {
  const { count, account } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const isCollection = pathname === '/products' && new URLSearchParams(search).get('category') === 'rackets';
  const activeItem = pathname === '/' ? (hash === '#about' ? 'about' : 'home')
    : pathname === '/products' || pathname.startsWith('/products/') ? (isCollection ? 'collection' : 'store')
    : null;
  const navProps = (item) => ({
    className: activeItem === item ? 'active' : undefined,
    'aria-current': activeItem === item ? 'page' : undefined,
    onClick: () => setOpen(false),
  });

  const submit = (e) => {
    e.preventDefault();
    navigate('/products?q=' + encodeURIComponent(query));
    setOpen(false);
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="Trang chủ HAVIE">
          HAVIE<span>.</span>
          <small>CỬA HÀNG CẦU LÔNG</small>
        </Link>
        <nav className={'main-nav ' + (open ? 'open' : '')} aria-label="Điều hướng chính">
          <Link to="/" {...navProps('home')}>
            TRANG CHỦ
          </Link>
          <Link to="/products" {...navProps('store')}>
            CỬA HÀNG
          </Link>
          <Link to="/products?category=rackets" {...navProps('collection')}>
            BỘ SƯU TẬP
          </Link>
          <a href="/#about" {...navProps('about')}>
            VỀ CHÚNG TÔI
          </a>
        </nav>
        <form className="header-search" role="search" onSubmit={submit}>
          <label className="sr-only" htmlFor="site-search">
            Tìm kiếm sản phẩm
          </label>
          <input
            id="site-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sản phẩm..."
          />
          <button aria-label="Tìm kiếm" type="submit">
            <Search size={20} />
          </button>
        </form>
        <div className="header-actions">
          {account?.role === 'ADMIN' && (
            <Link to="/admin" className="admin-shortcut-pill" title="Mở trang Quản trị HAVIE">
              <ShieldAlert size={14} /> Quản trị
            </Link>
          )}
          <Link
            to="/auth"
            aria-label={account ? 'Tài khoản của bạn' : 'Đăng nhập'}
            title={account?.fullName || 'Tài khoản'}
          >
            <UserRound size={22} />
          </Link>
          <Link to="/cart" className="cart-icon" aria-label={'Giỏ hàng có ' + count + ' sản phẩm'}>
            <ShoppingBag size={22} />
            {count > 0 && <span>{count}</span>}
          </Link>
          <button
            className="mobile-toggle"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
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
