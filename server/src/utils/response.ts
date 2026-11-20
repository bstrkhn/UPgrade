import type { Response } from 'express';

export interface ApiEnvelope<T, M> {
  success: boolean;
  message: string;
  data: T;
  meta: M;
}

export function sendSuccess<T, M extends object = Record<string, never>>(
  res: Response,
  message: string,
  data: T,
  options: { status?: number; meta?: M } = {},
): Response {
  const body: ApiEnvelope<T, M | Record<string, never>> = {
    success: true,
    message,
    data,
    meta: options.meta ?? {},
  };
  return res.status(options.status ?? 200).json(body);
}
