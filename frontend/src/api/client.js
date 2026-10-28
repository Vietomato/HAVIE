const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  tokenKey = 'havie_access_token';

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  clearToken() {
    this.setToken(null);
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (error) {
      throw new ApiError(0, 'NETWORK_ERROR', `Không thể kết nối máy chủ API: ${error.message}`);
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await response.json() : null;

    if (!response.ok) {
      const error = body?.error || {};
      throw new ApiError(
        response.status,
        error.code || 'UNKNOWN_ERROR',
        error.message || response.statusText || 'Có lỗi xảy ra',
        error.details || {},
      );
    }

    return body;
  }
}

export const apiClient = new ApiClient();
