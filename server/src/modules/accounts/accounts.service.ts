import type { Account, AccountType } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { toMoneyString } from '../../utils/money.js';
import type { CreateAccountInput, UpdateAccountInput } from './accounts.schemas.js';

export interface PublicAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  isLiquid: boolean;
  createdAt: Date;
}

export function toPublicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: toMoneyString(account.balance),
    isLiquid: account.isLiquid,
    createdAt: account.createdAt,
  };
}

export function defaultLiquidity(type: AccountType): boolean {
  return type !== 'INVESTMENT';
}

export async function listAccounts(userId: string): Promise<Account[]> {
  return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function createAccount(userId: string, input: CreateAccountInput): Promise<Account> {
  return prisma.account.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      balance: input.balance.toFixed(2),
      isLiquid: input.isLiquid ?? defaultLiquidity(input.type),
    },
  });
}

export async function updateAccount(userId: string, id: string, input: UpdateAccountInput): Promise<Account> {
  const existing = await prisma.account.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) {
    throw AppError.notFound('Akun tidak ditemukan.');
  }

  return prisma.account.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.isLiquid !== undefined && { isLiquid: input.isLiquid }),
    },
  });
}
