import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../data/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('smc-token');
    if (savedToken) {
      api.setToken(savedToken);
      setTokenState(savedToken);
      api.getMe()
        .then((res) => {
          setUser(res.data || res.user || res);
        })
        .catch(() => {
          api.setToken(null);
          setTokenState(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginFn = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    const t = res.token || res.data?.token;
    if (t) {
      api.setToken(t);
      setTokenState(t);
    }
    const u = res.user || res.data?.user || res.data;
    if (u) setUser(u);
    return res;
  }, []);

  const logoutFn = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore logout errors
    }
    api.setToken(null);
    setTokenState(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const registerFn = useCallback(async (data) => {
    return api.register(data);
  }, []);

  const updateUserFn = useCallback((data) => {
    setUser((prev) => ({ ...prev, ...data }));
  }, []);

  const value = {
    user,
    token,
    loading,
    login: loginFn,
    logout: logoutFn,
    register: registerFn,
    updateUser: updateUserFn,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
