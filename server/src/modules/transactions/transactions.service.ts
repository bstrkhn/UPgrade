import { Decimal } from 'decimal.js';
import type { Account, Debt, Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { ZERO, formatRupiah, toMoneyString } from '../../utils/money.js';
import { toPublicAccount, type PublicAccount } from '../accounts/accounts.service.js';
import { toPublicDebt, type PublicDebt } from '../debts/debts.serializer.js';
import {
  resolveDebtSplit,
  type CreateTransactionInput,
  type ListTransactionsQuery,
} from './transactions.schemas.js';

type Tx = Prisma.TransactionClient;

const transactionInclude = {
  category: { select: { id: true, name: true, expenseClass: true } },
  sourceAccount: { select: { id: true, name: true } },
  destinationAccount: { select: { id: true, name: true } },
  debt: { select: { id: true, name: true } },
} satisfies Prisma.TransactionInclude;

type TransactionWithRelations = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;

export interface PublicTransaction {
  id: string;
  type: TransactionType;
  amount: string;
  transactionDate: Date;
  note: string | null;
  sourceAccount: { id: string; name: string };
  destinationAccount: { id: string; name: string } | null;
  category: { id: string; name: string; expenseClass: 'ESSENTIAL' | 'DISCRETIONARY' | null } | null;
  debt: { id: string; name: string } | null;
  principalPaid: string | null;
  interestPaid: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export function toPublicTransaction(transaction: TransactionWithRelations): PublicTransaction {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: toMoneyString(transaction.amount),
    transactionDate: transaction.transactionDate,
    note: transaction.note,
    sourceAccount: transaction.sourceAccount,
    destinationAccount: transaction.destinationAccount,
    category: transaction.category,
    debt: transaction.debt,
    principalPaid: transaction.principalPaid === null ? null : toMoneyString(transaction.principalPaid),
    interestPaid: transaction.interestPaid === null ? null : toMoneyString(transaction.interestPaid),
    deletedAt: transaction.deletedAt,
    createdAt: transaction.createdAt,
  };
}

export interface TransactionMutationResult {
  transaction: PublicTransaction;
  accounts: PublicAccount[];
  debt: PublicDebt | null;
  warnings: string[];
}

interface ImpactSubject {
  type: TransactionType;
  amount: Decimal;
  sourceAccountId: string;
  destinationAccountId: string | null;
  debtId: string | null;
  principalPaid: Decimal | null;
}

interface ImpactOutcome {
  accounts: Map<string, Account>;
  debt: Debt | null;
}

function money(value: Decimal): string {
  return value.toFixed(2);
}

/**
 * Applies (direction = 1) or reverses (direction = -1) the balance impact of a transaction.
 * Must be called inside prisma.$transaction. Balance changes use atomic DB increments/decrements.
 */
async function applyImpact(
  tx: Tx,
  userId: string,
  subject: ImpactSubject,
  direction: 1 | -1,
): Promise<ImpactOutcome> {
  const accounts = new Map<string, Account>();
  let debt: Debt | null = null;

  const adjustAccount = async (accountId: string, signedDelta: Decimal): Promise<void> => {
    // userId in the filter prevents touching accounts that do not belong to the authenticated user.
    const result = await tx.account.updateMany({
      where: { id: accountId, userId },
      data: { balance: { increment: money(signedDelta) } },
    });
    if (result.count === 0) {
      throw AppError.notFound('Akun tidak ditemukan.');
    }
    const updated = await tx.account.findFirstOrThrow({ where: { id: accountId, userId } });
    accounts.set(updated.id, updated);
  };

  const sign = direction === 1 ? 1 : -1;
  const amount = subject.amount;

  switch (subject.type) {
    case 'INCOME':
      await adjustAccount(subject.sourceAccountId, amount.times(sign));
      break;

    case 'EXPENSE':
      await adjustAccount(subject.sourceAccountId, amount.times(-sign));
      break;

    case 'TRANSFER': {
      if (!subject.destinationAccountId) {
        throw AppError.badRequest('Transaksi transfer tidak memiliki akun tujuan.');
      }
      await adjustAccount(subject.sourceAccountId, amount.times(-sign));
      await adjustAccount(subject.destinationAccountId, amount.times(sign));
      break;
    }

    case 'DEBT_PAYMENT': {
      if (!subject.debtId) {
        throw AppError.badRequest('Transaksi pembayaran utang tidak memiliki data utang.');
      }
      const principal = subject.principalPaid ?? amount;

      await adjustAccount(subject.sourceAccountId, amount.times(-sign));

      if (direction === 1) {
        // Guarded decrement: remainingBalance can never go below 0 (floor), even under concurrency.
        const result = await tx.debt.updateMany({
          where: { id: subject.debtId, userId, remainingBalance: { gte: money(principal) } },
          data: { remainingBalance: { decrement: money(principal) } },
        });
        if (result.count === 0) {
          throw AppError.conflict('Pokok yang dibayar melebihi sisa utang.');
        }
      } else {
        const result = await tx.debt.updateMany({
          where: { id: subject.debtId, userId },
          data: { remainingBalance: { increment: money(principal) } },
        });
        if (result.count === 0) {
          throw AppError.notFound('Utang tidak ditemukan.');
        }
      }

      const current = await tx.debt.findFirstOrThrow({ where: { id: subject.debtId, userId } });
      const paidOff = new Decimal(current.remainingBalance.toString()).lte(ZERO);
      debt =
        current.isPaidOff === paidOff
          ? current
          : await tx.debt.update({ where: { id: current.id }, data: { isPaidOff: paidOff } });
      break;
    }
  }

  return { accounts, debt };
}

function collectWarnings(accounts: Map<string, Account>): string[] {
  const warnings: string[] = [];
  for (const account of accounts.values()) {
    if (new Decimal(account.balance.toString()).isNegative()) {
      warnings.push(`Saldo akun "${account.name}" menjadi negatif (${formatRupiah(account.balance.toString())}).`);
    }
  }
  return warnings;
}

async function loadTransactionOrThrow(tx: Tx, userId: string, id: string): Promise<TransactionWithRelations> {
  const found = await tx.transaction.findFirst({ where: { id, userId }, include: transactionInclude });
  if (!found) {
    throw AppError.notFound('Transaksi tidak ditemukan.');
  }
  return found;
}

function buildResult(
  transaction: TransactionWithRelations,
  outcome: ImpactOutcome,
): TransactionMutationResult {
  return {
    transaction: toPublicTransaction(transaction),
    accounts: [...outcome.accounts.values()].map(toPublicAccount),
    debt: outcome.debt ? toPublicDebt(outcome.debt) : null,
    warnings: collectWarnings(outcome.accounts),
  };
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionMutationResult> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.account.findFirst({ where: { id: input.sourceAccountId, userId } });
    if (!source) {
      throw AppError.notFound('Akun sumber tidak ditemukan.');
    }

    let categoryId: string | null = null;
    let destinationAccountId: string | null = null;
    let debtId: string | null = null;
    let principalPaid: Decimal | null = null;
    let interestPaid: Decimal | null = null;

    switch (input.type) {
      case 'INCOME': {
        if (input.categoryId) {
          const category = await tx.category.findFirst({ where: { id: input.categoryId, userId } });
          if (!category) throw AppError.notFound('Kategori tidak ditemukan.');
          if (category.expenseClass !== null) {
            throw AppError.badRequest('Pemasukan harus menggunakan kategori pemasukan.');
          }
          categoryId = category.id;
        }
        break;
      }

      case 'EXPENSE': {
        const category = await tx.category.findFirst({ where: { id: input.categoryId, userId } });
        if (!category) throw AppError.notFound('Kategori tidak ditemukan.');
        if (category.expenseClass === null) {
          throw AppError.badRequest('Pengeluaran harus menggunakan kategori Kebutuhan atau Keinginan.');
        }
        categoryId = category.id;
        break;
      }

      case 'TRANSFER': {
        const destination = await tx.account.findFirst({ where: { id: input.destinationAccountId, userId } });
        if (!destination) throw AppError.notFound('Akun tujuan tidak ditemukan.');
        destinationAccountId = destination.id;
        break;
      }

      case 'DEBT_PAYMENT': {
        const debt = await tx.debt.findFirst({ where: { id: input.debtId, userId } });
        if (!debt) throw AppError.notFound('Utang tidak ditemukan.');
        if (debt.isPaidOff) throw AppError.badRequest('Utang ini sudah lunas.');

        const split = resolveDebtSplit(input.amount, input.principalPaid, input.interestPaid);
        if (!split) {
          throw AppError.badRequest('Pokok + bunga yang dibayar harus sama dengan total nominal pembayaran.');
        }
        if (split.principal.gt(new Decimal(debt.remainingBalance.toString()))) {
          throw AppError.badRequest(`Pokok yang dibayar melebihi sisa utang "${debt.name}".`);
        }
        debtId = debt.id;
        principalPaid = split.principal;
        interestPaid = split.interest;
        break;
      }
    }

    const created = await tx.transaction.create({
      data: {
        userId,
        type: input.type,
        amount: money(input.amount),
        transactionDate: input.transactionDate ?? new Date(),
        note: input.note && input.note.length > 0 ? input.note : null,
        sourceAccountId: source.id,
        destinationAccountId,
        categoryId,
        debtId,
        principalPaid: principalPaid ? money(principalPaid) : null,
        interestPaid: interestPaid ? money(interestPaid) : null,
      },
      include: transactionInclude,
    });

    const outcome = await applyImpact(
      tx,
      userId,
      {
        type: input.type,
        amount: input.amount,
        sourceAccountId: source.id,
        destinationAccountId,
        debtId,
        principalPaid,
      },
      1,
    );

    return buildResult(created, outcome);
  });
}

