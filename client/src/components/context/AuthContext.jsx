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
      const response = await api.get('/auth/me');
      setUser(response.data.user);
      setRole(response.data.role);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('role');
      localStorage.removeItem('email');
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, refresh_token, role: userRole, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);

      setUser(user);
      setRole(userRole);
      return userRole;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed. Please check your credentials.');
    }
  };

  const googleLogin = async (credential) => {
    try {
      const response = await api.post('/auth/google', { credential });
      const { access_token, refresh_token, role: userRole, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);

      setUser(user);
      setRole(userRole);
      return userRole;
    } catch (error) {
      console.error('Google login error:', error);
      throw new Error(error.response?.data?.error || 'Google login failed. Please try again.');
    }
  };

  const appleLogin = async (id_token) => {
    try {
      const response = await api.post('/auth/apple', { id_token });
      const { access_token, refresh_token, role: userRole, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);

      setUser(user);
      setRole(userRole);
      return userRole;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Apple login failed. Please try again.');
    }
  };

  const register = async ({ email, password }) => {
    try {
      const response = await api.post('/auth/register', { email, password });
      const { access_token, refresh_token, role: userRole, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('role', userRole);
      localStorage.setItem('email', user.email);

      setUser(user);
      setRole(userRole);
      return userRole;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Registration failed. Please try again.');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
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

export default AuthProvider;