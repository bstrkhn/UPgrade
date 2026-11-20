This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching these patterns are excluded: .env, node_modules, dist, package-lock.json
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
prisma/
  schema.prisma
  seed.ts
src/
  config/
    cors.ts
    env.ts
    prisma.ts
    zod.ts
  middlewares/
    authCookie.ts
    errorHandler.ts
    rateLimiter.ts
    validateZod.ts
  modules/
    accounts/
      accounts.routes.ts
      accounts.schemas.ts
      accounts.service.ts
    auth/
      auth.routes.ts
      auth.schemas.ts
      auth.service.ts
    categories/
      categories.routes.ts
      categories.schemas.ts
      categories.service.ts
    debts/
      debts.serializer.ts
    onboarding/
      onboarding.routes.ts
      onboarding.schemas.ts
      onboarding.service.ts
    transactions/
      transactions.routes.ts
      transactions.schemas.ts
      transactions.service.ts
  utils/
    AppError.ts
    defaultCategories.ts
    money.ts
    requestUser.ts
    response.ts
  app.ts
  server.ts
.env.example
package.json
prisma.config.ts
tsconfig.json
```

# Files

## File: prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum AccountType {
  CASH
  BANK
  EWALLET
  INVESTMENT
  EMERGENCY_FUND
}

enum TransactionType {
  INCOME
  EXPENSE
  TRANSFER
  DEBT_PAYMENT
}

enum ExpenseClass {
  ESSENTIAL
  DISCRETIONARY
}

enum InterestType {
  FLAT
  EFFECTIVE
}

enum BudgetFramework {
  ZERO_BASED
  RULE_50_30_20
}

enum HealthStatus {
  NORMAL
  RECOVERY_MODE
}

model User {
  id                  String          @id @default(uuid())
  email               String          @unique
  passwordHash        String
  name                String
  createdAt           DateTime        @default(now())

  onboardingCompleted Boolean         @default(false)
  baselineEssential   Decimal         @default(0) @db.Decimal(15, 2)
  budgetFramework     BudgetFramework @default(ZERO_BASED)
  swrRate             Decimal         @default(4.00) @db.Decimal(5, 2)
  inflationRate       Decimal         @default(4.50) @db.Decimal(5, 2)
  expectedReturnRate  Decimal         @default(10.00) @db.Decimal(5, 2)

  currentLevel        Int             @default(1)
  highestLevel        Int             @default(1)
  healthStatus        HealthStatus    @default(NORMAL)

  accounts            Account[]
  categories          Category[]
  transactions        Transaction[]
  debts               Debt[]
  budgets             Budget[]
  netWorthSnapshots   NetWorthSnapshot[]
}

model Account {
  id           String        @id @default(uuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  type         AccountType
  balance      Decimal       @default(0) @db.Decimal(15, 2)
  isLiquid     Boolean       @default(true)
  createdAt    DateTime      @default(now())

  outgoingTx   Transaction[] @relation("SourceAccount")
  incomingTx   Transaction[] @relation("DestinationAccount")
}

model Category {
  id           String        @id @default(uuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  expenseClass ExpenseClass?
  isSystem     Boolean       @default(false)

  transactions Transaction[]
  budgets      Budget[]
}

model Transaction {
  id                   String          @id @default(uuid())
  userId               String
  user                 User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  type                 TransactionType
  amount               Decimal         @db.Decimal(15, 2)
  transactionDate      DateTime        @default(now())
  note                 String?

  sourceAccountId      String
  sourceAccount        Account         @relation("SourceAccount", fields: [sourceAccountId], references: [id])
  destinationAccountId String?
  destinationAccount   Account?        @relation("DestinationAccount", fields: [destinationAccountId], references: [id])
  categoryId           String?
  category             Category?       @relation(fields: [categoryId], references: [id])

  debtId               String?
  debt                 Debt?           @relation(fields: [debtId], references: [id])
  principalPaid        Decimal?        @db.Decimal(15, 2)
  interestPaid         Decimal?        @db.Decimal(15, 2)

  deletedAt            DateTime?
  createdAt            DateTime        @default(now())

  @@index([userId, transactionDate])
  @@index([userId, type, deletedAt])
}

model Debt {
  id                String        @id @default(uuid())
  userId            String
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name              String
  isConsumptive     Boolean       @default(true)
  totalPrincipal    Decimal       @db.Decimal(15, 2)
  remainingBalance  Decimal       @db.Decimal(15, 2)
  annualInterestPct Decimal       @default(0) @db.Decimal(5, 2)
  interestType      InterestType  @default(FLAT)
  minimumMonthlyPay Decimal       @db.Decimal(15, 2)
  dueDateDay        Int?
  isPaidOff         Boolean       @default(false)

  payments          Transaction[]
}

model Budget {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  month      Int
  year       Int
  allocated  Decimal  @db.Decimal(15, 2)

  @@unique([userId, categoryId, month, year])
}

model NetWorthSnapshot {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshotMonth    Int
  snapshotYear     Int
  totalAssets      Decimal  @db.Decimal(15, 2)
  totalLiabilities Decimal  @db.Decimal(15, 2)
  netWorth         Decimal  @db.Decimal(15, 2)
  savingRatePct    Decimal  @db.Decimal(5, 2)
  createdAt        DateTime @default(now())

  @@unique([userId, snapshotMonth, snapshotYear])
}
```

