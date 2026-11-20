# Patch Backend 1A+ Playbook — UPgrade (Antigravity)

Dokumen ini adalah spesifikasi teknis dan panduan eksekusi **Patch Backend 1A+** sebelum memasuki **Fase 1B (Frontend SPA Core)**. Simpan file ini di root repositori `upgrade-app/` (sejajar dengan `UPGRADE_ANTIGRAVITY_PROMPT.md`).

---

## 1. Ringkasan Tujuan Patch 1A+

Audit kode pada Fase 1A menunjukkan fondasi backend sudah sangat solid (ACID transaction, `decimal.js`, proteksi IDOR, Argon2, dan Express 5). Namun terdapat **5 celah & *blocker*** yang wajib dibereskan sebelum integrasi Frontend:

1. **Bug Scope `authRateLimiter` (Kritis):** Saat ini dipasang global di `/api/v1/auth`, sehingga `GET /auth/me` ikut terblokir HTTP `429` setelah 10 kali *refresh* halaman di React.
2. **Validasi `baselineEssential`:** Saat ini memakai `nonNegativeMoney` sehingga nilai `"0"` lolos dan berisiko membuat target Dana Darurat/FIRE menjadi Rp0.
3. **Bug Filter Tanggal Akhir (`to`) pada `GET /api/v1/transactions`:** String tanggal tanpa jam (`YYYY-MM-DD`) saat ini ter-parse menjadi `00:00:00.000Z`, memotong transaksi yang terjadi pada hari terakhir filter.
4. **Normalisasi `CLIENT_URL`:** Menghapus *trailing slash* agar pengecekan header `Origin` pada CORS tidak gagal.
5. **Dua Endpoint *Blocker* untuk Frontend Fase 1B:**
   * `GET /api/v1/debts` (dibutuhkan oleh `QuickAddModal` untuk pilihan utang aktif pada tipe `DEBT_PAYMENT`).
   * `GET /api/v1/dashboard/summary` (dibutuhkan oleh Dashboard v1 untuk *Cash Flow*, *Saving Rate*, *Net Worth*, dan *Category Monthly Spent* yang dihitung di server memakai `decimal.js`).

---

## 2. Konvensi Wajib yang Harus Dipertahankan

Seluruh perubahan kode pada Patch 1A+ **wajib** mengikuti konvensi yang sudah berjalan di `server/`:

* **ESM Imports:** Semua import relatif wajib menyertakan ekstensi `.js` (sesuai `moduleResolution: "NodeNext"`).
* **Zod v4:** Gunakan sintaks Zod v4 (`{ error: '...' }`) sebagaimana digunakan di schema yang sudah ada.
* **Zero Floating-Point Math:** Seluruh penjumlahan, pengurangan, pembagian, dan persentase uang wajib memakai `Decimal` dari `decimal.js` dan diserialisasi memakai `toMoneyString(...)` (2 digit desimal).
* **IDOR Prevention:** Seluruh query Prisma wajib difilter berdasarkan `userId: requireUserId(req)`.
* **Bahasa:** Kode/komentar/identifier dalam bahasa Inggris; seluruh pesan `message`, error validasi Zod, dan notifikasi dalam **Bahasa Indonesia**.
* **Zero Placeholders:** Dilarang keras menulis `// TODO` atau implementasi setengah jadi.

---

## 3. Spesifikasi Teknis Per File

### Perbaikan 1 — Batasi `authRateLimiter` Khusus `/register` & `/login`
* **File:** `server/src/app.ts` & `server/src/modules/auth/auth.routes.ts`
* **Perubahan di `server/src/app.ts`:**
  * Hapus `authRateLimiter` dari pemanggilan `app.use('/api/v1/auth', authRouter);` dan hapus import `authRateLimiter` dari `app.ts` jika tidak dipakai di tempat lain.
* **Perubahan di `server/src/modules/auth/auth.routes.ts`:**
  * Import `authRateLimiter` dari `../../middlewares/rateLimiter.js`.
  * Pasang `authRateLimiter` **hanya** pada:
    * `authRouter.post('/register', authRateLimiter, validateZod({ body: registerSchema }), ...)`
    * `authRouter.post('/login', authRateLimiter, validateZod({ body: loginSchema }), ...)`
  * Pastikan `POST /logout`, `GET /me`, dan `PATCH /preferences` **tidak** terkena `authRateLimiter`.

