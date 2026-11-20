import type { Category, ExpenseClass, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import type { CategoryKind, CreateCategoryInput } from './categories.schemas.js';

export interface PublicCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  expenseClass: ExpenseClass | null;
  isSystem: boolean;
}

export function toPublicCategory(category: Category): PublicCategory {
  return {
    id: category.id,
    name: category.name,
    kind: category.expenseClass ?? 'INCOME',
    expenseClass: category.expenseClass,
    isSystem: category.isSystem,
  };
}

function kindToExpenseClass(kind: CategoryKind): ExpenseClass | null {
  return kind === 'INCOME' ? null : kind;
}

export async function listCategories(userId: string, kind?: CategoryKind): Promise<Category[]> {
  const where: Prisma.CategoryWhereInput = { userId };
  if (kind !== undefined) {
    where.expenseClass = kindToExpenseClass(kind);
  }
  return prisma.category.findMany({ where, orderBy: [{ expenseClass: 'asc' }, { name: 'asc' }] });
}

export async function createCategory(userId: string, input: CreateCategoryInput): Promise<Category> {
  const duplicate = await prisma.category.findFirst({
    where: { userId, name: { equals: input.name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (duplicate) {
    throw AppError.conflict(`Kategori "${input.name}" sudah ada.`);
  }

  return prisma.category.create({
    data: {
      userId,
      name: input.name,
      expenseClass: kindToExpenseClass(input.kind),
      isSystem: false,
    },
  });
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) {
    throw AppError.notFound('Kategori tidak ditemukan.');
  }
  if (category.isSystem) {
    throw AppError.badRequest('Kategori bawaan sistem tidak dapat dihapus.');
  }

  const [transactionCount, budgetCount] = await Promise.all([
    prisma.transaction.count({ where: { userId, categoryId: id } }),
    prisma.budget.count({ where: { userId, categoryId: id } }),
  ]);
  if (transactionCount > 0 || budgetCount > 0) {
    throw AppError.conflict('Kategori masih dipakai oleh transaksi atau anggaran, sehingga tidak dapat dihapus.');
  }

  await prisma.category.delete({ where: { id } });
}