## File: prisma/seed.ts
```typescript
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
```

## File: src/config/cors.ts
```typescript
import type { CorsOptions } from 'cors';
import { env } from './env.js';

export const corsOptions: CorsOptions = {
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

## File: src/config/env.ts
```typescript
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 karakter'),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Konfigurasi environment tidak valid:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
```

## File: src/config/prisma.ts
```typescript
import { PrismaClient } from '@prisma/client';
import { isProduction } from './env.js';

export const prisma = new PrismaClient({
  log: isProduction ? ['error'] : ['warn', 'error'],
});
```

## File: src/config/zod.ts
```typescript
import { z } from 'zod';

/** Default zod validation messages in Bahasa Indonesia (custom messages in schemas take precedence). */
z.config(z.locales.id());
```

## File: src/middlewares/authCookie.ts
```typescript
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const AUTH_COOKIE_NAME = 'upgrade_token';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** HttpOnly cookie. SameSite=Lax locally, SameSite=None; Secure in cross-domain production. */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}

export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: `${env.JWT_EXPIRES_IN_DAYS}d`,
  });
}

export function setAuthCookie(res: Response, userId: string): void {
  res.cookie(AUTH_COOKIE_NAME, signAuthToken(userId), {
    ...baseCookieOptions(),
    maxAge: env.JWT_EXPIRES_IN_DAYS * ONE_DAY_MS,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions());
}

export function authCookie(req: Request, _res: Response, next: NextFunction): void {
  const token: unknown = req.cookies?.[AUTH_COOKIE_NAME];

  if (typeof token !== 'string' || token.length === 0) {
    throw AppError.unauthorized('Silakan masuk terlebih dahulu.');
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw AppError.unauthorized();
    }
    req.user = { id: payload.sub };
    next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unauthorized('Sesi berakhir. Silakan masuk kembali.');
  }
}
```

## File: src/middlewares/errorHandler.ts
```typescript
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { isProduction } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Rute ${req.method} ${req.originalUrl} tidak ditemukan.`,
    data: null,
    meta: {},
  });
};

function isJsonSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError && 'status' in error && (error as { status?: number }).status === 400;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      success: false,
      message: issues[0]?.message ?? 'Data yang dikirim tidak valid.',
      data: null,
      meta: { errors: issues },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      data: null,
      meta: error.details === undefined ? {} : { details: error.details },
    });
    return;
  }

  if (isJsonSyntaxError(error)) {
    res.status(400).json({
      success: false,
      message: 'Format JSON yang dikirim tidak valid.',
      data: null,
      meta: {},
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'Data sudah ada dan tidak boleh duplikat.',
        data: null,
        meta: {},
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Data yang diminta tidak ditemukan.',
        data: null,
        meta: {},
      });
      return;
    }
  }

  if (!isProduction) {
    console.error(error);
  } else {
    console.error('Unhandled error:', error instanceof Error ? error.message : 'unknown error');
  }

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
    data: null,
    meta: {},
  });
};
```

## File: src/middlewares/rateLimiter.ts
```typescript
import { rateLimit } from 'express-rate-limit';

/** 10 requests / 15 minutes / IP on /api/v1/auth/* */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.',
      data: null,
      meta: {},
    });
  },
});
```

