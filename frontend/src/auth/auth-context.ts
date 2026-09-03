import { createContext, useContext } from 'react';
import type { LoginRequest, RegisterRequest, User } from '../types/api';

export interface AuthContextValue {
  user: User | null;
  login: (dto: LoginRequest) => Promise<User>;
  register: (dto: RegisterRequest) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
