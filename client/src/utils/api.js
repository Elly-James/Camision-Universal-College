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
  withCredentials: true, // Enable credentials for CORS
});

api.interceptors.request.use(
  (config) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
          `${API_URL}/api/auth/refresh`,
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

export const setToken = (newToken) => {
  token = newToken;
  localStorage.setItem('token', newToken);
  reconnectSockets();
};

export const clearToken = () => {
  token = null;
  localStorage.removeItem('token');
  disconnectSockets();
};

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

export const login = async (email, password) => {
  const response = await api.post('/api/auth/login', { email, password });
  setToken(response.data.access_token);
  localStorage.setItem('refresh_token', response.data.refresh_token);
  localStorage.setItem('role', response.data.role);
  localStorage.setItem('email', response.data.user.email);
  return response.data;
};

export const googleLogin = async (credential) => {
  const response = await api.post('/api/auth/google', { credential });
  setToken(response.data.access_token);
  localStorage.setItem('refresh_token', response.data.refresh_token);
  localStorage.setItem('role', response.data.role);
  localStorage.setItem('email', response.data.user.email);
  return response.data;
};

export const register = async (userData) => {
  const response = await api.post('/api/auth/register', userData);
  setToken(response.data.access_token);
  localStorage.setItem('refresh_token', response.data.refresh_token);
  localStorage.setItem('role', response.data.role);
  localStorage.setItem('email', response.data.user.email);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export const logout = async () => {
  try {
    const response = await api.post('/api/auth/logout');
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
  const response = await api.post('/api/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token, password) => {
  const response = await api.post('/api/auth/reset-password', { token, password });
  return response.data;
};

export const createJob = async (formData) => {
  const response = await api.post('/api/jobs', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getJobs = async () => {
  const response = await api.get('/api/jobs');
  return response.data;
};

export const getJob = async (jobId) => {
  const response = await api.get(`/api/jobs/${jobId}`);
  return response.data;
};

export const updateJob = async (jobId, updates) => {
  const response = await api.put(`/api/jobs/${jobId}`, updates);
  return response.data;
};

export const sendMessage = async (formData, jobId = null) => {
  const url = jobId ? `/api/jobs/${jobId}/messages` : '/api/messages';
  if (!jobId) {
    formData.append('recipient_id', '1'); // Assuming admin ID is 1; adjust as needed
  }
  const response = await api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const editMessage = async (messageId, content) => {
  const response = await api.put(`/api/messages/${messageId}`, { content });
  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await api.delete(`/api/messages/${messageId}`);
  return response.data;
};

export const getMessages = async (jobId = null) => {
  const url = jobId ? `/api/jobs/${jobId}/messages` : '/api/messages';
  const response = await api.get(url);
  return response.data;
};

export const getFile = async (filename) => {
  try {
    const normalizedFilename = filename.replace(/\\/g, '/');
    const response = await api.get(`/Uploads/${normalizedFilename}`, {
      responseType: 'blob',
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
        Accept: 'application/octet-stream',
      },
    });

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
    throw new Error(error.response?.data?.error || 'Failed to download file');
  }
};

export default api;