import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, authApi, cartApi } from '../api';
import { useToast } from './ToastContext.jsx';

const Store = createContext(null);

const loginPath = () =>
  '/auth?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);

export function StoreProvider({ children }) {
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
    if (!apiClient.getToken()) {
      setAuthLoading(false);
      return;
    }

    authApi
      .getMe()
      .then((user) => setAccount(user))
      .catch((error) => {
        if (error.status === 401) apiClient.clearToken();
        setAccount(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

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
    if (!apiClient.getToken()) return promptLogin();

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
