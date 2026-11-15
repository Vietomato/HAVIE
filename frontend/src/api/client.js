const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const apiUrl = (endpoint) => `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
export const AUTH_EVENT_KEY = 'havie-auth-event';
export const ACTIVITY_KEY = 'havie-last-activity';
export function signalSignedOut() {
  localStorage.removeItem('havie_access_token');
  localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type: 'logout', at: Date.now(), id: crypto.randomUUID() }));
  window.dispatchEvent(new Event('havie:logout'));
}

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
  async request(endpoint, options = {}) {
    const headers = {
      Accept: 'application/json',
      'X-Havie-Request': '1',
      ...options.headers,
    };

    // The browser must set multipart headers itself so they include the boundary.
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.activity === true) {
      headers['X-Havie-Activity'] = '1';
    }

    const url = apiUrl(endpoint);
    let response;
    try {
      response = await fetch(url, { ...options, headers, credentials: 'include' });
    } catch (error) {
      throw new ApiError(0, 'NETWORK_ERROR', `Không thể kết nối máy chủ API: ${error.message}`);
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await response.json() : null;

    if (!response.ok) {
      if ((response.status === 401 || body?.error?.code === 'ACCOUNT_DISABLED') && !/\/auth\/(?:login|register|social|mock-admin)/u.test(endpoint)) signalSignedOut();
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
