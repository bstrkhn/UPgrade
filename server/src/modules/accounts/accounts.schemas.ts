import { z } from 'zod';
import { nonNegativeMoney } from '../../utils/money.js';

export const accountTypeSchema = z.enum(['CASH', 'BANK', 'EWALLET', 'INVESTMENT', 'EMERGENCY_FUND'], {
  error: 'Jenis akun harus CASH, BANK, EWALLET, INVESTMENT, atau EMERGENCY_FUND.',
});

const accountNameSchema = z
  .string({ error: 'Nama akun wajib diisi.' })
  .trim()
  .min(1, 'Nama akun wajib diisi.')
  .max(80, 'Nama akun maksimal 80 karakter.');

export const createAccountSchema = z.object({
  name: accountNameSchema,
  type: accountTypeSchema,
  balance: nonNegativeMoney.default(() => nonNegativeMoney.parse('0')),
  isLiquid: z.boolean({ error: 'isLiquid harus berupa true atau false.' }).optional(),
});

export const updateAccountSchema = z
  .object({
    name: accountNameSchema.optional(),
    type: accountTypeSchema.optional(),
    isLiquid: z.boolean({ error: 'isLiquid harus berupa true atau false.' }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Minimal satu data akun harus diubah.',
  });

export const idParamSchema = z.object({
  id: z.string({ error: 'ID wajib diisi.' }).uuid('ID tidak valid.'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
