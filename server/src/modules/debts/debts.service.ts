import { Decimal } from 'decimal.js';
import type { Debt } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { simulateDebtPayoff, type DebtPayoffSimulationOutput } from '../../utils/financialMath.js';
import { ZERO, toMoneyString } from '../../utils/money.js';
import type { CreateDebtInput, SimulateDebtsInput, UpdateDebtInput } from './debts.schemas.js';

export interface DebtSimulationServiceResult extends DebtPayoffSimulationOutput {
  activeDebtsCount: number;
  totalRemainingBalance: string;
  totalMinimumMonthlyPay: string;
  extraMonthlyPayment: string;
}

export async function listDebts(userId: string, activeOnly?: boolean): Promise<Debt[]> {
  return prisma.debt.findMany({
    where: { userId, ...(activeOnly ? { isPaidOff: false } : {}) },
    orderBy: [{ isPaidOff: 'asc' }, { remainingBalance: 'asc' }, { name: 'asc' }],
  });
}

export async function createDebt(userId: string, input: CreateDebtInput): Promise<Debt> {
  const remaining = input.remainingBalance ?? input.totalPrincipal;
  return prisma.debt.create({
    data: {
      userId,
      name: input.name,
      isConsumptive: input.isConsumptive,
      totalPrincipal: input.totalPrincipal.toFixed(2),
      remainingBalance: remaining.toFixed(2),
      annualInterestPct: input.annualInterestPct.toFixed(2),
      interestType: input.interestType,
      minimumMonthlyPay: input.minimumMonthlyPay.toFixed(2),
      dueDateDay: input.dueDateDay ?? null,
      isPaidOff: remaining.lte(ZERO),
    },
  });
}

export async function updateDebt(userId: string, id: string, input: UpdateDebtInput): Promise<Debt> {
  const existing = await prisma.debt.findFirst({ where: { id, userId } });
  if (!existing) {
    throw AppError.notFound('Utang tidak ditemukan.');
  }

  const existingPrincipal = new Decimal(existing.totalPrincipal.toString());
  const existingRemaining = new Decimal(existing.remainingBalance.toString());
  const nextPrincipal = input.totalPrincipal ?? existingPrincipal;
  let nextRemaining = existingRemaining;

  if (input.remainingBalance !== undefined && !input.remainingBalance.eq(existingRemaining)) {
    const paymentCount = await prisma.transaction.count({
      where: { userId, debtId: id },
    });
    if (paymentCount > 0) {
      throw AppError.conflict(
        'Sisa utang tidak bisa diubah langsung karena sudah memiliki riwayat pembayaran. Gunakan transaksi Bayar Utang.',
      );
    }
    nextRemaining = input.remainingBalance;
  }

  if (nextRemaining.gt(nextPrincipal)) {
    throw AppError.badRequest('Sisa utang tidak boleh melebihi total pokok utang.');
  }

  return prisma.debt.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.isConsumptive !== undefined && { isConsumptive: input.isConsumptive }),
      ...(input.totalPrincipal !== undefined && { totalPrincipal: nextPrincipal.toFixed(2) }),
      ...(input.remainingBalance !== undefined && {
        remainingBalance: nextRemaining.toFixed(2),
        isPaidOff: nextRemaining.lte(ZERO),
      }),
      ...(input.annualInterestPct !== undefined && { annualInterestPct: input.annualInterestPct.toFixed(2) }),
      ...(input.interestType !== undefined && { interestType: input.interestType }),
      ...(input.minimumMonthlyPay !== undefined && { minimumMonthlyPay: input.minimumMonthlyPay.toFixed(2) }),
      ...(input.dueDateDay !== undefined && { dueDateDay: input.dueDateDay }),
    },
  });
}

export async function deleteDebt(userId: string, id: string): Promise<void> {
  const existing = await prisma.debt.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) {
    throw AppError.notFound('Utang tidak ditemukan.');
  }

  const paymentCount = await prisma.transaction.count({
    where: { userId, debtId: id },
  });
  if (paymentCount > 0) {
    throw AppError.conflict('Utang yang sudah memiliki riwayat pembayaran tidak dapat dihapus.');
  }

  await prisma.debt.delete({ where: { id } });
}

export async function simulateUserDebts(
  userId: string,
  input: SimulateDebtsInput,
): Promise<DebtSimulationServiceResult> {
  const activeDebts = await prisma.debt.findMany({
    where: { userId, isPaidOff: false },
    orderBy: [{ remainingBalance: 'asc' }, { name: 'asc' }],
  });

  const simInputs = activeDebts
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      totalPrincipal: new Decimal(debt.totalPrincipal.toString()),
      remainingBalance: new Decimal(debt.remainingBalance.toString()),
      annualInterestPct: new Decimal(debt.annualInterestPct.toString()),
      interestType: debt.interestType,
      minimumMonthlyPay: new Decimal(debt.minimumMonthlyPay.toString()),
    }))
    .filter((debt) => debt.remainingBalance.gt(ZERO));

  const totalRemainingBalance = simInputs.reduce((acc, d) => acc.plus(d.remainingBalance), ZERO);
  const totalMinimumMonthlyPay = simInputs.reduce((acc, d) => acc.plus(d.minimumMonthlyPay), ZERO);

  const simulation = simulateDebtPayoff({
    debts: simInputs,
    extraMonthlyPayment: input.extraMonthlyPayment,
  });

  return {
    activeDebtsCount: simInputs.length,
    totalRemainingBalance: toMoneyString(totalRemainingBalance),
    totalMinimumMonthlyPay: toMoneyString(totalMinimumMonthlyPay),
    extraMonthlyPayment: toMoneyString(input.extraMonthlyPayment),
    ...simulation,
  };
}