---

### Perbaikan 2 — Wajibkan `baselineEssential` Bernilai Positif (> Rp0)
* **File:**
  * `server/src/modules/onboarding/onboarding.schemas.ts`
  * `server/src/modules/auth/auth.schemas.ts`
* **Perubahan:**
  * Di `onboardingSchema`: ubah `baselineEssential: nonNegativeMoney` menjadi `baselineEssential: positiveMoney`.
  * Di `updatePreferencesSchema` (`auth.schemas.ts`): import `positiveMoney` dari `../../utils/money.js`, lalu ubah `baselineEssential: nonNegativeMoney.optional()` menjadi `baselineEssential: positiveMoney.optional()`.

---

### Perbaikan 3 — Normalisasi `CLIENT_URL` (Anti Trailing Slash CORS)
* **File:** `server/src/config/env.ts`
* **Perubahan:**
  * Ubah validasi `CLIENT_URL` menjadi:
    ```typescript
    CLIENT_URL: z
      .string()
      .url()
      .transform((value) => value.replace(/\/+$/, '')),
    ```

---

### Perbaikan 4 — Normalisasi Filter Tanggal `from` & `to` (Anti Terpotong Tengah Malam)
* **File:** `server/src/modules/transactions/transactions.schemas.ts`
* **Masalah:** `z.coerce.date()` mengubah `"2026-11-30"` menjadi `2026-11-30T00:00:00.000Z`.
* **Solusi:** Buat helper Zod schema `parseFilterDate(boundary: 'start' | 'end', errorMessage: string)`:
  * Terima input string (dari query params).
  * Jika cocok dengan pola tanggal saja `/^\d{4}-\d{2}-\d{2}$/`:
    * Untuk `boundary === 'start'`: bentuk `new Date(`${value}T00:00:00.000+07:00`)` (awal hari WIB).
    * Untuk `boundary === 'end'`: bentuk `new Date(`${value}T23:59:59.999+07:00`)` (akhir hari WIB).
    * Validasi tambahan: pastikan tanggal kalender valid (misal tolak `"2026-02-31"` dengan memverifikasi tahun/bulan/hari hasil konversi cocok dengan input).
  * Jika bukan pola tanggal saja (misal sudah full ISO-8601 seperti `2026-11-30T23:59:59.999+07:00` atau `...Z`): parse dengan `new Date(value)` dan pastikan `!Number.isNaN(date.getTime())`.
  * Terapkan `parseFilterDate('start', 'Tanggal awal tidak valid.').optional()` untuk `from` dan `parseFilterDate('end', 'Tanggal akhir tidak valid.').optional()` untuk `to`.
  * Pertahankan `.refine((value) => !value.from || !value.to || value.from.getTime() <= value.to.getTime(), ...)`.

---

### Perbaikan 5A — Endpoint Read Utang (`GET /api/v1/debts`)
* **File Baru:**
  * `server/src/modules/debts/debts.schemas.ts`
  * `server/src/modules/debts/debts.service.ts`
  * `server/src/modules/debts/debts.routes.ts`
* **File Diperbarui:** `server/src/app.ts` (daftarkan `app.use('/api/v1/debts', authCookie, debtsRouter);`)
* **Spesifikasi Query & Validasi (`debts.schemas.ts`):**
  * **Peringatan Penting:** JANGAN gunakan `z.coerce.boolean()` untuk query string karena `Boolean("false") === true` di JavaScript!
  * Gunakan parser eksplisit:
    ```typescript
    export const listDebtsQuerySchema = z.object({
      activeOnly: z
        .enum(['true', 'false'], { error: 'activeOnly harus berupa true atau false.' })
        .transform((value) => value === 'true')
        .optional(),
    });
    ```
* **Spesifikasi Service (`debts.service.ts`):**
  * `listDebts(userId: string, activeOnly?: boolean): Promise<Debt[]>`
  * Filter `where: { userId, ...(activeOnly ? { isPaidOff: false } : {}) }`.
  * Urutkan berdasarkan `orderBy: [{ isPaidOff: 'asc' }, { remainingBalance: 'asc' }, { name: 'asc' }]`.
* **Kontrak Respons (`GET /api/v1/debts`):**
  * Gunakan `toPublicDebt` dari `./debts.serializer.js` dan `sendSuccess`.
  * Format respons:
    ```json
    {
      "success": true,
      "message": "Daftar utang berhasil dimuat.",
      "data": {
        "debts": []
      },
      "meta": {}
    }
    ```

