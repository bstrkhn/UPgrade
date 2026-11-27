import axios, { AxiosError } from 'axios';
import type { ApiErrorEnvelope, ApiErrorIssue } from './types';

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly issues: ApiErrorIssue[];

  constructor(message: string, statusCode: number, issues: ApiErrorIssue[] = []) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.issues = issues;
  }
}

/** Extracts a user-facing Bahasa Indonesia message from any error object. */
export function extractApiErrorMessage(
  error: unknown,
  fallback = 'Terjadi kesalahan jaringan. Periksa koneksi internet Anda.',
): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiErrorEnvelope>;
    const serverMessage = axiosErr.response?.data?.message;
    const firstIssue = axiosErr.response?.data?.meta?.errors?.[0]?.message;
    if (typeof firstIssue === 'string' && firstIssue.length > 0) {
      return firstIssue;
    }
    if (typeof serverMessage === 'string' && serverMessage.length > 0) {
      return serverMessage;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}

let unauthorizedHandler: (() => void) | null = null;

/**
 * Registers a callback invoked when a protected endpoint returns 401 Unauthorized,
 * allowing TanStack Query to clear the cached user session and trigger route-guard redirection.
 */
export function registerUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

const AUTH_EXEMPT_401_PATHS = ['/auth/login', '/auth/register', '/auth/me'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<ApiErrorEnvelope | Blob>;
      const status = axiosErr.response?.status ?? 0;
      const requestUrl = axiosErr.config?.url ?? '';
      if (status === 401 && !AUTH_EXEMPT_401_PATHS.some((exempt) => requestUrl.endsWith(exempt))) {
        unauthorizedHandler?.();
      }

      const rawData = axiosErr.response?.data;
      if (typeof Blob !== 'undefined' && rawData instanceof Blob) {
        try {
          const text = await rawData.text();
          const parsed = JSON.parse(text) as ApiErrorEnvelope;
          const issues = parsed?.meta?.errors ?? [];
          const firstIssue = issues[0]?.message;
          const message =
            (typeof firstIssue === 'string' && firstIssue.length > 0 ? firstIssue : parsed?.message) ||
            'Terjadi kesalahan saat memproses dokumen dari server.';
          return Promise.reject(new ApiClientError(message, status, issues));
        } catch {
          // Fall back to standard message extraction if the Blob is not JSON
        }
      }

      const envelope = rawData && !(rawData instanceof Blob) ? rawData : undefined;
      const issues = envelope?.meta?.errors ?? [];
      const message = extractApiErrorMessage(axiosErr);
      return Promise.reject(new ApiClientError(message, status, issues));
    }
    return Promise.reject(error);
  },
);
