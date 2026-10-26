import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

const savedToken = localStorage.getItem('token');
if (savedToken) {
  api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    const isAuthRequest = ['/auth/login', '/auth/register'].some(path => error.config?.url?.includes(path));
    if (status === 401 && !isAuthRequest) {
      window.dispatchEvent(new CustomEvent('docmind:auth-expired'));
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;

