import { z } from 'zod';
import { nonNegativeMoney, percentageRate, positiveMoney } from '../../utils/money.js';

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

const positiveRate = percentageRate.refine((value) => value.gt(0), 'Persentase harus lebih besar dari 0.');

export const fireSimulationBodySchema = z.object({
  monthlyEssentialBasis: positiveMoney.optional(),
  currentInvestmentPortfolio: nonNegativeMoney.optional(),
  monthlyContribution: nonNegativeMoney.optional(),
  swrRatePct: positiveRate.optional(),
  inflationRatePct: percentageRate.optional(),
  expectedReturnRatePct: percentageRate.optional(),
  maxYears: z.coerce
    .number({ error: 'Durasi tahun proyeksi harus berupa angka.' })
    .int('Durasi tahun proyeksi harus bilangan bulat.')
    .min(5, 'Durasi proyeksi minimal 5 tahun.')
    .max(60, 'Durasi proyeksi maksimal 60 tahun.')
    .default(40),
});

export const createSnapshotBodySchema = z.object({
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
export type FireSimulationBody = z.infer<typeof fireSimulationBodySchema>;
export type CreateSnapshotBody = z.infer<typeof createSnapshotBodySchema>;
