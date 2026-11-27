import { Router } from 'express';
import { reportRateLimiter } from '../../middlewares/rateLimiter.js';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { monthlyReportQuerySchema, type MonthlyReportQuery } from './reports.schemas.js';
import { buildMonthlyReportPdf } from './reports.service.js';

export const reportsRouter = Router();

reportsRouter.get(
  '/monthly-pdf',
  reportRateLimiter,
  validateZod({ query: monthlyReportQuerySchema }),
  async (req, res) => {
    const query = req.query as unknown as MonthlyReportQuery;
    const { buffer, filename } = await buildMonthlyReportPdf(requireUserId(req), query);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buffer);
  },
);
