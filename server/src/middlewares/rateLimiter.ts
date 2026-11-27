import { rateLimit } from 'express-rate-limit';

/** 10 requests / 15 minutes / IP strictly on /api/v1/auth/login and /api/v1/auth/register */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.',
      data: null,
      meta: {},
    });
  },
});

/** 180 requests / 1 minute / IP across /api/v1 (excluding /api/v1/health* probes) */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/health') || req.originalUrl.startsWith('/api/v1/health'),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Terlalu banyak permintaan ke server. Silakan tunggu sebentar dan coba lagi.',
      data: null,
      meta: {},
    });
  },
});

/** 15 requests / 15 minutes / IP on CPU-intensive PDF generation endpoint (/api/v1/reports/monthly-pdf) */
export const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Batas pembuatan laporan PDF tercapai. Silakan coba lagi dalam 15 menit.',
      data: null,
      meta: {},
    });
  },
});
