import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import '../styles/Login.css';

const Login = () => {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithGoogle } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-panel login-panel">
        
        <h2 className="text-gradient login-title">Agentic Agile</h2>
        <p className="login-subtitle">Welcome back. Sign in to your workspace.</p>
        
        {error && <div className="login-error">{error}</div>}
        
        {isSubmitting ? (
          <div className="login-loading">
            <div className="spinner"></div>
            <p className="login-loading-text">Authenticating securely...</p>
          </div>
        ) : (
          <div className="google-btn-wrapper">
            <GoogleLogin 
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login Failed')}
              theme="filled_black"
              shape="rectangular"
              text="continue_with"
              width="320"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
