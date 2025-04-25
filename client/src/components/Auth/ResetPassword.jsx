import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import './ResetPassword.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const token = query.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await api.post('/auth/reset-password', { token, password });
      setMessage(response.data.message);
      setTimeout(() => navigate('/auth'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>Error</h2>
          <p className="error-message">Invalid or missing reset token.</p>
          <button onClick={() => navigate('/auth')} className="auth-button">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Reset Password</h2>
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-button">
            Reset Password
          </button>
        </form>
        <p>
          <button onClick={() => navigate('/auth')} className="toggle-button">
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;