## File: src/middlewares/validateZod.ts
```typescript
import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates body, query and params with zod. Parsed (and transformed) values replace the originals.
 * Zod errors are thrown synchronously and forwarded by Express 5 into the centralized errorHandler.
 */
export function validateZod(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Request['params'];
    }
    if (schemas.query) {
      const parsedQuery = schemas.query.parse(req.query);
      // Express 5 exposes req.query as a getter, so it is redefined instead of assigned.
      Object.defineProperty(req, 'query', {
        value: parsedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    next();
  };
}
```

## File: src/modules/accounts/accounts.routes.ts
```typescript
import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { createAccountSchema, idParamSchema, updateAccountSchema } from './accounts.schemas.js';
import { createAccount, listAccounts, toPublicAccount, updateAccount } from './accounts.service.js';

export const accountsRouter = Router();

accountsRouter.get('/', async (req, res) => {
  const accounts = await listAccounts(requireUserId(req));
  sendSuccess(res, 'Daftar akun berhasil dimuat.', { accounts: accounts.map(toPublicAccount) });
});

accountsRouter.post('/', validateZod({ body: createAccountSchema }), async (req, res) => {
  const account = await createAccount(requireUserId(req), req.body);
  sendSuccess(res, `Akun "${account.name}" berhasil dibuat.`, { account: toPublicAccount(account) }, { status: 201 });
});

accountsRouter.patch(
  '/:id',
  validateZod({ params: idParamSchema, body: updateAccountSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    const account = await updateAccount(requireUserId(req), id, req.body);
    sendSuccess(res, `Akun "${account.name}" berhasil diperbarui.`, { account: toPublicAccount(account) });
  },
);
```

## File: src/modules/accounts/accounts.schemas.ts
```typescript
import { z } from 'zod';
import { nonNegativeMoney } from '../../utils/money.js';

export const accountTypeSchema = z.enum(['CASH', 'BANK', 'EWALLET', 'INVESTMENT', 'EMERGENCY_FUND'], {
  error: 'Jenis akun harus CASH, BANK, EWALLET, INVESTMENT, atau EMERGENCY_FUND.',
});

const accountNameSchema = z
  .string({ error: 'Nama akun wajib diisi.' })
  .trim()
  .min(1, 'Nama akun wajib diisi.')
  .max(80, 'Nama akun maksimal 80 karakter.');

export const createAccountSchema = z.object({
  name: accountNameSchema,
  type: accountTypeSchema,
  balance: nonNegativeMoney.default(() => nonNegativeMoney.parse('0')),
  isLiquid: z.boolean({ error: 'isLiquid harus berupa true atau false.' }).optional(),
});

export const updateAccountSchema = z
  .object({
    name: accountNameSchema.optional(),
    type: accountTypeSchema.optional(),
    isLiquid: z.boolean({ error: 'isLiquid harus berupa true atau false.' }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Minimal satu data akun harus diubah.',
  });

export const idParamSchema = z.object({
  id: z.string({ error: 'ID wajib diisi.' }).uuid('ID tidak valid.'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
```

## File: src/modules/accounts/accounts.service.ts
```typescript
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
```

## File: src/modules/auth/auth.routes.ts
```typescript
import { Router } from 'express';
import { authCookie, clearAuthCookie, setAuthCookie } from '../../middlewares/authCookie.js';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { loginSchema, registerSchema, updatePreferencesSchema } from './auth.schemas.js';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  toPublicUser,
  updatePreferences,
} from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', validateZod({ body: registerSchema }), async (req, res) => {
  const user = await registerUser(req.body);
  setAuthCookie(res, user.id);
  sendSuccess(res, 'Pendaftaran berhasil. Selamat datang di UPgrade!', { user: toPublicUser(user) }, { status: 201 });
});

authRouter.post('/login', validateZod({ body: loginSchema }), async (req, res) => {
  const user = await loginUser(req.body);
  setAuthCookie(res, user.id);
  sendSuccess(res, 'Berhasil masuk.', { user: toPublicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, 'Berhasil keluar.', null);
});

authRouter.get('/me', authCookie, async (req, res) => {
  const user = await getCurrentUser(requireUserId(req));
  sendSuccess(res, 'Data pengguna berhasil dimuat.', { user: toPublicUser(user) });
});

authRouter.patch('/preferences', authCookie, validateZod({ body: updatePreferencesSchema }), async (req, res) => {
  const user = await updatePreferences(requireUserId(req), req.body);
  sendSuccess(res, 'Pengaturan berhasil disimpan.', { user: toPublicUser(user) });
});
```

