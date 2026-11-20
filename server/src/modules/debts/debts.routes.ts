import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { listDebtsQuerySchema, type ListDebtsQuery } from './debts.schemas.js';
import { toPublicDebt } from './debts.serializer.js';
import { listDebts } from './debts.service.js';

export const debtsRouter = Router();

debtsRouter.get('/', validateZod({ query: listDebtsQuerySchema }), async (req, res) => {
  const query = req.query as unknown as ListDebtsQuery;
  const debts = await listDebts(requireUserId(req), query.activeOnly);
  sendSuccess(res, 'Daftar utang berhasil dimuat.', { debts: debts.map(toPublicDebt) });
});
