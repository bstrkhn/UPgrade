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

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<ApiErrorEnvelope>;
      const status = axiosErr.response?.status ?? 0;
      const issues = axiosErr.response?.data?.meta?.errors ?? [];
      const message = extractApiErrorMessage(axiosErr);
      // Do NOT force window.location redirect on 401 — route guards handle unauthenticated state cleanly without reload loops.
      return Promise.reject(new ApiClientError(message, status, issues));
    }
    return Promise.reject(error);
  },
);
