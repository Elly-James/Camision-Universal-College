import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import AppleLogin from 'react-apple-login';
import { AuthContext } from '../context/AuthContext';

const Auth = () => {
  const navigate = useNavigate();
  const { login, googleLogin, appleLogin, register } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const userRole = await login(email, password, role);
        navigate(`/${userRole}-dashboard`);
      } else {
        const userRole = await register(email, username, password);
        navigate(`/${userRole}-dashboard`);
      }
    } catch (err) {
      setError(err);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const userRole = await googleLogin(credentialResponse.code);
      navigate(`/${userRole}-dashboard`);
    } catch (err) {
      setError(err);
    }
  };

  const handleAppleResponse = async (response) => {
    if (response.authorization && response.authorization.id_token) {
      try {
        const userRole = await appleLogin(response.authorization.id_token);
        navigate(`/${userRole}-dashboard`);
      } catch (err) {
        setError(err);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="password">Password</label>
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
            <label htmlFor="role">Role</label>
            <select
              id="role"
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="auth-button">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        <div className="social-login">
          <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login Failed')}
              useOneTap
              flow="auth-code"
            />
          </GoogleOAuthProvider>
          <AppleLogin
            clientId={import.meta.env.VITE_APPLE_CLIENT_ID}
            redirectURI={import.meta.env.VITE_APPLE_REDIRECT_URI}
            onSuccess={handleAppleResponse}
            onError={() => setError('Apple Login Failed')}
            render={({ onClick }) => (
              <button onClick={onClick} className="social-button apple-button">
                Sign in with Apple
              </button>
            )}
          />
        </div>
        <p>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="toggle-button"
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;