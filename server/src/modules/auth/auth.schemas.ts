import { z } from 'zod';
import { nonNegativeMoney, percentageRate } from '../../utils/money.js';

const passwordSchema = z
  .string({ error: 'Kata sandi wajib diisi.' })
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.')
  .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
  .regex(/\d/, 'Kata sandi harus mengandung angka.');

const emailSchema = z
  .string({ error: 'Email wajib diisi.' })
  .trim()
  .toLowerCase()
  .email('Format email tidak valid.')
  .max(254, 'Email terlalu panjang.');

const nameSchema = z
  .string({ error: 'Nama wajib diisi.' })
  .trim()
  .min(1, 'Nama wajib diisi.')
  .max(100, 'Nama maksimal 100 karakter.');

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Kata sandi wajib diisi.' }).min(1, 'Kata sandi wajib diisi.'),
});

export const budgetFrameworkSchema = z.enum(['ZERO_BASED', 'RULE_50_30_20'], {
  error: 'Kerangka anggaran harus ZERO_BASED atau RULE_50_30_20.',
});

const positiveRate = percentageRate.refine((value) => value.gt(0), 'Persentase harus lebih besar dari 0.');

export const updatePreferencesSchema = z
  .object({
    name: nameSchema.optional(),
    budgetFramework: budgetFrameworkSchema.optional(),
    swrRate: positiveRate.optional(),
    inflationRate: percentageRate.optional(),
    expectedReturnRate: percentageRate.optional(),
    baselineEssential: nonNegativeMoney.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Minimal satu pengaturan harus diubah.',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
