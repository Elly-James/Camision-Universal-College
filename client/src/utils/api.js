import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
let token = localStorage.getItem('token') || null;
let socketJobs = null;
let socketMessages = null;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request Interceptor: Add Authorization header with token if available
api.interceptors.request.use(
  (config) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Utility function for exponential backoff delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Response Interceptor: Handle errors, rate limiting, and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 429 (Too Many Requests) with exponential backoff
    if (error.response && error.response.status === 429 && !originalRequest._retryCount) {
      originalRequest._retryCount = originalRequest._retryCount || 0;
      if (originalRequest._retryCount < 3) {
        originalRequest._retryCount += 1;
        const backoffTime = Math.pow(2, originalRequest._retryCount) * 1000; // 2s, 4s, 8s
        console.warn(`Rate limit hit for ${originalRequest.url}, retrying after ${backoffTime}ms`);
        await delay(backoffTime);
        return api(originalRequest);
      }
    }

    // Handle 401 (Unauthorized) with token refresh
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem('refresh_token')
    ) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('refresh_token')}`,
            },
            withCredentials: true,
          }
        );
        const { access_token } = refreshResponse.data;
        setToken(access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        clearToken();
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('role');
        localStorage.removeItem('email');
        window.location.href = '/auth';
        return Promise.reject(refreshError);
      }
    }

    if (error.response) {
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        url: originalRequest.url,
      });
      return Promise.reject({
        error: error.response.data.error || 'Request failed',
        details: error.response.data.details || error.response.data,
      });
    }
    console.error('Network Error:', error.message);
    return Promise.reject({ error: 'Network error', details: error.message });
  }
);

// Set token and reconnect sockets
export const setToken = (newToken) => {
  token = newToken;
  localStorage.setItem('token', newToken);
  reconnectSockets();
};

// Clear token and disconnect sockets
export const clearToken = () => {
  token = null;
  localStorage.removeItem('token');
  disconnectSockets();
};

// Reconnect Socket.IO connections
const reconnectSockets = () => {
  disconnectSockets();
  if (token) {
    socketJobs = io(`${API_URL}/jobs`, {
      path: '/socket.io',
      query: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketMessages = io(`${API_URL}/messages`, {
      path: '/socket.io',
      query: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketJobs.on('connect', () => {
      console.log('Socket.IO /jobs connected');
    });

    socketMessages.on('connect', () => {
      console.log('Socket.IO /messages connected');
    });

    socketJobs.on('connect_error', (error) => {
      console.error('Socket.IO /jobs connection error:', error);
    });

    socketMessages.on('connect_error', (error) => {
      console.error('Socket.IO /messages connection error:', error);
    });

    socketJobs.on('disconnect', (reason) => {
      console.warn('Socket.IO /jobs disconnected:', reason);
    });

    socketMessages.on('disconnect', (reason) => {
      console.warn('Socket.IO /messages disconnected:', reason);
    });
  }
};

// Disconnect Socket.IO connections
const disconnectSockets = () => {
  if (socketJobs) {
    socketJobs.disconnect();
    socketJobs = null;
  }
  if (socketMessages) {
    socketMessages.disconnect();
    socketMessages = null;
  }
};

export const getSocketJobs = () => socketJobs;
export const getSocketMessages = () => socketMessages;

// Initialize sockets if token exists
if (token) {
  reconnectSockets();
}

// Authentication API calls
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    setToken(response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
    localStorage.setItem('role', response.data.role);
    localStorage.setItem('email', response.data.user.email);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const googleLogin = async (credential) => {
  try {
    const response = await api.post('/auth/google', { credential });
    setToken(response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
    localStorage.setItem('role', response.data.role);
    localStorage.setItem('email', response.data.user.email);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const register = async ({ email, password }) => {
  try {
    const response = await api.post('/auth/register', { email, password });
    setToken(response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
    localStorage.setItem('role', response.data.role);
    localStorage.setItem('email', response.data.user.email);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  try {
    const response = await api.post('/auth/logout');
    clearToken();
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    return response.data;
  } catch (error) {
    clearToken();
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    throw error;
  }
};

export const forgotPassword = async (email) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const resetPassword = async (token, password) => {
  try {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Job-related API calls
export const createJob = async (formData) => {
  try {
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
    const response = await api.post('/api/jobs', formData, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getJobs = async () => {
  try {
    const response = await api.get('/api/jobs');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getJob = async (jobId) => {
  try {
    const response = await api.get(`/api/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateJob = async (jobId, updates) => {
  try {
    const response = await api.put(`/api/jobs/${jobId}`, updates);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Message-related API calls
export const sendMessage = async (formData, jobId = null) => {
  try {
    const url = jobId ? `/api/jobs/${jobId}/messages` : '/api/messages';
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
    if (!jobId) {
      formData.append('recipient_id', '1');
    }
    const response = await api.post(url, formData, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const editMessage = async (messageId, content) => {
  try {
    const response = await api.put(`/api/messages/${messageId}`, { content });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteMessage = async (messageId) => {
  try {
    const response = await api.delete(`/api/messages/${messageId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getMessages = async (jobId = null) => {
  try {
    const url = jobId ? `/api/jobs/${jobId}/messages` : '/api/messages';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Payment-related API calls
export const initiatePayment = async (payload) => {
  try {
    const config = {
      headers: {},
    };
    // Route to appropriate endpoint based on payload
    const url = payload.job_id ? '/api/payments/initiate-completion' : '/api/payments/initiate-upfront';
    if (payload instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data';
    } else {
      config.headers['Content-Type'] = 'application/json';
    }
    const response = await api.post(url, payload, config);
    return response.data;
  } catch (error) {
    console.error('Payment initiation error:', error);
    throw {
      error: error.error || 'Failed to initiate payment',
      details: error.details || error.response?.data?.error?.message || 'Unknown error',
    };
  }
};

export const getPaymentStatus = async (orderTrackingId) => {
  try {
    let attempts = 0;
    const maxAttempts = 3; // Reduced for faster feedback
    let response;
    while (attempts < maxAttempts) {
      try {
        response = await api.get(`/api/payments/status/${orderTrackingId}`);
        const status = response.data.payment_status;
        if (status !== 'PENDING') {
          return response.data;
        }
        attempts++;
        const backoffTime = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s
        console.warn(`Payment status PENDING, retrying after ${backoffTime}ms (attempt ${attempts}/${maxAttempts})`);
        await delay(backoffTime);
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) {
          throw error;
        }
        const backoffTime = Math.pow(2, attempts) * 1000;
        console.warn(`Payment status check failed, retrying after ${backoffTime}ms (attempt ${attempts}/${maxAttempts})`);
        await delay(backoffTime);
      }
    }
    throw new Error('Payment status still PENDING after maximum retries');
  } catch (error) {
    console.error('Payment status check failed:', error);
    throw {
      error: error.error || 'Failed to check payment status',
      details: error.details || error.response?.data?.error?.message || 'Unknown error',
    };
  }
};

// File download API call
export const getFile = async (filename) => {
  try {
    const normalizedFilename = filename.replace(/\\/g, '/');
    const config = {
      responseType: 'blob',
      headers: {
        Accept: 'application/octet-stream',
      },
    };
    const response = await api.get(`/Uploads/${normalizedFilename}`, config);

    let downloadFilename = normalizedFilename.split('/').pop();
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?\s*$/);
      if (filenameMatch && filenameMatch[1]) {
        downloadFilename = filenameMatch[1];
      }
    }

    const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decodeURIComponent(downloadFilename);
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return true;
  } catch (error) {
    console.error('File download failed:', error);
    throw {
      error: error.error || 'Failed to download file',
      details: error.details || error.response?.data?.error?.message || 'Unknown error',
    };
  }
};

export default api;