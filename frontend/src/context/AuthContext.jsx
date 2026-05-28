import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      fetchCurrentUser();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setLoading(false);
    }
  }, [token, refreshToken]);

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

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    setToken(response.data.accessToken);
    if (response.data.refreshToken) {
      setRefreshToken(response.data.refreshToken);
    }
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
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
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
