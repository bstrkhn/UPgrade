import { z } from 'zod';
import { accountTypeSchema } from '../accounts/accounts.schemas.js';
import { budgetFrameworkSchema } from '../auth/auth.schemas.js';
import { nonNegativeMoney, percentageRate, positiveMoney } from '../../utils/money.js';

export const initialAccountSchema = z.object({
  name: z
    .string({ error: 'Nama akun wajib diisi.' })
    .trim()
    .min(1, 'Nama akun wajib diisi.')
    .max(80, 'Nama akun maksimal 80 karakter.'),
  type: accountTypeSchema,
  balance: nonNegativeMoney,
  isLiquid: z.boolean({ error: 'isLiquid harus berupa true atau false.' }).optional(),
});

export const initialDebtSchema = z
  .object({
    name: z
      .string({ error: 'Nama utang wajib diisi.' })
      .trim()
      .min(1, 'Nama utang wajib diisi.')
      .max(80, 'Nama utang maksimal 80 karakter.'),
    isConsumptive: z.boolean({ error: 'isConsumptive harus berupa true atau false.' }).default(true),
    totalPrincipal: positiveMoney,
    remainingBalance: nonNegativeMoney.optional(),
    annualInterestPct: percentageRate.default(() => percentageRate.parse('0')),
    interestType: z.enum(['FLAT', 'EFFECTIVE'], { error: 'Jenis bunga harus FLAT atau EFFECTIVE.' }).default('FLAT'),
    minimumMonthlyPay: nonNegativeMoney,
    dueDateDay: z
      .number({ error: 'Tanggal jatuh tempo harus berupa angka.' })
      .int('Tanggal jatuh tempo harus bilangan bulat.')
      .min(1, 'Tanggal jatuh tempo minimal 1.')
      .max(31, 'Tanggal jatuh tempo maksimal 31.')
      .optional(),
  })
  .refine((debt) => debt.remainingBalance === undefined || debt.remainingBalance.lte(debt.totalPrincipal), {
    message: 'Sisa utang tidak boleh melebihi total pokok utang.',
    path: ['remainingBalance'],
  });

export const onboardingSchema = z.object({
  baselineEssential: nonNegativeMoney,
  budgetFramework: budgetFrameworkSchema.default('ZERO_BASED'),
  accounts: z
    .array(initialAccountSchema, { error: 'Daftar akun awal wajib diisi.' })
    .min(1, 'Tambahkan minimal satu akun (misalnya Dompet Tunai atau Rekening Bank).')
    .max(20, 'Maksimal 20 akun awal.'),
  debts: z.array(initialDebtSchema).max(20, 'Maksimal 20 utang awal.').default([]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type InitialDebtInput = z.infer<typeof initialDebtSchema>;
