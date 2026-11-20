import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '../src/utils/defaultCategories.js';

const prisma = new PrismaClient();

/**
 * Idempotent backfill: every user receives the default Bahasa Indonesia categories
 * (INCOME, ESSENTIAL, DISCRETIONARY) if they do not already have them.
 * New users are seeded automatically on registration.
 */
async function main(): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let created = 0;

  for (const user of users) {
    const existing = await prisma.category.findMany({
      where: { userId: user.id, isSystem: true },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((category) => category.name));
    const missing = DEFAULT_CATEGORIES.filter((category) => !existingNames.has(category.name));

    if (missing.length === 0) continue;

    const result = await prisma.category.createMany({
      data: missing.map((category) => ({
        userId: user.id,
        name: category.name,
        expenseClass: category.expenseClass,
        isSystem: true,
      })),
    });
    created += result.count;
  }

  console.log(`Seed selesai: ${created} kategori bawaan ditambahkan untuk ${users.length} pengguna.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
