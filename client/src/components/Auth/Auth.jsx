import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import AppleLogin from 'react-apple-login';
import { AuthContext } from '../context/AuthContext';
import './AuthShared.css';

const Auth = () => {
  const navigate = useNavigate();
  const { user, login, googleLogin, appleLogin, register } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const userRole = await login(email, password);
        navigate(`/${userRole}-dashboard`);
      } else {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const userRole = await register({ email, password });
        navigate(`/${userRole}-dashboard`);
      }
    } catch (err) {
      console.error('Auth Error:', err);
      setError(err.response?.data?.error || err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    try {
      setLoading(true);
      setError('');
      if (!response.credential) {
        throw new Error('No credential received from Google');
      }
      const userRole = await googleLogin(response.credential);
      navigate(`/${userRole}-dashboard`);
    } catch (err) {
      console.error('Google Login Error:', err);
      setError(err.message || 'Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error('Google Login Failed');
    setError('Google login failed. Please try again or use another method.');
    setLoading(false);
  };

  const handleAppleResponse = async (response) => {
    try {
      setLoading(true);
      setError('');
      if (response.authorization && response.authorization.id_token) {
        const userRole = await appleLogin(response.authorization.id_token);
        navigate(`/${userRole}-dashboard`);
      } else {
        throw new Error('No ID token received from Apple');
      }
    } catch (err) {
      console.error('Apple Login Error:', err);
      setError(err.response?.data?.error || err.message || 'Apple login failed');
    } finally {
      setLoading(false);
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
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <span
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </span>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-container">
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <span
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </span>
              </div>
            </div>
          )}

          {isLogin && (
            <div className="form-group">
              <Link to="/forgot-password" className="toggle-button">
                Forgot Password?
              </Link>
            </div>
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="social-login">
          <div className="social-divider">
            <span>Or continue with</span>
          </div>

          <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              theme="filled_blue"
              size="large"
              text="continue_with"
              shape="pill"
              width="300"
              auto_select
              disabled={loading}
            />
          </GoogleOAuthProvider>

          <AppleLogin
            clientId={import.meta.env.VITE_APPLE_CLIENT_ID}
            redirectURI={import.meta.env.VITE_APPLE_REDIRECT_URI}
            onSuccess={handleAppleResponse}
            onError={() => setError('Apple Login Failed')}
            render={({ onClick }) => (
              <button 
                onClick={onClick} 
                className="social-button apple-button"
                disabled={loading}
              >
                Sign in with Apple
              </button>
            )}
          />
        </div>

        <p className="toggle-auth">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setEmail('');
              setPassword('');
              setConfirmPassword('');
              setShowPassword(false);
            }}
            className="toggle-button"
            disabled={loading}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;