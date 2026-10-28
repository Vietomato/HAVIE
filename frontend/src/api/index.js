// HAVIE API Contract v1 - HTTP Domain Services
import { apiClient } from './client';

export * from './types';
export { apiClient, ApiError } from './client';

const queryString = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== 'All'),
  ).toString();

export const authApi = {
  requestRegistrationOtp: async (payload) => {
    const res = await apiClient.request('/auth/register/request-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  register: async ({ email, code }) => {
    const res = await apiClient.request('/auth/register/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    if (res.data?.accessToken) apiClient.setToken(res.data.accessToken);
    return res.data;
  },

  login: async (payload) => {
    const res = await apiClient.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.accessToken) apiClient.setToken(res.data.accessToken);
    return res.data;
  },

  logout: async () => {
    try {
      await apiClient.request('/auth/logout', { method: 'POST' });
    } finally {
      apiClient.clearToken();
    }
  },

  getMe: async () => {
    const res = await apiClient.request('/me');
    return res.data;
  },

  updateMe: async (payload) => {
    const res = await apiClient.request('/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  },
};

export const addressApi = {
  getAddresses: async () => {
    const res = await apiClient.request('/me/addresses');
    return res.data;
  },

  addAddress: async (payload) => {
    const res = await apiClient.request('/me/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },
};

export const catalogApi = {
  getCategories: async () => {
    const res = await apiClient.request('/categories');
    return res.data;
  },

  getBrands: async () => {
    const res = await apiClient.request('/brands');
    return res.data;
  },

  getProducts: async (params = {}) => {
    const qs = queryString(params);
    return apiClient.request(`/products${qs ? `?${qs}` : ''}`);
  },

  getProduct: async (slugOrId) => {
    const res = await apiClient.request(`/products/${encodeURIComponent(slugOrId)}`);
    return res.data;
  },

  getProductReviews: async (slugOrId, params = {}) => {
    const qs = queryString(params);
    return apiClient.request(
      `/products/${encodeURIComponent(slugOrId)}/reviews${qs ? `?${qs}` : ''}`,
    );
  },
};

export const cartApi = {
  getCart: async () => {
    const res = await apiClient.request('/cart');
    return res.data;
  },

  addItem: async (variantId, quantity = 1) => {
    const res = await apiClient.request('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ variantId, quantity }),
    });
    return res.data;
  },

  updateItem: async (itemId, quantity) => {
    const res = await apiClient.request(`/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    return res.data;
  },

  removeItem: async (itemId) => {
    const res = await apiClient.request(`/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });
    return res.data;
  },
};

export const orderApi = {
  createOrder: async (payload) => {
    const res = await apiClient.request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  getMyOrders: async (params = {}) => {
    const qs = queryString(params);
    const res = await apiClient.request(`/orders/my${qs ? `?${qs}` : ''}`);
    return res.data;
  },

  cancelOrder: async (orderId, reason) => {
    const res = await apiClient.request(`/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },
};

export const reviewApi = {
  createReview: async (payload) => {
    const res = await apiClient.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },
};

export const adminApi = {
  getProducts: async () => {
    const res = await apiClient.request('/admin/products');
    return res.data;
  },

  getOrders: async () => {
    const res = await apiClient.request('/admin/orders');
    return res.data;
  },

  updateOrderStatus: async (orderId, status, note) => {
    const res = await apiClient.request(
      `/admin/orders/${encodeURIComponent(orderId)}/status`,
      { method: 'PATCH', body: JSON.stringify({ status, note }) },
    );
    return res.data;
  },

  recordCodPayment: async (orderId) => {
    const res = await apiClient.request(
      `/admin/orders/${encodeURIComponent(orderId)}/cod-payment`,
      { method: 'POST' },
    );
    return res.data;
  },

  getCustomers: async () => {
    const res = await apiClient.request('/admin/customers');
    return res.data;
  },

  updateCustomerStatus: async (customerId, isActive, reason) => {
    const res = await apiClient.request(
      `/admin/customers/${encodeURIComponent(customerId)}/status`,
      { method: 'PATCH', body: JSON.stringify({ isActive, reason }) },
    );
    return res.data;
  },

  getInventory: async () => {
    const res = await apiClient.request('/admin/inventory');
    return res.data;
  },

  adjustStock: async (payload) => {
    const res = await apiClient.request('/admin/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  getDashboard: async (from, to) => {
    const params = from && to ? { from, to } : {};
    const qs = queryString(params);
    const res = await apiClient.request(`/admin/dashboard${qs ? `?${qs}` : ''}`);
    return res.data;
  },
};