---

### Perbaikan 5B — Endpoint Ringkasan Dashboard v1 (`GET /api/v1/dashboard/summary`)
* **File Baru:**
  * `server/src/modules/dashboard/dashboard.schemas.ts`
  * `server/src/modules/dashboard/dashboard.service.ts`
  * `server/src/modules/dashboard/dashboard.routes.ts`
* **File Diperbarui:** `server/src/app.ts` (daftarkan `app.use('/api/v1/dashboard', authCookie, dashboardRouter);`)
* **Spesifikasi Query (`dashboard.schemas.ts`):**
  * `year`: opsional, integer `2000`–`2100` (default: tahun saat ini pada zona waktu WIB `+07:00`).
  * `month`: opsional, integer `1`–`12` (default: bulan saat ini `1–12` pada zona waktu WIB `+07:00`).
* **Batas Periode Bulan (Akurat & Tanpa Celah Milidetik):**
  * Gunakan batas interval setengah-terbuka `[start, nextMonthStart)` dalam WIB (`+07:00`):
    * `start`: `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+07:00`
    * `nextMonthStart`: tanggal 1 bulan berikutnya pukul `00:00:00.000+07:00` (jika `month === 12`, maka `${year + 1}-01-01T00:00:00.000+07:00`).
  * Filter Prisma: `transactionDate: { gte: start, lt: nextMonthStart }, deletedAt: null`.
* **Aturan Perhitungan (`decimal.js` Wajib 100%):**
  * Ambil secara paralel (`Promise.all`):
    1. Semua `Account` milik `userId` (`select: { balance: true }`).
    2. Semua `Debt` aktif milik `userId` (`where: { userId, isPaidOff: false }, select: { remainingBalance: true }`).
    3. Semua `Transaction` milik `userId` pada periode `[start, nextMonthStart)` dengan `deletedAt: null` (`select: { type: true, amount: true, categoryId: true, category: { select: { expenseClass: true } } }`).
  * **Perhitungan Cash Flow (Mengecualikan `TRANSFER` sepenuhnya):**
    * `totalIncome` = jumlah `amount` untuk `type === 'INCOME'`.
    * `essentialExpense` = jumlah `amount` untuk `type === 'EXPENSE'` dan `category?.expenseClass === 'ESSENTIAL'`.
    * `discretionaryExpense` = jumlah `amount` untuk `type === 'EXPENSE'` dan `category?.expenseClass === 'DISCRETIONARY'`.
    * `totalExpense` = jumlah seluruh `amount` untuk `type === 'EXPENSE'`.
    * `debtPaymentTotal` = jumlah `amount` untuk `type === 'DEBT_PAYMENT'`.
    * `surplus` = `totalIncome.minus(totalExpense)`.
    * `savingRatePct` = jika `totalIncome.isZero()`, bernilai `ZERO`; selain itu `surplus.div(totalIncome).times(100)`.
  * **Perhitungan Net Worth:**
    * `totalAssets` = jumlah seluruh `account.balance`.
    * `totalLiabilities` = jumlah seluruh `debt.remainingBalance` yang belum lunas (`isPaidOff: false`).
    * `netWorth` = `totalAssets.minus(totalLiabilities)`.
  * **Perhitungan `categoryMonthlySpent`:**
    * Agregasi total `amount` per `categoryId` khusus transaksi `type === 'EXPENSE'` (yang memiliki `categoryId !== null`), kembalikan array `{ categoryId: string, spent: string }` terurut dari `spent` terbesar.
* **Kontrak Respons (`GET /api/v1/dashboard/summary`):**
  ```json
  {
    "success": true,
    "message": "Ringkasan dashboard berhasil dimuat.",
    "data": {
      "period": { "year": 2026, "month": 11 },
      "cashFlow": {
        "totalIncome": "5000000.00",
        "totalExpense": "3200000.00",
        "essentialExpense": "2100000.00",
        "discretionaryExpense": "1100000.00",
        "debtPaymentTotal": "500000.00",
        "surplus": "1800000.00",
        "savingRatePct": "36.00"
      },
      "netWorth": {
        "totalAssets": "12500000.00",
        "totalLiabilities": "2000000.00",
        "netWorth": "10500000.00"
      },
      "categoryMonthlySpent": [
        { "categoryId": "uuid", "spent": "450000.00" }
      ]
    },
    "meta": {}
  }
  ```

