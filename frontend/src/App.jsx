import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ArrowRight, SearchX } from 'lucide-react';
import Shell from './components/Shell.jsx';
import ScrollManager from './components/ScrollManager.jsx';
import Home from './pages/Home.jsx';
import { StoreProvider } from './context/StoreContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import usePageTitle from './hooks/usePageTitle.js';
import { BlockSkeleton } from './components/Skeleton.jsx';

const Listing = lazy(() => import('./pages/Listing.jsx'));
const Detail = lazy(() => import('./pages/Detail.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const AccountOrders = lazy(() => import('./pages/AccountOrders.jsx'));
const Favorites = lazy(() => import('./pages/Favorites.jsx'));
const Admin = lazy(() => import('./pages/admin/Admin.jsx'));
const AdvisorChat = lazy(() => import('./components/AdvisorChat.jsx'));

function PageFallback() {
  return (
    <div className="container">
      <BlockSkeleton label="Đang tải trang..." rows={4} />
    </div>
  );
}

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
          <Suspense fallback={<PageFallback />}>
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
                    <Suspense fallback={null}>
                      <AdvisorChat />
                    </Suspense>
                  </Shell>
                }
              />
            </Routes>
          </Suspense>
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
