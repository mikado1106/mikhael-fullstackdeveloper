import { apiRequest } from '../lib/api';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/api';

export function login(dto: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: dto });
}

export function register(dto: RegisterRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: dto });
}
