import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import './config/zod.js';
import { corsOptions } from './config/cors.js';
import { isProduction } from './config/env.js';
import { authCookie } from './middlewares/authCookie.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { authRateLimiter } from './middlewares/rateLimiter.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { onboardingRouter } from './modules/onboarding/onboarding.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';

export function createApp(): Express {
  const app = express();

  // Required behind Render/Railway proxies so secure cookies and rate limiting use the real client IP.
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, message: 'UPgrade API berjalan dengan baik.', data: { status: 'ok' }, meta: {} });
  });

  app.use('/api/v1/auth', authRateLimiter, authRouter);
  app.use('/api/v1/onboarding', authCookie, onboardingRouter);
  app.use('/api/v1/accounts', authCookie, accountsRouter);
  app.use('/api/v1/categories', authCookie, categoriesRouter);
  app.use('/api/v1/transactions', authCookie, transactionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
