// HAVIE API Contract v1 - High-level Domain Services
import { apiClient } from './client';
import { mockApi } from './mockService';

export * from './types';
export { apiClient, ApiError } from './client';

// 3.1 Auth API
export const authApi = {
  register: async (payload) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
      () => mockApi.register(payload),
    );
    if (res.data?.accessToken) {
      apiClient.setToken(res.data.accessToken);
    }
    return res.data;
  },

  login: async (payload) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
      () => mockApi.login(payload),
    );
    if (res.data?.accessToken) {
      apiClient.setToken(res.data.accessToken);
    }
    return res.data;
  },

  logout: async () => {
    try {
      await apiClient.callWithFallback(
        () => apiClient.request('/auth/logout', { method: 'POST' }),
        () => mockApi.logout(),
      );
    } finally {
      apiClient.clearToken();
    }
  },

  getMe: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/me', { method: 'GET' }),
      () => mockApi.getMe(),
    );
    return res.data;
  },

  updateMe: async (payload) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/me', { method: 'PATCH', body: JSON.stringify(payload) }),
      () => mockApi.updateMe(payload),
    );
    return res.data;
  },
};

// 3.2 Address API
export const addressApi = {
  getAddresses: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/me/addresses', { method: 'GET' }),
      () => mockApi.getAddresses(),
    );
    return res.data;
  },

  addAddress: async (payload) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/me/addresses', { method: 'POST', body: JSON.stringify(payload) }),
      () => mockApi.addAddress(payload),
    );
    return res.data;
  },
};

// 3.3 Catalog API
export const catalogApi = {
  getCategories: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/categories', { method: 'GET' }),
      () => mockApi.getCategories(),
    );
    return res.data;
  },

  getBrands: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/brands', { method: 'GET' }),
      () => mockApi.getBrands(),
    );
    return res.data;
  },

  getProducts: async (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '' && v !== 'All'),
    ).toString();
    const endpoint = `/products${qs ? `?${qs}` : ''}`;

    const res = await apiClient.callWithFallback(
      () => apiClient.request(endpoint, { method: 'GET' }),
      () => mockApi.getProducts(params),
    );
    return res;
  },

  getProduct: async (slugOrId) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/products/${slugOrId}`, { method: 'GET' }),
      () => mockApi.getProductBySlug(slugOrId),
    );
    return res.data;
  },

  getProductReviews: async (slugOrId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const endpoint = `/products/${slugOrId}/reviews${qs ? `?${qs}` : ''}`;
    const res = await apiClient.callWithFallback(
      () => apiClient.request(endpoint, { method: 'GET' }),
      () => mockApi.getProductReviews(slugOrId, params),
    );
    return res;
  },
};

// 3.4 Cart API
export const cartApi = {
  getCart: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/cart', { method: 'GET' }),
      () => mockApi.getCart(),
    );
    return res.data;
  },

  addItem: async (variantId, quantity = 1) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/cart/items', { method: 'POST', body: JSON.stringify({ variantId, quantity }) }),
      () => mockApi.addToCart({ variantId, quantity }),
    );
    return res.data;
  },

  updateItem: async (itemId, quantity) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/cart/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
      () => mockApi.updateCartItem(itemId, { quantity }),
    );
    return res.data;
  },

  removeItem: async (itemId) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/cart/items/${itemId}`, { method: 'DELETE' }),
      () => mockApi.removeCartItem(itemId),
    );
    return res.data;
  },
};

// 3.5 Orders API
export const orderApi = {
  createOrder: async (payload) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
      () => mockApi.createOrder(payload),
    );
    return res.data;
  },

  getMyOrders: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const endpoint = `/orders/my${qs ? `?${qs}` : ''}`;
    const res = await apiClient.callWithFallback(
      () => apiClient.request(endpoint, { method: 'GET' }),
      () => mockApi.getMyOrders(params),
    );
    return res.data;
  },

  cancelOrder: async (orderId, reason) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/orders/${orderId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
      () => mockApi.cancelOrder(orderId, { reason }),
    );
    return res.data;
  },

  simulateQrPaymentSuccess: async (orderId) => {
    const res = await mockApi.simulateQrPaymentSuccess(orderId);
    return res.data;
  },
};

// 3.6 Reviews API
export const reviewApi = {
  createReview: async (payload) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/reviews', { method: 'POST', body: JSON.stringify(payload) }),
      () => mockApi.createReview(payload),
    );
    return res.data;
  },
};

// 4. Admin API
export const adminApi = {
  getProducts: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/admin/products', { method: 'GET' }),
      () => mockApi.adminGetProducts(),
    );
    return res.data;
  },

  getOrders: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/admin/orders', { method: 'GET' }),
      () => mockApi.adminGetOrders(),
    );
    return res.data;
  },

  updateOrderStatus: async (orderId, status, note) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
      () => mockApi.adminUpdateOrderStatus(orderId, status, note),
    );
    return res.data;
  },

  recordCodPayment: async (orderId) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/admin/orders/${orderId}/cod-payment`, { method: 'POST' }),
      () => mockApi.adminRecordCodPayment(orderId),
    );
    return res.data;
  },

  getCustomers: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/admin/customers', { method: 'GET' }),
      () => mockApi.adminGetCustomers(),
    );
    return res.data;
  },

  updateCustomerStatus: async (customerId, isActive, reason) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/admin/customers/${customerId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive, reason }) }),
      () => mockApi.adminUpdateCustomerStatus(customerId, isActive, reason),
    );
    return res.data;
  },

  getInventory: async () => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/admin/inventory', { method: 'GET' }),
      () => mockApi.adminGetInventory(),
    );
    return res.data;
  },

  adjustStock: async (payload) => {
    const res = await apiClient.callWithFallback(
      () => apiClient.request('/admin/inventory/adjustments', { method: 'POST', body: JSON.stringify(payload) }),
      () => mockApi.adminAdjustStock(payload),
    );
    return res.data;
  },

  getDashboard: async (from, to) => {
    const qs = from && to ? `?from=${from}&to=${to}` : '';
    const res = await apiClient.callWithFallback(
      () => apiClient.request(`/admin/dashboard${qs}`, { method: 'GET' }),
      () => mockApi.adminGetDashboard(from, to),
    );
    return res.data;
  },
};

