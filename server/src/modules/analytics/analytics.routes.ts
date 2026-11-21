import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { analyticsDashboardQuerySchema, type AnalyticsDashboardQuery } from './analytics.schemas.js';
import { getAnalyticsDashboard } from './analytics.service.js';

export const analyticsRouter = Router();

analyticsRouter.get('/dashboard', validateZod({ query: analyticsDashboardQuerySchema }), async (req, res) => {
  const query = req.query as unknown as AnalyticsDashboardQuery;
  const data = await getAnalyticsDashboard(requireUserId(req), query);
  sendSuccess(res, 'Analitik dashboard berhasil dimuat.', data);
});