## File: src/modules/auth/auth.schemas.ts
```typescript
import { z } from 'zod';
import { nonNegativeMoney, percentageRate } from '../../utils/money.js';

const passwordSchema = z
  .string({ error: 'Kata sandi wajib diisi.' })
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.')
  .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
  .regex(/\d/, 'Kata sandi harus mengandung angka.');

const emailSchema = z
  .string({ error: 'Email wajib diisi.' })
  .trim()
  .toLowerCase()
  .email('Format email tidak valid.')
  .max(254, 'Email terlalu panjang.');

const nameSchema = z
  .string({ error: 'Nama wajib diisi.' })
  .trim()
  .min(1, 'Nama wajib diisi.')
  .max(100, 'Nama maksimal 100 karakter.');

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Kata sandi wajib diisi.' }).min(1, 'Kata sandi wajib diisi.'),
});

export const budgetFrameworkSchema = z.enum(['ZERO_BASED', 'RULE_50_30_20'], {
  error: 'Kerangka anggaran harus ZERO_BASED atau RULE_50_30_20.',
});

const positiveRate = percentageRate.refine((value) => value.gt(0), 'Persentase harus lebih besar dari 0.');

export const updatePreferencesSchema = z
  .object({
    name: nameSchema.optional(),
    budgetFramework: budgetFrameworkSchema.optional(),
    swrRate: positiveRate.optional(),
    inflationRate: percentageRate.optional(),
    expectedReturnRate: percentageRate.optional(),
    baselineEssential: nonNegativeMoney.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Minimal satu pengaturan harus diubah.',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
```

## File: src/modules/auth/auth.service.ts
```typescript
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
```

## File: src/modules/categories/categories.routes.ts
```typescript
import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { idParamSchema } from '../accounts/accounts.schemas.js';
import { createCategorySchema, listCategoriesQuerySchema } from './categories.schemas.js';
import { createCategory, deleteCategory, listCategories, toPublicCategory } from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', validateZod({ query: listCategoriesQuerySchema }), async (req, res) => {
  const query = req.query as { kind?: 'INCOME' | 'ESSENTIAL' | 'DISCRETIONARY' };
  const categories = await listCategories(requireUserId(req), query.kind);
  sendSuccess(res, 'Daftar kategori berhasil dimuat.', { categories: categories.map(toPublicCategory) });
});

categoriesRouter.post('/', validateZod({ body: createCategorySchema }), async (req, res) => {
  const category = await createCategory(requireUserId(req), req.body);
  sendSuccess(
    res,
    `Kategori "${category.name}" berhasil dibuat.`,
    { category: toPublicCategory(category) },
    { status: 201 },
  );
});

categoriesRouter.delete('/:id', validateZod({ params: idParamSchema }), async (req, res) => {
  await deleteCategory(requireUserId(req), String(req.params.id));
  sendSuccess(res, 'Kategori berhasil dihapus.', null);
});
```

## File: src/modules/categories/categories.schemas.ts
```typescript
import { z } from 'zod';

export const categoryKindSchema = z.enum(['INCOME', 'ESSENTIAL', 'DISCRETIONARY'], {
  error: 'Jenis kategori harus INCOME, ESSENTIAL, atau DISCRETIONARY.',
});

export const createCategorySchema = z.object({
  name: z
    .string({ error: 'Nama kategori wajib diisi.' })
    .trim()
    .min(1, 'Nama kategori wajib diisi.')
    .max(60, 'Nama kategori maksimal 60 karakter.'),
  kind: categoryKindSchema,
});

export const listCategoriesQuerySchema = z.object({
  kind: categoryKindSchema.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CategoryKind = z.infer<typeof categoryKindSchema>;
```

## File: src/modules/categories/categories.service.ts
```typescript
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
```

## File: src/modules/debts/debts.serializer.ts
```typescript
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
```

