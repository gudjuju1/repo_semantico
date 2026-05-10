import axios from 'axios';

// Define the control key - replace with your actual key or use environment variable
const CONTROL_KEY = import.meta.env.VITE_CONTROL_KEY || 'your-default-control-key';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add Authorization header if token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData, let browser set it automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (optional, for handling errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest = error.config?.url?.includes('/auth/login');
    const isControlKeyRequest = !!error.config?.headers?.['x-control-key'] || !!error.config?.headers?.['X-Control-Key'];

    if (error.response?.status === 401 && !isAuthRequest && !isControlKeyRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;