import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import './config/zod.js';
import { corsOptions } from './config/cors.js';
import { isProduction } from './config/env.js';
import { prisma } from './config/prisma.js';
import { authCookie } from './middlewares/authCookie.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { budgetsRouter } from './modules/budgets/budgets.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { debtsRouter } from './modules/debts/debts.routes.js';
import { onboardingRouter } from './modules/onboarding/onboarding.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
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

  // Lightweight liveness probe (no database query, excluded from apiRateLimiter)
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      success: true,
      message: 'UPgrade API berjalan dengan baik.',
      data: { status: 'ok' },
      meta: {},
    });
  });

  // Database readiness probe for production health checks (Neon / Supabase)
  app.get('/api/v1/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        success: true,
        message: 'Database UPgrade terhubung dan siap melayani permintaan.',
        data: { status: 'ready', database: 'connected' },
        meta: {},
      });
    } catch {
      res.status(503).json({
        success: false,
        message: 'Layanan belum siap: koneksi database sedang bermasalah.',
        data: { status: 'unavailable', database: 'disconnected' },
        meta: {},
      });
    }
  });

  app.use('/api/v1', apiRateLimiter);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/onboarding', authCookie, onboardingRouter);
  app.use('/api/v1/accounts', authCookie, accountsRouter);
  app.use('/api/v1/categories', authCookie, categoriesRouter);
  app.use('/api/v1/transactions', authCookie, transactionsRouter);
  app.use('/api/v1/debts', authCookie, debtsRouter);
  app.use('/api/v1/dashboard', authCookie, dashboardRouter);
  app.use('/api/v1/budgets', authCookie, budgetsRouter);
  app.use('/api/v1/analytics', authCookie, analyticsRouter);
  app.use('/api/v1/reports', authCookie, reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
