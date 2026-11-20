import argon2 from 'argon2';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { DEFAULT_CATEGORIES } from '../../utils/defaultCategories.js';
import { toMoneyString } from '../../utils/money.js';
import type { LoginInput, RegisterInput, UpdatePreferencesInput } from './auth.schemas.js';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  onboardingCompleted: boolean;
  baselineEssential: string;
  budgetFramework: User['budgetFramework'];
  swrRate: string;
  inflationRate: string;
  expectedReturnRate: string;
  currentLevel: number;
  highestLevel: number;
  healthStatus: User['healthStatus'];
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    onboardingCompleted: user.onboardingCompleted,
    baselineEssential: toMoneyString(user.baselineEssential),
    budgetFramework: user.budgetFramework,
    swrRate: toMoneyString(user.swrRate),
    inflationRate: toMoneyString(user.inflationRate),
    expectedReturnRate: toMoneyString(user.expectedReturnRate),
    currentLevel: user.currentLevel,
    highestLevel: user.highestLevel,
    healthStatus: user.healthStatus,
    createdAt: user.createdAt,
  };
}

let dummyHashPromise: Promise<string> | undefined;

/** Used to keep login timing similar when the email does not exist. */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash('dummy-password-for-timing-safety');
  return dummyHashPromise;
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw AppError.conflict('Email sudah terdaftar. Silakan masuk atau gunakan email lain.');
  }

  const passwordHash = await argon2.hash(input.password);

  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      categories: {
        create: DEFAULT_CATEGORIES.map((category) => ({
          name: category.name,
          expenseClass: category.expenseClass,
          isSystem: true,
        })),
      },
    },
  });
}

export async function loginUser(input: LoginInput): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    await argon2.verify(await getDummyHash(), input.password);
    throw AppError.unauthorized('Email atau kata sandi salah.');
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    throw AppError.unauthorized('Email atau kata sandi salah.');
  }

  return user;
}

export async function getCurrentUser(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.unauthorized('Akun tidak ditemukan. Silakan masuk kembali.');
  }
  return user;
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<User> {
  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.budgetFramework !== undefined) data.budgetFramework = input.budgetFramework;
  if (input.swrRate !== undefined) data.swrRate = input.swrRate.toFixed(2);
  if (input.inflationRate !== undefined) data.inflationRate = input.inflationRate.toFixed(2);
  if (input.expectedReturnRate !== undefined) data.expectedReturnRate = input.expectedReturnRate.toFixed(2);
  if (input.baselineEssential !== undefined) data.baselineEssential = input.baselineEssential.toFixed(2);

  return prisma.user.update({ where: { id: userId }, data });
}
