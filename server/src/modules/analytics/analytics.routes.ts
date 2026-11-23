import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import {
  analyticsDashboardQuerySchema,
  createSnapshotBodySchema,
  fireSimulationBodySchema,
  type AnalyticsDashboardQuery,
  type CreateSnapshotBody,
  type FireSimulationBody,
} from './analytics.schemas.js';
import {
  getAnalyticsDashboard,
  listNetWorthSnapshots,
  simulateUserFire,
  upsertMonthlySnapshot,
} from './analytics.service.js';

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const analyticsRouter = Router();

analyticsRouter.get('/dashboard', validateZod({ query: analyticsDashboardQuerySchema }), async (req, res) => {
  const query = req.query as unknown as AnalyticsDashboardQuery;
  const data = await getAnalyticsDashboard(requireUserId(req), query);
  sendSuccess(res, 'Analitik dashboard berhasil dimuat.', data);
});

analyticsRouter.post('/fire/simulate', validateZod({ body: fireSimulationBodySchema }), async (req, res) => {
  const body = req.body as FireSimulationBody;
  const result = await simulateUserFire(requireUserId(req), body);
  sendSuccess(res, 'Simulasi proyeksi FIRE berhasil dihitung.', result);
});

analyticsRouter.get('/snapshots', async (req, res) => {
  const result = await listNetWorthSnapshots(requireUserId(req));
  sendSuccess(res, 'Riwayat snapshot neraca berhasil dimuat.', result);
});

analyticsRouter.post('/snapshot', validateZod({ body: createSnapshotBodySchema }), async (req, res) => {
  const body = req.body as CreateSnapshotBody;
  const result = await upsertMonthlySnapshot(requireUserId(req), body);
  const monthLabel = MONTH_NAMES_ID[result.period.month - 1] ?? String(result.period.month);
  sendSuccess(
    res,
    `Snapshot Neraca periode ${monthLabel} ${result.period.year} berhasil disimpan.`,
    result,
    { status: 201 },
  );
});
