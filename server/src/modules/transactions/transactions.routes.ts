import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionIdParamSchema,
  type ListTransactionsQuery,
} from './transactions.schemas.js';
import {
  createTransaction,
  listTransactions,
  restoreTransaction,
  softDeleteTransaction,
} from './transactions.service.js';

export const transactionsRouter = Router();

transactionsRouter.get('/', validateZod({ query: listTransactionsQuerySchema }), async (req, res) => {
  const result = await listTransactions(requireUserId(req), req.query as unknown as ListTransactionsQuery);
  sendSuccess(res, 'Riwayat transaksi berhasil dimuat.', { transactions: result.transactions }, { meta: result.meta });
});

transactionsRouter.post('/', validateZod({ body: createTransactionSchema }), async (req, res) => {
  const result = await createTransaction(requireUserId(req), req.body);
  sendSuccess(
    res,
    'Transaksi berhasil disimpan.',
    { transaction: result.transaction, accounts: result.accounts, debt: result.debt },
    { status: 201, meta: { warnings: result.warnings } },
  );
});

transactionsRouter.delete('/:id', validateZod({ params: transactionIdParamSchema }), async (req, res) => {
  const result = await softDeleteTransaction(requireUserId(req), String(req.params.id));
  sendSuccess(
    res,
    'Transaksi dihapus. Saldo dikembalikan, kamu bisa mengurungkannya.',
    { transaction: result.transaction, accounts: result.accounts, debt: result.debt },
    { meta: { warnings: result.warnings } },
  );
});

transactionsRouter.post('/:id/restore', validateZod({ params: transactionIdParamSchema }), async (req, res) => {
  const result = await restoreTransaction(requireUserId(req), String(req.params.id));
  sendSuccess(
    res,
    'Transaksi berhasil dipulihkan.',
    { transaction: result.transaction, accounts: result.accounts, debt: result.debt },
    { meta: { warnings: result.warnings } },
  );
});
