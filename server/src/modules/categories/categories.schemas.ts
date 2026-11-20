import { z } from 'zod';

export const categoryKindSchema = z.enum(['INCOME', 'ESSENTIAL', 'DISCRETIONARY'], {
  error: 'Jenis kategori harus INCOME, ESSENTIAL, atau DISCRETIONARY.',
});

export const createCategorySchema = z.object({
  name: z
    .string({ error: 'Nama kategori wajib diisi.' })
    .trim()
    .min(1, 'Nama kategori wajib diisi.')
    .max(60, 'Nama kategori maksimal 60 karakter.'),
  kind: categoryKindSchema,
});

export const listCategoriesQuerySchema = z.object({
  kind: categoryKindSchema.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CategoryKind = z.infer<typeof categoryKindSchema>;
