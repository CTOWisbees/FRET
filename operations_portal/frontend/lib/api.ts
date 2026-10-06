import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

let activeBaseUrl = '';

export const getOpsBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_OPS_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const cleaned = envUrl.trim().replace(/\/+$/, '');
    return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
  }
  if (activeBaseUrl) {
    const cleaned = activeBaseUrl.trim().replace(/\/+$/, '');
    return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
  }
  if (typeof window !== 'undefined') {
    const customApiUrl = localStorage.getItem('ops_api_url');
    if (customApiUrl) {
      return customApiUrl.endsWith('/api') ? customApiUrl : `${customApiUrl}/api`;
    }
    if (
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('wisbees.com') ||
      window.location.hostname.includes('onrender.com')
    ) {
      return 'https://operation-r9e5.onrender.com/api';
    }
    const savedPort = localStorage.getItem('ops_api_port');
    if (savedPort) {
      return `http://127.0.0.1:${savedPort}/api`;
    }
    return 'http://127.0.0.1:8001/api';
  }
  return 'https://operation-r9e5.onrender.com/api';
};

export const rawAxios = axios.create({
  baseURL: getOpsBaseUrl(),
  withCredentials: true,
  timeout: 45000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

rawAxios.interceptors.request.use((config) => {
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
rawAxios.interceptors.response.use(
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
        return rawAxios(error.config);
      }
    }
    return Promise.reject(error);
  }
);

// In-flight GET request deduplication & short-lived response cache
const inFlightRequests = new Map<string, Promise<AxiosResponse<any>>>();
const responseCache = new Map<string, { data: any; status: number; statusText: string; headers: any; timestamp: number }>();
const CACHE_TTL_MS = 2500; // 2.5s cache for fast multi-component mounting

export const clearApiCache = () => {
  responseCache.clear();
  inFlightRequests.clear();
};

export const api = {
  ...rawAxios,
  get: <T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> => {
    const key = `GET:${url}:${JSON.stringify(config?.params || {})}`;
    const now = Date.now();

    // Check cache
    const cached = responseCache.get(key);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve({
        data: cached.data,
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
        config: config as any,
      } as unknown as R);
    }

    // Check in-flight promise
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as unknown as Promise<R>;
    }

    const requestPromise = rawAxios.get<T, R, D>(url, config)
      .then((res: any) => {
        responseCache.set(key, {
          data: res.data,
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          timestamp: Date.now(),
        });
        inFlightRequests.delete(key);
        return res;
      })
      .catch((err) => {
        inFlightRequests.delete(key);
        throw err;
      });

    inFlightRequests.set(key, requestPromise as any);
    return requestPromise;
  },
  post: <T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> => {
    clearApiCache();
    return rawAxios.post(url, data, config) as unknown as Promise<R>;
  },
  put: <T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> => {
    clearApiCache();
    return rawAxios.put(url, data, config) as unknown as Promise<R>;
  },
  delete: <T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> => {
    clearApiCache();
    return rawAxios.delete(url, config) as unknown as Promise<R>;
  },
  patch: <T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> => {
    clearApiCache();
    return rawAxios.patch(url, data, config) as unknown as Promise<R>;
  },
};
