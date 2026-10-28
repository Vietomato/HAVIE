import React from 'react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, UserRound, ShoppingBag, Menu, X, ShieldAlert } from 'lucide-react';
import Home from '../pages/Home.jsx';
import Cart from '../pages/Cart.jsx';
import Admin from '../pages/admin/Admin.jsx';
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
