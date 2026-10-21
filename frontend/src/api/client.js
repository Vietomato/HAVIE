// HAVIE API Contract v1 - Central HTTP & Mock Client
import { mockApi, MockApiError } from './mockService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; // default to true if backend is not yet started

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
  constructor() {
    this.tokenKey = 'havie_access_token';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
    mockApi.setCurrentToken(token);
  }

  clearToken() {
    this.setToken(null);
  }

  // Real HTTP request using fetch
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await res.json() : null;

    if (!res.ok) {
      const err = body?.error || {};
      throw new ApiError(
        res.status,
        err.code || 'UNKNOWN_ERROR',
        err.message || res.statusText || 'Có lỗi xảy ra',
        err.details || {},
      );
    }

    return body;
  }

  // Wrapper with Mock Fallback for smooth DX while backend is being built
  async callWithFallback(realRequestFn, mockRequestFn) {
    if (FORCE_MOCK) {
      try {
        return await mockRequestFn();
      } catch (err) {
        if (err instanceof MockApiError) {
          throw new ApiError(err.status, err.code, err.message, err.details);
        }
        throw err;
      }
    }

    try {
      return await realRequestFn();
    } catch (networkOrHttpError) {
      // If server is not running (e.g. ECONNREFUSED or 404 before backend endpoints are wired), fall back to mock
      if (networkOrHttpError instanceof TypeError || networkOrHttpError.status === 404 || networkOrHttpError.status === 502) {
        console.warn('Real API server unavailable, falling back to Contract Mock Engine:', networkOrHttpError.message);
        try {
          return await mockRequestFn();
        } catch (err) {
          if (err instanceof MockApiError) {
            throw new ApiError(err.status, err.code, err.message, err.details);
          }
          throw err;
        }
      }
      throw networkOrHttpError;
    }
  }
}

export const apiClient = new ApiClient();

