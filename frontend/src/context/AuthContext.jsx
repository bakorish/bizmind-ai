import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('bizmind_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('bizmind_token'));

  useEffect(() => {
    const token = localStorage.getItem('bizmind_token');
    if (!token) return;
    client.get('/auth/me')
      .then(({ data }) => { setUser(data.user); setBusiness(data.business); localStorage.setItem('bizmind_user', JSON.stringify(data.user)); })
      .catch(() => { localStorage.clear(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    localStorage.setItem('bizmind_token', data.token);
    localStorage.setItem('bizmind_user', JSON.stringify(data.user));
    setUser(data.user); setBusiness(data.business);
    return data;
  };

  const register = async (payload) => {
    const { data } = await client.post('/auth/register', payload);
    localStorage.setItem('bizmind_token', data.token);
    localStorage.setItem('bizmind_user', JSON.stringify(data.user));
    setUser(data.user); setBusiness(data.business);
    return data;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null); setBusiness(null);
    location.href = '/login';
  };

  const can = (permission) => {
    const matrix = {
      owner: ['products', 'inventory', 'orders', 'customers', 'finance', 'analytics', 'ai', 'users', 'settings'],
      manager: ['products', 'inventory', 'orders', 'customers', 'analytics', 'ai'],
      staff: ['orders', 'customers', 'products', 'inventory'],
      admin: ['products', 'inventory', 'orders', 'customers', 'finance', 'analytics', 'ai', 'users', 'settings'],
    };
    return (matrix[user?.role] || []).includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, business, setBusiness, loading, login, register, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
