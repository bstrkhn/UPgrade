import type { Request } from 'express';
import { AppError } from './AppError.js';

export interface AuthUser {
  id: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Returns the authenticated user id or throws 401. Every query must be scoped by this id (IDOR prevention). */
export function requireUserId(req: Request): string {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user.id;
}
