import type { Debt } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export async function listDebts(userId: string, activeOnly?: boolean): Promise<Debt[]> {
  return prisma.debt.findMany({
    where: { userId, ...(activeOnly ? { isPaidOff: false } : {}) },
    orderBy: [{ isPaidOff: 'asc' }, { remainingBalance: 'asc' }, { name: 'asc' }],
  });
}
