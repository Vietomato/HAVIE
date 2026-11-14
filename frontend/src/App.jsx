import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queries.js';
import { ArrowRight, SearchX } from 'lucide-react';
import Shell from './components/Shell.jsx';
import ScrollManager from './components/ScrollManager.jsx';
import Home from './pages/Home.jsx';
import { StoreProvider } from './context/StoreContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import usePageTitle from './hooks/usePageTitle.js';
import { BlockSkeleton } from './components/Skeleton.jsx';
import { MotionProvider, PageTransition } from './components/motion.jsx';

const Listing = lazy(() => import('./pages/Listing.jsx'));
const Detail = lazy(() => import('./pages/Detail.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const AccountOrders = lazy(() => import('./pages/AccountOrders.jsx'));
const Favorites = lazy(() => import('./pages/Favorites.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Admin = lazy(() => import('./pages/admin/Admin.jsx'));
const AdvisorChat = lazy(() => import('./components/AdvisorChat.jsx'));

// Re-keys on pathname only, so filter/query-string changes do not replay the entrance.
function AnimatedPage({ children }) {
  const { pathname } = useLocation();
  return <PageTransition routeKey={pathname}>{children}</PageTransition>;
}

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
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <BrowserRouter>
          <ToastProvider>
            <StoreProvider>
              <ScrollManager />
              <Routes>
                <Route
                  path="/admin"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <Admin />
                    </Suspense>
                  }
                />
                <Route
                  path="/*"
                  element={
                    <Shell>
                      <AnimatedPage>
                        <Suspense fallback={<PageFallback />}>
                          <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/products" element={<Listing />} />
                            <Route path="/products/:id" element={<Detail />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/favorites" element={<Favorites />} />
                            <Route path="/auth" element={<Auth />} />
                            <Route path="/account/orders" element={<AccountOrders />} />
                            <Route path="/cart" element={<Cart />} />
                            <Route path="/checkout" element={<Checkout />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </AnimatedPage>
                      <Suspense fallback={null}>
                        <AdvisorChat />
                      </Suspense>
                    </Shell>
                  }
                />
              </Routes>
            </StoreProvider>
          </ToastProvider>
        </BrowserRouter>
      </MotionProvider>
    </QueryClientProvider>
  );
}
