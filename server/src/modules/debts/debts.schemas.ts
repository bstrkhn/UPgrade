import { z } from 'zod';
import { nonNegativeMoney, percentageRate, positiveMoney } from '../../utils/money.js';

/** Explicit enum parsing: z.coerce.boolean() would turn the string "false" into true. */
export const listDebtsQuerySchema = z.object({
  activeOnly: z
    .enum(['true', 'false'], { error: 'activeOnly harus berupa true atau false.' })
    .transform((value) => value === 'true')
    .optional(),
});

const debtNameSchema = z
  .string({ error: 'Nama utang wajib diisi.' })
  .trim()
  .min(1, 'Nama utang wajib diisi.')
  .max(80, 'Nama utang maksimal 80 karakter.');

const interestTypeSchema = z.enum(['FLAT', 'EFFECTIVE'], {
  error: 'Jenis bunga harus FLAT atau EFFECTIVE.',
});

const dueDateDaySchema = z
  .number({ error: 'Tanggal jatuh tempo harus berupa angka.' })
  .int('Tanggal jatuh tempo harus bilangan bulat.')
  .min(1, 'Tanggal jatuh tempo minimal 1.')
  .max(31, 'Tanggal jatuh tempo maksimal 31.')
  .nullable()
  .optional();

export const createDebtSchema = z
  .object({
    name: debtNameSchema,
    isConsumptive: z.boolean({ error: 'isConsumptive harus berupa true atau false.' }).default(true),
    totalPrincipal: positiveMoney,
    remainingBalance: nonNegativeMoney.optional(),
    annualInterestPct: percentageRate.default(() => percentageRate.parse('0')),
    interestType: interestTypeSchema.default('FLAT'),
    minimumMonthlyPay: nonNegativeMoney,
    dueDateDay: dueDateDaySchema,
  })
  .refine((debt) => debt.remainingBalance === undefined || debt.remainingBalance.lte(debt.totalPrincipal), {
    message: 'Sisa utang tidak boleh melebihi total pokok utang.',
    path: ['remainingBalance'],
  });

export const updateDebtSchema = z
  .object({
    name: debtNameSchema.optional(),
    isConsumptive: z.boolean({ error: 'isConsumptive harus berupa true atau false.' }).optional(),
    totalPrincipal: positiveMoney.optional(),
    remainingBalance: nonNegativeMoney.optional(),
    annualInterestPct: percentageRate.optional(),
    interestType: interestTypeSchema.optional(),
    minimumMonthlyPay: nonNegativeMoney.optional(),
    dueDateDay: dueDateDaySchema,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Minimal satu data utang harus diubah.',
  });

export const debtIdParamSchema = z.object({
  id: z.string({ error: 'ID utang wajib diisi.' }).uuid('ID utang tidak valid.'),
});

export const simulateDebtsSchema = z.object({
  extraMonthlyPayment: nonNegativeMoney.default(() => nonNegativeMoney.parse('0')),
});

export type ListDebtsQuery = z.infer<typeof listDebtsQuerySchema>;
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type SimulateDebtsInput = z.infer<typeof simulateDebtsSchema>;
