import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '../Home/Home.jsx';
import MainPage from '../MainPage/MainPage.jsx';
import Auth from '../Auth/Auth.jsx';
import ClientDashboard from '../ClientDashboard/ClientDashboard.jsx';
import AdminDashboard from '../AdminDashboard/AdminDashboard.jsx';
import ForgotPassword from '../Auth/ForgotPassword.jsx';
import ResetPassword from '../Auth/ResetPassword.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

const Routing = () => {
  const { user, role, loading } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/main" element={<MainPage />} />

      {/* Auth Routes */}
      <Route
        path="/auth"
        element={user ? <Navigate to={`/${role}-dashboard`} /> : <Auth />}
      />
      <Route
        path="/forgot-password"
        element={user ? <Navigate to={`/${role}-dashboard`} /> : <ForgotPassword />}
      />
      <Route
        path="/reset-password"
        element={user ? <Navigate to={`/${role}-dashboard`} /> : <ResetPassword />}
      />

      {/* Protected Routes */}
      <Route
        path="/client-dashboard"
        element={
          user && role === 'client' ? (
            <ClientDashboard />
          ) : user ? (
            <Navigate to={`/${role}-dashboard`} />
          ) : (
            <Navigate to="/auth" />
          )
        }
      />
      <Route
        path="/admin-dashboard"
        element={
          user && role === 'admin' ? (
            <AdminDashboard />
          ) : user ? (
            <Navigate to={`/${role}-dashboard`} />
          ) : (
            <Navigate to="/auth" />
          )
        }
      />

      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default Routing;