## File: src/modules/onboarding/onboarding.routes.ts
```typescript
import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { onboardingSchema } from './onboarding.schemas.js';
import { completeOnboarding } from './onboarding.service.js';

export const onboardingRouter = Router();

onboardingRouter.post('/', validateZod({ body: onboardingSchema }), async (req, res) => {
  const result = await completeOnboarding(requireUserId(req), req.body);
  sendSuccess(res, 'Onboarding selesai. Perjalanan UPgrade-mu dimulai!', result, { status: 201 });
});
```

## File: src/modules/onboarding/onboarding.schemas.ts
```typescript
import { z } from 'zod';
import { accountTypeSchema } from '../accounts/accounts.schemas.js';
import { budgetFrameworkSchema } from '../auth/auth.schemas.js';
import { nonNegativeMoney, percentageRate, positiveMoney } from '../../utils/money.js';

export const initialAccountSchema = z.object({
  name: z
    .string({ error: 'Nama akun wajib diisi.' })
    .trim()
    .min(1, 'Nama akun wajib diisi.')
    .max(80, 'Nama akun maksimal 80 karakter.'),
  type: accountTypeSchema,
  balance: nonNegativeMoney,
  isLiquid: z.boolean({ error: 'isLiquid harus berupa true atau false.' }).optional(),
});

export const initialDebtSchema = z
  .object({
    name: z
      .string({ error: 'Nama utang wajib diisi.' })
      .trim()
      .min(1, 'Nama utang wajib diisi.')
      .max(80, 'Nama utang maksimal 80 karakter.'),
    isConsumptive: z.boolean({ error: 'isConsumptive harus berupa true atau false.' }).default(true),
    totalPrincipal: positiveMoney,
    remainingBalance: nonNegativeMoney.optional(),
    annualInterestPct: percentageRate.default(() => percentageRate.parse('0')),
    interestType: z.enum(['FLAT', 'EFFECTIVE'], { error: 'Jenis bunga harus FLAT atau EFFECTIVE.' }).default('FLAT'),
    minimumMonthlyPay: nonNegativeMoney,
    dueDateDay: z
      .number({ error: 'Tanggal jatuh tempo harus berupa angka.' })
      .int('Tanggal jatuh tempo harus bilangan bulat.')
      .min(1, 'Tanggal jatuh tempo minimal 1.')
      .max(31, 'Tanggal jatuh tempo maksimal 31.')
      .optional(),
  })
  .refine((debt) => debt.remainingBalance === undefined || debt.remainingBalance.lte(debt.totalPrincipal), {
    message: 'Sisa utang tidak boleh melebihi total pokok utang.',
    path: ['remainingBalance'],
  });

export const onboardingSchema = z.object({
  baselineEssential: nonNegativeMoney,
  budgetFramework: budgetFrameworkSchema.default('ZERO_BASED'),
  accounts: z
    .array(initialAccountSchema, { error: 'Daftar akun awal wajib diisi.' })
    .min(1, 'Tambahkan minimal satu akun (misalnya Dompet Tunai atau Rekening Bank).')
    .max(20, 'Maksimal 20 akun awal.'),
  debts: z.array(initialDebtSchema).max(20, 'Maksimal 20 utang awal.').default([]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type InitialDebtInput = z.infer<typeof initialDebtSchema>;
```

## File: src/modules/onboarding/onboarding.service.ts
```typescript
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
```

