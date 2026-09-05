import axios from 'axios';

export const getOpsBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_OPS_API_URL) {
    return process.env.NEXT_PUBLIC_OPS_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('onrender.com')) {
      return 'https://beta-ops.onrender.com/api';
    }
    if (window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8001/api';
    }
  }
  return 'http://localhost:8001/api';
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
