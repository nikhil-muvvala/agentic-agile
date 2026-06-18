import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

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
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <h2 className="text-gradient" style={{ textAlign: 'center', marginBottom: '1rem' }}>Agentic Agile</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-secondary)' }}>Sign in to manage your projects</p>
        
        {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
        
        {isSubmitting ? (
          <div style={{ padding: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Authenticating...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <GoogleLogin 
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login Failed')}
              theme="filled_black"
              shape="rectangular"
              text="continue_with"
              width="300"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
