import axios from 'axios';

let activeBaseUrl = '';

export const getOpsBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_OPS_API_URL) {
    return process.env.NEXT_PUBLIC_OPS_API_URL;
  }
  if (activeBaseUrl) {
    return activeBaseUrl;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('onrender.com')) {
      return 'https://beta-ops.onrender.com/api';
    }
    const savedPort = localStorage.getItem('ops_api_port');
    if (savedPort) {
      return `http://127.0.0.1:${savedPort}/api`;
    }
    // Default to port 8000 (standard Django runserver) or 8001
    return 'http://127.0.0.1:8000/api';
  }
  return 'http://127.0.0.1:8000/api';
};

export const api = axios.create({
  baseURL: getOpsBaseUrl(),
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    config.baseURL = getOpsBaseUrl();
    const token = localStorage.getItem('ops_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      config.headers['X-User-Auth'] = token;
    }
    const savedUser = localStorage.getItem('ops_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u?.id) {
          config.headers['X-User-Id'] = u.id;
        }
      } catch (e) {}
    }
  }
  return config;
});

// Automatic fallback between port 8000 and 8001 if one fails
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      typeof window !== 'undefined' &&
      error.message &&
      (error.message.includes('Network Error') || error.code === 'ERR_NETWORK') &&
      !error.config._retry
    ) {
      error.config._retry = true;
      const currentUrl = error.config.baseURL || getOpsBaseUrl();
      let fallbackUrl = '';
      if (currentUrl.includes(':8000')) {
        fallbackUrl = currentUrl.replace(':8000', ':8001');
        localStorage.setItem('ops_api_port', '8001');
      } else if (currentUrl.includes(':8001')) {
        fallbackUrl = currentUrl.replace(':8001', ':8000');
        localStorage.setItem('ops_api_port', '8000');
      }
      if (fallbackUrl) {
        activeBaseUrl = fallbackUrl;
        error.config.baseURL = fallbackUrl;
        return api(error.config);
      }
    }
    return Promise.reject(error);
  }
);
