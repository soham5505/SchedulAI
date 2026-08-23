import axios from 'axios';
import { ApiResponse, ApiErrorResponse } from '@schedulai/shared-types';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach Access Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('schedulai_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle Refresh Token on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('schedulai_refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('schedulai_access_token');
        localStorage.removeItem('schedulai_refresh_token');
        localStorage.removeItem('schedulai_user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>(
          '/api/v1/auth/refresh',
          { refreshToken }
        );

        const newAccessToken = data.data?.tokens.accessToken;
        const newRefreshToken = data.data?.tokens.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('schedulai_access_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('schedulai_refresh_token', newRefreshToken);
          }
          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('schedulai_access_token');
        localStorage.removeItem('schedulai_refresh_token');
        localStorage.removeItem('schedulai_user');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const errorMessage =
      error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(errorMessage));
  }
);
