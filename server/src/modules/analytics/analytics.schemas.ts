import { z } from 'zod';

export const analyticsDashboardQuerySchema = z.object({
  year: z.coerce
    .number({ error: 'Tahun harus berupa angka.' })
    .int('Tahun harus berupa bilangan bulat.')
    .min(2000, 'Tahun minimal 2000.')
    .max(2100, 'Tahun maksimal 2100.')
    .optional(),
  month: z.coerce
    .number({ error: 'Bulan harus berupa angka.' })
    .int('Bulan harus berupa bilangan bulat.')
    .min(1, 'Bulan minimal 1.')
    .max(12, 'Bulan maksimal 12.')
    .optional(),
});

export type AnalyticsDashboardQuery = z.infer<typeof analyticsDashboardQuerySchema>;
