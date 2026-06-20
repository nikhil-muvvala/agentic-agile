import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

// if we want to use create context then create another function where it uses createcontext variable inside it 

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchCurrentUser();
    } else {
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  }, [token]); 


   useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }, [refreshToken]);

  // Sync session across multiple tabs
  useEffect(() => {
    const syncAcrossTabs = (e) => {
      if (e.key === 'token') {
        // If the token changes in another tab, instantly reload this tab to sync the session!
        window.location.reload();
      }
    };
    window.addEventListener('storage', syncAcrossTabs);
    return () => window.removeEventListener('storage', syncAcrossTabs);
  }, []);


  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/current-user');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };



  const loginWithGoogle = async (credential) => {
    const response = await api.post('/auth/google', { credential });
    setToken(response.data.accessToken);
    if (response.data.refreshToken) {
      setRefreshToken(response.data.refreshToken);
    }
    return response.data;
  };



  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setToken(null);
      setRefreshToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, loginWithGoogle, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
