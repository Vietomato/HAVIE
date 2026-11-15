import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { authApi, cartApi } from '../api';
import { useToast } from './ToastContext.jsx';
import { ACTIVITY_KEY, AUTH_EVENT_KEY, signalSignedOut } from '../api/client.js';
import { useQueryClient } from '@tanstack/react-query';

const Store = createContext(null);

const loginPath = () =>
  '/auth?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);

export function StoreProvider({ children }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
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
    localStorage.removeItem('havie_access_token');

    authApi
      .getMe()
      .then((user) => setAccount(user))
      .catch((error) => {
        setAccount(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    const signedOut = () => { void queryClient.cancelQueries(); queryClient.clear(); setAccount(null); setCart({ items: [] }); };
    const storage = (event) => { if (event.key === AUTH_EVENT_KEY) signedOut(); };
    window.addEventListener('havie:logout', signedOut);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener('havie:logout', signedOut); window.removeEventListener('storage', storage); };
  }, []);

  useEffect(() => {
    if (!account) return undefined;
    let lastWrite = 0;
    let lastSent = 0;
    let expiring = false;
    const idleMs = 30 * 60 * 1000;
    const activity = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastWrite > 1000) { localStorage.setItem(ACTIVITY_KEY, String(now)); lastWrite = now; }
    };
    activity();
    const tick = async () => {
      if (expiring) return;
      const now = Date.now();
      const lastActive = Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
      if (now - lastActive >= idleMs) {
        expiring = true;
        try { await authApi.logout(); } catch { /* Server expiry is authoritative. */ }
        signalSignedOut();
        setAccount(null); setCart({ items: [] });
      } else if (document.visibilityState === 'visible' && now - lastActive < 60000 && now - lastSent >= 60000) {
        lastSent = now;
        try { await authApi.activity(); } catch { /* 401 handling updates all tabs. */ }
      }
    };
    for (const type of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.addEventListener(type, activity, { passive: true });
    const timer = window.setInterval(tick, 10000);
    void tick();
    return () => {
      window.clearInterval(timer);
      for (const type of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.removeEventListener(type, activity);
    };
  }, [account?.id]);

  // Fetch Cart on mount and on account change
  const refreshCart = async (user = account) => {
    if (!user) {
      setCart({ items: [] });
      return;
    }

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

  const promptLogin = (error = {}) => {
    notify({
      type: 'error',
      message: 'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.',
      action: { label: 'Đăng nhập', to: loginPath() },
    });
    return { success: false, error };
  };

  const add = async (variantId, quantity = 1, { silent = false } = {}) => {
    if (!account) return promptLogin();

    try {
      const updated = await cartApi.addItem(variantId, quantity);
      setCart(updated);
      if (!silent) {
        notify({
          message: 'Đã thêm vào giỏ hàng.',
          action: { label: 'Xem giỏ hàng', to: '/cart' },
        });
      }
      return { success: true };
    } catch (err) {
      if (err.status === 401) return promptLogin(err);
      notify({ type: 'error', message: err.message || 'Không thể thêm vào giỏ hàng.' });
      return { success: false, error: err };
    }
  };

  const update = async (itemId, quantity) => {
    try {
      const updated = await cartApi.updateItem(itemId, quantity);
      setCart(updated);
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể cập nhật giỏ hàng.' });
    }
  };

  const remove = async (itemId) => {
    try {
      const updated = await cartApi.removeItem(itemId);
      setCart(updated);
      return true;
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể xóa khỏi giỏ hàng.' });
      return false;
    }
  };

  const toggleFavorite = (id) =>
    setFavorites((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    setAccount(res.user);
    return res.user;
  };

  const loginMockAdmin = async (email, password) => {
    const res = await authApi.loginMockAdmin({ email, password });
    setAccount(res.user);
    return res.user;
  };

  const register = async (payload) => {
    const res = await authApi.register(payload);
    setAccount(res.user);
    return res.user;
  };

  const logout = async () => {
    await authApi.logout();
    setAccount(null);
    await refreshCart(null);
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
        loginMockAdmin,
        register,
        logout,
        authLoading,
        cart,
        cartLoading,
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

export const useStore = () => useContext(Store);
