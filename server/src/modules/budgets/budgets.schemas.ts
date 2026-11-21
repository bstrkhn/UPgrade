import { z } from 'zod';
import { nonNegativeMoney } from '../../utils/money.js';

export const budgetPeriodParamsSchema = z.object({
  year: z.coerce
    .number({ error: 'Tahun harus berupa angka.' })
    .int('Tahun harus berupa bilangan bulat.')
    .min(2000, 'Tahun minimal 2000.')
    .max(2100, 'Tahun maksimal 2100.'),
  month: z.coerce
    .number({ error: 'Bulan harus berupa angka.' })
    .int('Bulan harus berupa bilangan bulat.')
    .min(1, 'Bulan minimal 1.')
    .max(12, 'Bulan maksimal 12.'),
});

export const upsertBudgetsSchema = z.object({
  items: z
    .array(
      z.object({
        categoryId: z.string({ error: 'ID kategori wajib diisi.' }).uuid('ID kategori tidak valid.'),
        allocated: nonNegativeMoney,
      }),
      { error: 'Daftar alokasi anggaran wajib diisi.' },
    )
    .min(1, 'Minimal satu alokasi anggaran harus dikirim.')
    .max(100, 'Maksimal 100 alokasi anggaran dalam satu permintaan.')
    .refine((items) => new Set(items.map((item) => item.categoryId)).size === items.length, {
      message: 'Terdapat kategori yang duplikat dalam daftar alokasi anggaran.',
    }),
});

export type BudgetPeriodParams = z.infer<typeof budgetPeriodParamsSchema>;
export type UpsertBudgetsInput = z.infer<typeof upsertBudgetsSchema>;