function subjectFromRecord(record: TransactionWithRelations): ImpactSubject {
  return {
    type: record.type,
    amount: new Decimal(record.amount.toString()),
    sourceAccountId: record.sourceAccount.id,
    destinationAccountId: record.destinationAccount?.id ?? null,
    debtId: record.debt?.id ?? null,
    principalPaid: record.principalPaid === null ? null : new Decimal(record.principalPaid.toString()),
  };
}

/** Soft delete: sets deletedAt and atomically reverses the account/debt balance impact. */
export async function softDeleteTransaction(userId: string, id: string): Promise<TransactionMutationResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await loadTransactionOrThrow(tx, userId, id);
    if (existing.deletedAt !== null) {
      throw AppError.notFound('Transaksi tidak ditemukan atau sudah dihapus.');
    }

    // Race-safe claim: only one concurrent request can flip deletedAt from null.
    const claimed = await tx.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw AppError.notFound('Transaksi tidak ditemukan atau sudah dihapus.');
    }

    const outcome = await applyImpact(tx, userId, subjectFromRecord(existing), -1);
    const updated = await loadTransactionOrThrow(tx, userId, id);
    return buildResult(updated, outcome);
  });
}

/** Restore (Undo): clears deletedAt and atomically re-applies the exact balance impact. */
export async function restoreTransaction(userId: string, id: string): Promise<TransactionMutationResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await loadTransactionOrThrow(tx, userId, id);
    if (existing.deletedAt === null) {
      throw AppError.conflict('Transaksi ini masih aktif dan tidak perlu dipulihkan.');
    }

    const claimed = await tx.transaction.updateMany({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (claimed.count === 0) {
      throw AppError.conflict('Transaksi ini masih aktif dan tidak perlu dipulihkan.');
    }

    const outcome = await applyImpact(tx, userId, subjectFromRecord(existing), 1);
    const updated = await loadTransactionOrThrow(tx, userId, id);
    return buildResult(updated, outcome);
  });
}

export interface TransactionListResult {
  transactions: PublicTransaction[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listTransactions(userId: string, query: ListTransactionsQuery): Promise<TransactionListResult> {
  const where: Prisma.TransactionWhereInput = { userId, deletedAt: null };

  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.accountId) {
    where.OR = [{ sourceAccountId: query.accountId }, { destinationAccountId: query.accountId }];
  }
  if (query.from || query.to) {
    where.transactionDate = {
      ...(query.from && { gte: query.from }),
      ...(query.to && { lte: query.to }),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    transactions: rows.map(toPublicTransaction),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}
