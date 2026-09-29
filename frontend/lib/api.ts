import axios from 'axios';

export const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('onrender.com')) {
      return 'https://beta-fret.onrender.com';
    }
  }
  return 'http://localhost:8000';
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const isRender = window.location.hostname.includes('onrender.com');
    const targetBase = process.env.NEXT_PUBLIC_API_URL || (isRender ? 'https://beta-fret.onrender.com' : 'http://localhost:8000');
    
    // Always enforce targetBase in browser to ensure correct backend is targeted
    config.baseURL = targetBase;

    const token = localStorage.getItem('fret_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      config.headers['X-User-Auth'] = token;

      if (token.startsWith('emp:')) {
        const uid = token.split(':')[1];
        if (uid) config.headers['X-Employee-Id'] = uid;
      }
    }

    const savedUser = localStorage.getItem('fret_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed?.id && !config.headers['X-Employee-Id']) {
          config.headers['X-Employee-Id'] = parsed.id;
        }
      } catch (e) {}
    }
  }
  return config;
});

export const getApiUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getBaseUrl();
  return `${base}${cleanPath}`;
};
