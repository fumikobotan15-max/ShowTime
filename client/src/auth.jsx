import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('st_token')) return setReady(true);
    api('/auth/me').then(setUser).catch(() => localStorage.removeItem('st_token')).finally(() => setReady(true));
  }, []);
  const save = ({ token, user }) => { localStorage.setItem('st_token', token); setUser(user); return user; };
  const login = async (email, password) => save(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async b => save(await api('/auth/register', { method: 'POST', body: b }));
  const completeOAuth = async code => {
    const result = await api('/auth/oauth/exchange', { method: 'POST', body: { code } });
    save(result);
    return result;
  };
  const updateUser = updates => setUser(current => current ? { ...current, ...updates } : current);
  const logout = () => { localStorage.removeItem('st_token'); setUser(null); };
  return <Ctx.Provider value={{ user, ready, login, register, completeOAuth, updateUser, logout }}>{children}</Ctx.Provider>;
}
