import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ArrowRight, SearchX } from 'lucide-react';
import Shell from './components/Shell.jsx';
import ScrollManager from './components/ScrollManager.jsx';
import Home from './pages/Home.jsx';
import Listing from './pages/Listing.jsx';
import Detail from './pages/Detail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Auth from './pages/Auth.jsx';
import AccountOrders from './pages/AccountOrders.jsx';
import Favorites from './pages/Favorites.jsx';
import Admin from './pages/admin/Admin.jsx';
import { StoreProvider } from './context/StoreContext.jsx';
import AdvisorChat from './components/AdvisorChat.jsx';

export default function App() {
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
                  <Route path="/account/orders" element={<AccountOrders />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route
                    path="*"
                    element={
                      <div className="container empty-state">
                        <h1>Không tìm thấy trang.</h1>
                        <Link to="/" className="btn btn-primary">
                          VỀ TRANG CHỦ
                        </Link>
                      </div>
                    }
                  />
                </Routes>
                      <AdvisorChat />
              </Shell>
            }
          />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
import { ToastProvider } from './context/ToastContext.jsx';
import usePageTitle from './hooks/usePageTitle.js';

function NotFound() {
  usePageTitle('Không tìm thấy trang');
  return (
    <div className="container empty-state">
      <SearchX size={54} aria-hidden="true" />
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn có thể đã thay đổi hoặc không còn tồn tại.</p>
      <div className="empty-actions">
        <Link to="/products" className="btn btn-primary">
          ĐẾN CỬA HÀNG <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/" className="btn btn-outline">
          VỀ TRANG CHỦ
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <StoreProvider>
          <ScrollManager />
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
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/account/orders" element={<AccountOrders />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Shell>
              }
            />
          </Routes>
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
