import React, { createContext, useState, useEffect } from 'react';
import api from '../../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');

    if (token && storedRole) {
      setRole(storedRole);
      fetchUser(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (token) => {
    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data.user);
      setRole(response.data.role);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('email');
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, role) => {
    try {
      // Mock login for testing
      const mockResponse = {
        access_token: 'mock-token',
        role: role,
        user: {
          id: 1,
          email: email,
          username: email.split('@')[0],
          name: 'Mock User',
        },
      };
      localStorage.setItem('token', mockResponse.access_token);
      localStorage.setItem('role', mockResponse.role);
      localStorage.setItem('email', mockResponse.user.email);
      setUser(mockResponse.user);
      setRole(mockResponse.role);
      return mockResponse.role;

      // Original API logic
      /*
      const response = await api.post('/auth/login', { email, password, role });
      const { access_token, role: userRole, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);
      setUser(user);
      setRole(userRole);
      return userRole;
      */
    } catch (error) {
      throw error.response?.data?.error || 'Login failed';
    }
  };

  const googleLogin = async (code) => {
    try {
      // Mock Google login
      const mockResponse = {
        access_token: 'mock-google-token',
        role: 'client',
        user: {
          id: 2,
          email: 'googleuser@example.com',
          username: 'googleuser',
          name: 'Google User',
        },
      };
      localStorage.setItem('token', mockResponse.access_token);
      localStorage.setItem('role', mockResponse.role);
      localStorage.setItem('email', mockResponse.user.email);
      setUser(mockResponse.user);
      setRole(mockResponse.role);
      return mockResponse.role;

      // Original API logic
      /*
      const response = await api.post('/auth/google', { code });
      const { access_token, role: userRole, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);
      setUser(user);
      setRole(userRole);
      return userRole;
      */
    } catch (error) {
      throw error.response?.data?.error || 'Google login failed';
    }
  };

  const appleLogin = async (id_token) => {
    try {
      // Mock Apple login
      const mockResponse = {
        access_token: 'mock-apple-token',
        role: 'client',
        user: {
          id: 3,
          email: 'appleuser@example.com',
          username: 'appleuser',
          name: 'Apple User',
        },
      };
      localStorage.setItem('token', mockResponse.access_token);
      localStorage.setItem('role', mockResponse.role);
      localStorage.setItem('email', mockResponse.user.email);
      setUser(mockResponse.user);
      setRole(mockResponse.role);
      return mockResponse.role;

      // Original API logic
      /*
      const response = await api.post('/auth/apple', { id_token });
      const { access_token, role: userRole, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);
      setUser(user);
      setRole(userRole);
      return userRole;
      */
    } catch (error) {
      throw error.response?.data?.error || 'Apple login failed';
    }
  };

  const register = async (email, username, password) => {
    try {
      // Mock registration
      const mockResponse = {
        access_token: 'mock-token',
        role: 'client',
        user: {
          id: 4,
          email,
          username,
          name: username,
        },
      };
      localStorage.setItem('token', mockResponse.access_token);
      localStorage.setItem('role', mockResponse.role);
      localStorage.setItem('email', mockResponse.user.email);
      setUser(mockResponse.user);
      setRole(mockResponse.role);
      return mockResponse.role;

      // Original API logic
      /*
      const response = await api.post('/auth/register', {
        email,
        username,
        password,
      });
      const { access_token, role: userRole, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);
      setUser(user);
      setRole(userRole);
      return userRole;
      */
    } catch (error) {
      throw error.response?.data?.error || 'Registration failed';
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        login,
        googleLogin,
        appleLogin,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};