## File: src/modules/transactions/transactions.routes.ts
```typescript
import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionIdParamSchema,
  type ListTransactionsQuery,
} from './transactions.schemas.js';
import {
  createTransaction,
  listTransactions,
  restoreTransaction,
  softDeleteTransaction,
} from './transactions.service.js';

export const transactionsRouter = Router();

transactionsRouter.get('/', validateZod({ query: listTransactionsQuerySchema }), async (req, res) => {
  const result = await listTransactions(requireUserId(req), req.query as unknown as ListTransactionsQuery);
  sendSuccess(res, 'Riwayat transaksi berhasil dimuat.', { transactions: result.transactions }, { meta: result.meta });
});

transactionsRouter.post('/', validateZod({ body: createTransactionSchema }), async (req, res) => {
  const result = await createTransaction(requireUserId(req), req.body);
  sendSuccess(
    res,
    'Transaksi berhasil disimpan.',
    { transaction: result.transaction, accounts: result.accounts, debt: result.debt },
    { status: 201, meta: { warnings: result.warnings } },
  );
});

transactionsRouter.delete('/:id', validateZod({ params: transactionIdParamSchema }), async (req, res) => {
  const result = await softDeleteTransaction(requireUserId(req), String(req.params.id));
  sendSuccess(
    res,
    'Transaksi dihapus. Saldo dikembalikan, kamu bisa mengurungkannya.',
    { transaction: result.transaction, accounts: result.accounts, debt: result.debt },
    { meta: { warnings: result.warnings } },
  );
});

transactionsRouter.post('/:id/restore', validateZod({ params: transactionIdParamSchema }), async (req, res) => {
  const result = await restoreTransaction(requireUserId(req), String(req.params.id));
  sendSuccess(
    res,
    'Transaksi berhasil dipulihkan.',
    { transaction: result.transaction, accounts: result.accounts, debt: result.debt },
    { meta: { warnings: result.warnings } },
  );
});
```

## File: src/modules/transactions/transactions.schemas.ts
```typescript
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

export const listTransactionsQuerySchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'DEBT_PAYMENT'], { error: 'Jenis transaksi tidak valid.' }).optional(),
    accountId: uuid('Akun').optional(),
    categoryId: uuid('Kategori').optional(),
    from: z.coerce.date({ error: 'Tanggal awal tidak valid.' }).optional(),
    to: z.coerce.date({ error: 'Tanggal akhir tidak valid.' }).optional(),
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
```

## File: src/modules/transactions/transactions.service.ts
```typescript
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
```

## File: src/utils/AppError.ts
```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, message, details);
  }

  static unauthorized(message = 'Sesi tidak valid. Silakan masuk kembali.'): AppError {
    return new AppError(401, message);
  }

  static notFound(message: string): AppError {
    return new AppError(404, message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, message);
  }
}
```

## File: src/utils/defaultCategories.ts
```typescript
import type { ExpenseClass } from '@prisma/client';

export interface DefaultCategory {
  name: string;
  expenseClass: ExpenseClass | null;
}

/** Default system categories seeded per user. `expenseClass: null` marks an INCOME category. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  // Pemasukan (INCOME)
  { name: 'Gaji', expenseClass: null },
  { name: 'Bonus & THR', expenseClass: null },
  { name: 'Usaha Sampingan', expenseClass: null },
  { name: 'Hasil Investasi', expenseClass: null },
  { name: 'Hadiah & Lainnya', expenseClass: null },

  // Kebutuhan (ESSENTIAL)
  { name: 'Makan & Kebutuhan Dapur', expenseClass: 'ESSENTIAL' },
  { name: 'Tempat Tinggal (Sewa/KPR)', expenseClass: 'ESSENTIAL' },
  { name: 'Listrik, Air & Internet', expenseClass: 'ESSENTIAL' },
  { name: 'Transportasi', expenseClass: 'ESSENTIAL' },
  { name: 'Kesehatan & BPJS', expenseClass: 'ESSENTIAL' },
  { name: 'Pendidikan', expenseClass: 'ESSENTIAL' },
  { name: 'Asuransi', expenseClass: 'ESSENTIAL' },

  // Keinginan (DISCRETIONARY)
  { name: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY' },
  { name: 'Makan di Luar', expenseClass: 'DISCRETIONARY' },
  { name: 'Hiburan & Langganan', expenseClass: 'DISCRETIONARY' },
  { name: 'Belanja Online', expenseClass: 'DISCRETIONARY' },
  { name: 'Hobi & Gaya Hidup', expenseClass: 'DISCRETIONARY' },
  { name: 'Liburan', expenseClass: 'DISCRETIONARY' },
];
```

