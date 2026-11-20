import type { Debt, InterestType } from '@prisma/client';
import { toMoneyString } from '../../utils/money.js';

export interface PublicDebt {
  id: string;
  name: string;
  isConsumptive: boolean;
  totalPrincipal: string;
  remainingBalance: string;
  annualInterestPct: string;
  interestType: InterestType;
  minimumMonthlyPay: string;
  dueDateDay: number | null;
  isPaidOff: boolean;
}

export function toPublicDebt(debt: Debt): PublicDebt {
  return {
    id: debt.id,
    name: debt.name,
    isConsumptive: debt.isConsumptive,
    totalPrincipal: toMoneyString(debt.totalPrincipal),
    remainingBalance: toMoneyString(debt.remainingBalance),
    annualInterestPct: toMoneyString(debt.annualInterestPct),
    interestType: debt.interestType,
    minimumMonthlyPay: toMoneyString(debt.minimumMonthlyPay),
    dueDateDay: debt.dueDateDay,
    isPaidOff: debt.isPaidOff,
  };
}
