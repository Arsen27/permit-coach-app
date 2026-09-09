import { useAuth } from '@admin/store/authStore';

// Thin fetch wrapper for /v1/admin. In development Vite proxies these to the
// content server; in production the panel is served from the same origin.
// The Bearer is whatever the auth store holds — a Supabase session or the
// shared admin token; a 401 sends the operator back to the login screen.

export class ApiError extends Error {
  // Validator refusals ride along: the server's 400s carry an `errors` list
  // (one entry per structural problem) next to the summary message.
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const tokenKey = 'permitcoach.adminToken';

export const adminToken = {
  get: (): string => localStorage.getItem(tokenKey) ?? '',
  set: (value: string): void => {
    if (value.length > 0) {
      localStorage.setItem(tokenKey, value);
    } else {
      localStorage.removeItem(tokenKey);
    }
  },
};

// Shared failure handling: 401 logs out, anything else becomes an ApiError
// carrying the server's validator errors when it sent any.
const handleFailure = async (response: Response): Promise<never> => {
  if (response.status === 401) {
    // The session is gone or the account lost its allowlisting.
    useAuth.getState().logout();
  }
  const payload = await response
    .json()
    .then(
      (value: { error?: string; detail?: string; errors?: string[] }) => value,
    )
    .catch(() => null);
  throw new ApiError(
    response.status,
    payload?.detail ?? payload?.error ?? response.statusText,
    Array.isArray(payload?.errors) ? payload.errors : undefined,
  );
};

// Multipart upload. No Content-Type header: the browser must set the
// multipart boundary itself.
const upload = async <T>(path: string, file: File): Promise<T> => {
  const token = await useAuth.getState().bearer();
  const form = new FormData();
  form.set('file', file);
  const response = await fetch(`/v1/admin${path}`, {
    method: 'POST',
    headers: token.length > 0 ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    return handleFailure(response);
  }
  return (await response.json()) as T;
};

const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> => {
  const token = await useAuth.getState().bearer();
  const response = await fetch(`/v1/admin${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token.length > 0 ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    return handleFailure(response);
  }

  return (await response.json()) as T;
};

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload,
};
