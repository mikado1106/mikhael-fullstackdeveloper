import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { UNAUTHORIZED_EVENT, readStoredAuth, writeStoredAuth } from '../lib/api';
import type { LoginRequest, RegisterRequest, User } from '../types/api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(() => readStoredAuth()?.user ?? null);

  const logout = useCallback(() => {
    writeStoredAuth(null);
    setUser(null);
    // Drop cached data so the next user never sees the previous user's pages.
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [logout]);

  const login = useCallback(async (dto: LoginRequest) => {
    const auth = await authApi.login(dto);
    writeStoredAuth(auth);
    setUser(auth.user);
    return auth.user;
  }, []);

  const register = useCallback(async (dto: RegisterRequest) => {
    const auth = await authApi.register(dto);
    writeStoredAuth(auth);
    setUser(auth.user);
    return auth.user;
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
