import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { dashboardSummaryQuerySchema, type DashboardSummaryQuery } from './dashboard.schemas.js';
import { getDashboardSummary } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', validateZod({ query: dashboardSummaryQuerySchema }), async (req, res) => {
  const query = req.query as unknown as DashboardSummaryQuery;
  const summary = await getDashboardSummary(requireUserId(req), query);
  sendSuccess(res, 'Ringkasan dashboard berhasil dimuat.', summary);
});
