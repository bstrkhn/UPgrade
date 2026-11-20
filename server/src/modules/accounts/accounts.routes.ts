import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { createAccountSchema, idParamSchema, updateAccountSchema } from './accounts.schemas.js';
import { createAccount, listAccounts, toPublicAccount, updateAccount } from './accounts.service.js';

export const accountsRouter = Router();

accountsRouter.get('/', async (req, res) => {
  const accounts = await listAccounts(requireUserId(req));
  sendSuccess(res, 'Daftar akun berhasil dimuat.', { accounts: accounts.map(toPublicAccount) });
});

accountsRouter.post('/', validateZod({ body: createAccountSchema }), async (req, res) => {
  const account = await createAccount(requireUserId(req), req.body);
  sendSuccess(res, `Akun "${account.name}" berhasil dibuat.`, { account: toPublicAccount(account) }, { status: 201 });
});

accountsRouter.patch(
  '/:id',
  validateZod({ params: idParamSchema, body: updateAccountSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    const account = await updateAccount(requireUserId(req), id, req.body);
    sendSuccess(res, `Akun "${account.name}" berhasil diperbarui.`, { account: toPublicAccount(account) });
  },
);
