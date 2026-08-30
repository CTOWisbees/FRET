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
  return 'http://localhost:5000';
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
    const targetBase = process.env.NEXT_PUBLIC_API_URL || (isRender ? 'https://beta-fret.onrender.com' : 'http://localhost:5000');
    
    // Always enforce targetBase in browser to ensure correct backend is targeted
    config.baseURL = targetBase;

    const token = localStorage.getItem('fret_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      config.headers['X-User-Auth'] = token;
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
