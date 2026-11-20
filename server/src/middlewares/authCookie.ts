import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const AUTH_COOKIE_NAME = 'upgrade_token';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** HttpOnly cookie. SameSite=Lax locally, SameSite=None; Secure in cross-domain production. */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}

export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: `${env.JWT_EXPIRES_IN_DAYS}d`,
  });
}

export function setAuthCookie(res: Response, userId: string): void {
  res.cookie(AUTH_COOKIE_NAME, signAuthToken(userId), {
    ...baseCookieOptions(),
    maxAge: env.JWT_EXPIRES_IN_DAYS * ONE_DAY_MS,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions());
}

export function authCookie(req: Request, _res: Response, next: NextFunction): void {
  const token: unknown = req.cookies?.[AUTH_COOKIE_NAME];

  if (typeof token !== 'string' || token.length === 0) {
    throw AppError.unauthorized('Silakan masuk terlebih dahulu.');
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw AppError.unauthorized();
    }
    req.user = { id: payload.sub };
    next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unauthorized('Sesi berakhir. Silakan masuk kembali.');
  }
}
