import React from 'react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, UserRound, ShoppingBag, Menu, X, ShieldAlert } from 'lucide-react';
import { useStore } from '../context/StoreContext.jsx';

export default function Header() {
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
        <Link to="/" className="brand" aria-label="Trang chủ HAVIE">
          HAVIE<span>.</span>
          <small>CỬA HÀNG CẦU LÔNG</small>
        </Link>
        <nav className={'main-nav ' + (open ? 'open' : '')} aria-label="Điều hướng chính">
          <NavLink to="/" onClick={() => setOpen(false)}>
            TRANG CHỦ
          </NavLink>
          <NavLink to="/products" onClick={() => setOpen(false)}>
            CỬA HÀNG
          </NavLink>
          <NavLink to="/products?category=rackets" onClick={() => setOpen(false)}>
            BỘ SƯU TẬP
          </NavLink>
          <a href="/#about" onClick={() => setOpen(false)}>
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
