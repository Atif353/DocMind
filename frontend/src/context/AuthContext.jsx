import React, { createContext, useState, useEffect } from 'react';
import api, { setAuthToken } from '../lib/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const setToken = (nextToken) => {
    setAuthToken(nextToken);
    if (nextToken) {
      localStorage.setItem('token', nextToken);
    } else {
      localStorage.removeItem('token');
    }
    setTokenState(nextToken || '');
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const handleExpired = () => logout();
    window.addEventListener('docmind:auth-expired', handleExpired);
    return () => window.removeEventListener('docmind:auth-expired', handleExpired);
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, setToken, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

