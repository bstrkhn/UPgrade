import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import {
  createDebtSchema,
  debtIdParamSchema,
  listDebtsQuerySchema,
  simulateDebtsSchema,
  updateDebtSchema,
  type ListDebtsQuery,
} from './debts.schemas.js';
import { toPublicDebt } from './debts.serializer.js';
import { createDebt, deleteDebt, listDebts, simulateUserDebts, updateDebt } from './debts.service.js';

export const debtsRouter = Router();

debtsRouter.get('/', validateZod({ query: listDebtsQuerySchema }), async (req, res) => {
  const query = req.query as unknown as ListDebtsQuery;
  const debts = await listDebts(requireUserId(req), query.activeOnly);
  sendSuccess(res, 'Daftar utang berhasil dimuat.', { debts: debts.map(toPublicDebt) });
});

debtsRouter.post('/', validateZod({ body: createDebtSchema }), async (req, res) => {
  const debt = await createDebt(requireUserId(req), req.body);
  sendSuccess(res, `Utang "${debt.name}" berhasil ditambahkan.`, { debt: toPublicDebt(debt) }, { status: 201 });
});

debtsRouter.post('/simulate', validateZod({ body: simulateDebtsSchema }), async (req, res) => {
  const simulation = await simulateUserDebts(requireUserId(req), req.body);
  sendSuccess(res, 'Simulasi pelunasan utang berhasil dihitung.', simulation);
});

debtsRouter.patch(
  '/:id',
  validateZod({ params: debtIdParamSchema, body: updateDebtSchema }),
  async (req, res) => {
    const debt = await updateDebt(requireUserId(req), String(req.params.id), req.body);
    sendSuccess(res, `Utang "${debt.name}" berhasil diperbarui.`, { debt: toPublicDebt(debt) });
  },
);

debtsRouter.delete('/:id', validateZod({ params: debtIdParamSchema }), async (req, res) => {
  await deleteDebt(requireUserId(req), String(req.params.id));
  sendSuccess(res, 'Data utang berhasil dihapus.', null);
});
