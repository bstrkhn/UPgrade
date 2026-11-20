import { rateLimit } from 'express-rate-limit';

/** 10 requests / 15 minutes / IP on /api/v1/auth/* */
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
