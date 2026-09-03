import type { ApiErrorBody, AuthResponse } from '../types/api';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const STORAGE_KEY = 'indokerja.auth';

/** Fired when the API rejects our token so the auth context can log the user out. */
export const UNAUTHORIZED_EVENT = 'indokerja:unauthorized';

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join('. '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

export function readStoredAuth(): AuthResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthResponse) : null;
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth: AuthResponse | null): void {
  try {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}

type QueryValue = string | number | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function extractMessages(payload: unknown, status: number): string[] {
  const body = payload as Partial<ApiErrorBody> | null;
  if (body && body.message) {
    return Array.isArray(body.message) ? body.message : [body.message];
  }
  return [`Request failed with status ${status}`];
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readStoredAuth()?.accessToken;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    // Only a 401 on a request that carried a token means the session died;
    // a wrong password must not log the user out.
    if (response.status === 401 && token) {
      writeStoredAuth(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(response.status, extractMessages(payload, response.status));
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.messages.join('. ');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
