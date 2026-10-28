import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, authApi, cartApi } from '../api';
import Cart from '../pages/Cart.jsx';

const Store = createContext(null);

export function StoreProvider({ children }) {
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
      .catch(() => setAccount(null))
      .finally(() => setAuthLoading(false));
  }, []);

  // Fetch Cart on mount and on account change
  const refreshCart = async () => {
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

  const add = async (variantId, quantity = 1) => {
    try {
      const updated = await cartApi.addItem(variantId, quantity);
      setCart(updated);
      return { success: true };
    } catch (err) {
      alert(err.message || 'Không thể thêm vào giỏ hàng.');
      return { success: false, error: err };
    }
  };

  const update = async (itemId, quantity) => {
    try {
      const updated = await cartApi.updateItem(itemId, quantity);
      setCart(updated);
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật giỏ hàng.');
    }
  };

  const remove = async (itemId) => {
    try {
      const updated = await cartApi.removeItem(itemId);
      setCart(updated);
    } catch (err) {
      alert(err.message || 'Lỗi xóa khỏi giỏ hàng.');
    }
  };

  const toggleFavorite = (id) =>
    setFavorites((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    setAccount(res.user);
    await refreshCart();
    return res.user;
  };

  const register = async (payload) => {
    const res = await authApi.register(payload);
    setAccount(res.user);
    await refreshCart();
    return res.user;
  };

  const logout = async () => {
    await authApi.logout();
    setAccount(null);
    await refreshCart();
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
