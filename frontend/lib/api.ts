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

const API_BASE_URL = getBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    if ((!config.baseURL || config.baseURL.includes('localhost:8000')) && window.location.hostname.includes('onrender.com')) {
      config.baseURL = 'https://beta-fret.onrender.com';
    }
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
  const base = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')
    ? (process.env.NEXT_PUBLIC_API_URL || 'https://beta-fret.onrender.com')
    : API_BASE_URL;
  return `${base}${cleanPath}`;
};
