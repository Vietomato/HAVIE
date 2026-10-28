import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Listing from './pages/Listing.jsx';
import Detail from './pages/Detail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Auth from './pages/Auth.jsx';
import Admin from './pages/admin/Admin.jsx';
import { StoreProvider } from './context/StoreContext.jsx';

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
              </Shell>
            }
          />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