---

## 4. Prompt Siap Salin untuk Agent Antigravity

```text
Execute **Patch Backend 1A+** strictly according to @PATCH_1A_PLUS_ANTIGRAVITY.md and the workspace rules in @.agent/rules/upgrade-rules.md.

Scope of work (Backend `server/` ONLY — do NOT create `client/` yet):
1. Move `authRateLimiter` out of `server/src/app.ts` and attach it ONLY to `POST /register` and `POST /login` in `server/src/modules/auth/auth.routes.ts` so `GET /auth/me`, `POST /auth/logout`, and `PATCH /auth/preferences` are never rate-limited.
2. Change `baselineEssential` from `nonNegativeMoney` to `positiveMoney` in both `server/src/modules/onboarding/onboarding.schemas.ts` and `server/src/modules/auth/auth.schemas.ts`.
3. Strip trailing slashes from `CLIENT_URL` in `server/src/config/env.ts`.
4. Fix date-only `from`/`to` query parsing in `server/src/modules/transactions/transactions.schemas.ts` (WIB `+07:00` start-of-day / end-of-day for `YYYY-MM-DD`, calendar date validation, and pass-through for full ISO-8601 timestamps).
5. Implement `GET /api/v1/debts` (supporting `?activeOnly=true|false` using explicit enum parsing, NOT `z.coerce.boolean()`) reusing `toPublicDebt` and mounted under `authCookie` in `server/src/app.ts`.
6. Implement `GET /api/v1/dashboard/summary?year=YYYY&month=MM` using `decimal.js` strictly (zero JS number math on money), WIB `[start, nextMonthStart)` boundaries, excluding `TRANSFER` from Cash Flow & Saving Rate, and returning `period`, `cashFlow`, `netWorth`, and `categoryMonthlySpent`.
7. Add focused Vitest tests in `server/src/__tests__/patch1a.test.ts` testing:
   - `parseFilterDate` / `listTransactionsQuerySchema` (`YYYY-MM-DD` end-of-day, invalid date like `2026-02-31`, `from > to`).
   - `onboardingSchema` & `updatePreferencesSchema` rejecting `baselineEssential: "0"`.
   - `listDebtsQuerySchema` parsing `"false"` -> `false` and `"true"` -> `true`.
   - Dashboard summary calculation helper (pure function using `decimal.js`: excluding `TRANSFER`, zero-income `savingRatePct === "0.00"`, `essentialExpense` vs `discretionaryExpense`, `netWorth`, and `categoryMonthlySpent`).

After making all edits, run in `server/`:
- `npm run typecheck`
- `npm run build`
- `npm test`

Fix any compiler or test errors before reporting completion. Summarize all modified/created files and confirm readiness for Phase 1B (Frontend SPA Core).
```

---

## 5. Checklist Verifikasi Sebelum Masuk Fase 1B (Frontend)

Pastikan seluruh poin berikut berstatus **PASS** setelah Agent Antigravity selesai mengeksekusi Patch 1A+:

* [ ] `npm run typecheck` di `server/` lulus dengan 0 error.
* [ ] `npm run build` di `server/` lulus tanpa warning ESM/TypeScript.
* [ ] `npm test` (Vitest) lulus untuk seluruh skenario Patch 1A+.
* [ ] Uji manual/curl: panggil `GET /api/v1/auth/me` sebanyak **15 kali berturut-turut** $\rightarrow$ seluruhnya tetap `200 OK` (atau `401` jika belum login), **tidak** pernah `429`.
* [ ] Uji manual/curl: panggil `POST /api/v1/onboarding` dengan `"baselineEssential": "0"` $\rightarrow$ ditolak `400 Bad Request`.
* [ ] Uji manual/curl: panggil `GET /api/v1/debts?activeOnly=true` $\rightarrow$ hanya mengembalikan utang yang `isPaidOff === false`.
* [ ] Uji manual/curl: panggil `GET /api/v1/dashboard/summary` setelah ada transaksi `INCOME`, `EXPENSE`, `TRANSFER`, dan `DEBT_PAYMENT` $\rightarrow$ `TRANSFER` tidak masuk ke `totalIncome`/`totalExpense`, dan `netWorth = totalAssets - totalLiabilities`.