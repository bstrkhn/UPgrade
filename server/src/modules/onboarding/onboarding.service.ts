import { Decimal } from 'decimal.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { ZERO, toMoneyString } from '../../utils/money.js';
import { defaultLiquidity, toPublicAccount, type PublicAccount } from '../accounts/accounts.service.js';
import { toPublicUser, type PublicUser } from '../auth/auth.service.js';
import { toPublicDebt, type PublicDebt } from '../debts/debts.serializer.js';
import type { OnboardingInput } from './onboarding.schemas.js';

export interface InitialLevelSummary {
  level: number;
  title: string;
  description: string;
  dataSource: 'ONBOARDING_BASELINE';
  badge: 'Estimasi Awal';
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  baselineEssential: string;
}

export interface OnboardingResult {
  user: PublicUser;
  accounts: PublicAccount[];
  debts: PublicDebt[];
  summary: InitialLevelSummary;
}

/**
 * Provisional starting level. With no transaction history, surplus is unknown (0):
 * consumptive debt keeps the user at Level 1, otherwise Level 2.
 * The full Level 1-7 evaluation runs in the analytics module once transactions exist.
 */
function assignInitialLevel(consumptiveDebt: Decimal): { level: number; title: string; description: string } {
  if (consumptiveDebt.gt(ZERO)) {
    return {
      level: 1,
      title: 'Ketergantungan Kritis',
      description:
        'Kamu masih memiliki utang konsumtif. Fokus catat pengeluaran 30 hari, hentikan utang baru, dan terapkan anggaran berbasis nol.',
    };
  }
  return {
    level: 2,
    title: 'Kemandirian Dasar',
    description:
      'Kamu bebas dari utang konsumtif. Mulai bayar diri sendiri lebih dulu (1%–10% dari penghasilan) dan pisahkan rekening tabungan.',
  };
}

export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<OnboardingResult> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { onboardingCompleted: true } });
  if (!current) {
    throw AppError.unauthorized('Akun tidak ditemukan. Silakan masuk kembali.');
  }
  if (current.onboardingCompleted) {
    throw AppError.conflict('Onboarding sudah diselesaikan sebelumnya.');
  }

  return prisma.$transaction(async (tx) => {
    // Guard against concurrent double-submits: only flips when still incomplete.
    const claimed = await tx.user.updateMany({
      where: { id: userId, onboardingCompleted: false },
      data: { onboardingCompleted: true },
    });
    if (claimed.count === 0) {
      throw AppError.conflict('Onboarding sudah diselesaikan sebelumnya.');
    }

    const accounts = [];
    for (const account of input.accounts) {
      accounts.push(
        await tx.account.create({
          data: {
            userId,
            name: account.name,
            type: account.type,
            balance: account.balance.toFixed(2),
            isLiquid: account.isLiquid ?? defaultLiquidity(account.type),
          },
        }),
      );
    }

    const debts = [];
    for (const debt of input.debts) {
      const remaining = debt.remainingBalance ?? debt.totalPrincipal;
      debts.push(
        await tx.debt.create({
          data: {
            userId,
            name: debt.name,
            isConsumptive: debt.isConsumptive,
            totalPrincipal: debt.totalPrincipal.toFixed(2),
            remainingBalance: remaining.toFixed(2),
            annualInterestPct: debt.annualInterestPct.toFixed(2),
            interestType: debt.interestType,
            minimumMonthlyPay: debt.minimumMonthlyPay.toFixed(2),
            dueDateDay: debt.dueDateDay ?? null,
            isPaidOff: remaining.isZero(),
          },
        }),
      );
    }

    const totalAssets = accounts.reduce((sum, account) => sum.plus(account.balance.toString()), ZERO);
    const totalLiabilities = debts.reduce(
      (sum, debt) => (debt.isPaidOff ? sum : sum.plus(debt.remainingBalance.toString())),
      ZERO,
    );
    const consumptiveDebt = debts.reduce(
      (sum, debt) => (debt.isConsumptive && !debt.isPaidOff ? sum.plus(debt.remainingBalance.toString()) : sum),
      ZERO,
    );

    const level = assignInitialLevel(consumptiveDebt);

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        baselineEssential: input.baselineEssential.toFixed(2),
        budgetFramework: input.budgetFramework,
        currentLevel: level.level,
        highestLevel: level.level,
        healthStatus: 'NORMAL',
      },
    });

    return {
      user: toPublicUser(user),
      accounts: accounts.map(toPublicAccount),
      debts: debts.map(toPublicDebt),
      summary: {
        ...level,
        dataSource: 'ONBOARDING_BASELINE' as const,
        badge: 'Estimasi Awal' as const,
        totalAssets: toMoneyString(totalAssets),
        totalLiabilities: toMoneyString(totalLiabilities),
        netWorth: toMoneyString(totalAssets.minus(totalLiabilities)),
        baselineEssential: toMoneyString(input.baselineEssential),
      },
    };
  });
}
