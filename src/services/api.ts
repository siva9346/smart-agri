import { API_BASE_URL } from '../config';

// Module-level token — set once on login, cleared on logout.
// Survives component re-renders, cleared when the JS process restarts (app restart = new login required).
let _token: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

export function getAuthToken(): string | null {
  return _token;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: object): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch() itself throws (not an HTTP error response) on no connectivity, DNS
    // failure, or the request being aborted — there is no res.ok to check here.
    throw new ApiError(0, 'Network error. Please check your internet connection and try again.');
  }

  if (res.status === 204) return {} as T;

  const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`);
  }

  return data as T;
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET', path),
  post:   <T>(path: string, body: object)    => request<T>('POST', path, body),
  put:    <T>(path: string, body: object)    => request<T>('PUT', path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};