## File: src/utils/money.ts
```typescript
import { Decimal } from 'decimal.js';
import { z } from 'zod';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const ZERO = new Decimal(0);

const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;
const RATE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

/** Strictly positive monetary string (e.g. "20000" or "20000.50") converted immediately to Decimal. */
export const positiveMoney = z
  .string({ error: 'Nominal wajib diisi dalam bentuk angka.' })
  .trim()
  .regex(MONEY_PATTERN, 'Nominal harus berupa angka positif dengan maksimal 2 digit desimal.')
  .transform((value) => new Decimal(value))
  .refine((value) => value.gt(0), 'Nominal harus lebih besar dari Rp0.');

/** Non-negative monetary string (zero allowed) converted immediately to Decimal. */
export const nonNegativeMoney = z
  .string({ error: 'Nominal wajib diisi dalam bentuk angka.' })
  .trim()
  .regex(MONEY_PATTERN, 'Nominal tidak boleh negatif dan maksimal 2 digit desimal.')
  .transform((value) => new Decimal(value));

/** Percentage / rate string between 0 and 100 (inclusive) converted to Decimal. */
export const percentageRate = z
  .string({ error: 'Persentase wajib diisi dalam bentuk angka.' })
  .trim()
  .regex(RATE_PATTERN, 'Persentase harus berupa angka dengan maksimal 2 digit desimal.')
  .transform((value) => new Decimal(value))
  .refine((value) => value.lte(100), 'Persentase tidak boleh lebih dari 100.');

/** Serialises any Decimal-like value to a fixed 2-decimal string for API responses. */
export function toMoneyString(value: Decimal.Value): string {
  return new Decimal(value).toFixed(2);
}

export function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function formatRupiah(value: Decimal.Value): string {
  const amount = new Decimal(value);
  const [integerPart = '0', fraction = '00'] = amount.abs().toFixed(2).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = amount.isNegative() && !amount.isZero() ? '-' : '';
  return fraction === '00' ? `${sign}Rp${grouped}` : `${sign}Rp${grouped},${fraction}`;
}
```

## File: src/utils/requestUser.ts
```typescript
import type { Request } from 'express';
import { AppError } from './AppError.js';

export interface AuthUser {
  id: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Returns the authenticated user id or throws 401. Every query must be scoped by this id (IDOR prevention). */
export function requireUserId(req: Request): string {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user.id;
}
```

## File: src/utils/response.ts
```typescript
import type { Response } from 'express';

export interface ApiEnvelope<T, M> {
  success: boolean;
  message: string;
  data: T;
  meta: M;
}

export function sendSuccess<T, M extends object = Record<string, never>>(
  res: Response,
  message: string,
  data: T,
  options: { status?: number; meta?: M } = {},
): Response {
  const body: ApiEnvelope<T, M | Record<string, never>> = {
    success: true,
    message,
    data,
    meta: options.meta ?? {},
  };
  return res.status(options.status ?? 200).json(body);
}
```

## File: src/app.ts
```typescript
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import './config/zod.js';
import { corsOptions } from './config/cors.js';
import { isProduction } from './config/env.js';
import { authCookie } from './middlewares/authCookie.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { authRateLimiter } from './middlewares/rateLimiter.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { onboardingRouter } from './modules/onboarding/onboarding.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';

export function createApp(): Express {
  const app = express();

  // Required behind Render/Railway proxies so secure cookies and rate limiting use the real client IP.
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, message: 'UPgrade API berjalan dengan baik.', data: { status: 'ok' }, meta: {} });
  });

  app.use('/api/v1/auth', authRateLimiter, authRouter);
  app.use('/api/v1/onboarding', authCookie, onboardingRouter);
  app.use('/api/v1/accounts', authCookie, accountsRouter);
  app.use('/api/v1/categories', authCookie, categoriesRouter);
  app.use('/api/v1/transactions', authCookie, transactionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

## File: src/server.ts
```typescript
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`UPgrade API berjalan di port ${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} diterima. Menutup server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

## File: package.json
```json
{
  "name": "upgrade-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "UPgrade API - Personal Finance Tracker & 7-Level Financial Freedom Roadmap",
  "main": "dist/src/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/server.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:validate": "prisma validate",
    "prisma:migrate": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "argon2": "^0.45.2",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "decimal.js": "^10.6.0",
    "dotenv": "^18.0.10",
    "express": "^5.3.0",
    "express-rate-limit": "^8.7.5",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.3",
    "pdfkit": "^0.21.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^26.6.6",
    "@types/pdfkit": "^0.17.7",
    "prisma": "^6.19.3",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2",
    "vitest": "^5.1.1"
  }
}
```

## File: prisma.config.ts
```typescript
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
```

## File: tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts", "prisma/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```
