import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { nonNegativeMoney, positiveMoney } from '../../utils/money.js';

/**
 * Splits a debt payment into principal and interest.
 * - both provided: they must sum to `amount`
 * - only one provided: the other is derived from `amount`
 * - none provided: the whole amount is principal
 * Returns `null` when the split is inconsistent.
 */
export function resolveDebtSplit(
  amount: Decimal,
  principalPaid?: Decimal,
  interestPaid?: Decimal,
): { principal: Decimal; interest: Decimal } | null {
  let principal: Decimal;
  let interest: Decimal;

  if (principalPaid !== undefined && interestPaid !== undefined) {
    principal = principalPaid;
    interest = interestPaid;
  } else if (principalPaid !== undefined) {
    principal = principalPaid;
    interest = amount.minus(principalPaid);
  } else if (interestPaid !== undefined) {
    interest = interestPaid;
    principal = amount.minus(interestPaid);
  } else {
    principal = amount;
    interest = new Decimal(0);
  }

  if (principal.isNegative() || interest.isNegative() || !principal.plus(interest).eq(amount)) {
    return null;
  }
  return { principal, interest };
}

const uuid = (label: string) => z.string({ error: `${label} wajib diisi.` }).uuid(`${label} tidak valid.`);

const noteSchema = z
  .string({ error: 'Catatan harus berupa teks.' })
  .trim()
  .max(255, 'Catatan maksimal 255 karakter.')
  .optional();

const transactionDateSchema = z.coerce.date({ error: 'Tanggal transaksi tidak valid.' }).optional();

const baseFields = {
  amount: positiveMoney,
  transactionDate: transactionDateSchema,
  note: noteSchema,
  sourceAccountId: uuid('Akun sumber'),
};

const incomeSchema = z.object({
  ...baseFields,
  type: z.literal('INCOME'),
  categoryId: uuid('Kategori').optional(),
});

const expenseSchema = z.object({
  ...baseFields,
  type: z.literal('EXPENSE'),
  categoryId: uuid('Kategori'),
});

const transferSchema = z
  .object({
    ...baseFields,
    type: z.literal('TRANSFER'),
    destinationAccountId: uuid('Akun tujuan'),
  })
  .refine((value) => value.sourceAccountId !== value.destinationAccountId, {
    message: 'Akun sumber dan akun tujuan tidak boleh sama.',
    path: ['destinationAccountId'],
  });

const debtPaymentSchema = z
  .object({
    ...baseFields,
    type: z.literal('DEBT_PAYMENT'),
    debtId: uuid('Utang'),
    principalPaid: nonNegativeMoney.optional(),
    interestPaid: nonNegativeMoney.optional(),
  })
  .refine((value) => resolveDebtSplit(value.amount, value.principalPaid, value.interestPaid) !== null, {
    message: 'Pokok + bunga yang dibayar harus sama dengan total nominal pembayaran.',
    path: ['principalPaid'],
  });

export const createTransactionSchema = z.discriminatedUnion(
  'type',
  [incomeSchema, expenseSchema, transferSchema, debtPaymentSchema],
  { error: 'Jenis transaksi harus INCOME, EXPENSE, TRANSFER, atau DEBT_PAYMENT.' },
);

export const transactionIdParamSchema = z.object({
  id: uuid('ID transaksi'),
});

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns true only when year-month-day is a real calendar date (rejects e.g. 2026-02-31). */
function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/**
 * Parses a query-string date filter.
 * - `YYYY-MM-DD` is interpreted in WIB (+07:00): start-of-day for `start`, end-of-day for `end`.
 * - Any other value is treated as a full ISO-8601 timestamp and passed through unchanged.
 */
export function parseFilterDate(boundary: 'start' | 'end', errorMessage: string) {
  return z
    .string({ error: errorMessage })
    .trim()
    .transform((value, ctx): Date => {
      const fail = (): Date => {
        ctx.issues.push({ code: 'custom', message: errorMessage, input: value });
        return z.NEVER;
      };

      const dateOnly = DATE_ONLY_PATTERN.exec(value);
      if (dateOnly) {
        const [, yearText = '', monthText = '', dayText = ''] = dateOnly;
        if (!isRealCalendarDate(Number(yearText), Number(monthText), Number(dayText))) {
          return fail();
        }
        const time = boundary === 'start' ? 'T00:00:00.000+07:00' : 'T23:59:59.999+07:00';
        const date = new Date(`${value}${time}`);
        return Number.isNaN(date.getTime()) ? fail() : date;
      }

      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? fail() : date;
    });
}

export const listTransactionsQuerySchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'DEBT_PAYMENT'], { error: 'Jenis transaksi tidak valid.' }).optional(),
    accountId: uuid('Akun').optional(),
    categoryId: uuid('Kategori').optional(),
    from: parseFilterDate('start', 'Tanggal awal tidak valid.').optional(),
    to: parseFilterDate('end', 'Tanggal akhir tidak valid.').optional(),
    page: z.coerce.number({ error: 'Halaman harus berupa angka.' }).int().min(1, 'Halaman minimal 1.').default(1),
    pageSize: z.coerce
      .number({ error: 'Ukuran halaman harus berupa angka.' })
      .int()
      .min(1, 'Ukuran halaman minimal 1.')
      .max(100, 'Ukuran halaman maksimal 100.')
      .default(20),
  })
  .refine((value) => !value.from || !value.to || value.from.getTime() <= value.to.getTime(), {
    message: 'Tanggal awal tidak boleh setelah tanggal akhir.',
    path: ['from'],
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
