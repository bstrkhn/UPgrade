import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import {
  budgetPeriodParamsSchema,
  upsertBudgetsSchema,
  type BudgetPeriodParams,
  type UpsertBudgetsInput,
} from './budgets.schemas.js';
import { getBudgetOverview, upsertBudgets } from './budgets.service.js';

export const budgetsRouter = Router();

budgetsRouter.get('/:year/:month', validateZod({ params: budgetPeriodParamsSchema }), async (req, res) => {
  const params = req.params as unknown as BudgetPeriodParams;
  const overview = await getBudgetOverview(requireUserId(req), params);
  sendSuccess(res, 'Data anggaran bulanan berhasil dimuat.', overview);
});

budgetsRouter.put(
  '/:year/:month',
  validateZod({ params: budgetPeriodParamsSchema, body: upsertBudgetsSchema }),
  async (req, res) => {
    const params = req.params as unknown as BudgetPeriodParams;
    const body = req.body as UpsertBudgetsInput;
    const overview = await upsertBudgets(requireUserId(req), params, body);
    sendSuccess(res, 'Alokasi anggaran bulanan berhasil disimpan.', overview);
  },
);
