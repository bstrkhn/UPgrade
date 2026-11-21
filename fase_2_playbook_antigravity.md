# Phase 2 Playbook: Patch 1B, Budgeting, Emergency Fund, Latte Factor & Gamification L1–L4 — UPgrade (Antigravity)

Dokumen ini adalah spesifikasi teknis lengkap sekaligus *playbook* eksekusi **Patch 1B + Fase 2** lintas `server/` dan `client/` untuk proyek **UPgrade**.

Simpan file ini di root repositori `upgrade-app/` (sejajar dengan `server/`, `client/`, dan `PHASE_1B_FRONTEND_ANTIGRAVITY.md`).

## 1. Ringkasan Ruang Lingkup & Status Skema Database

* **Status Database (`server/prisma/schema.prisma`):** **TIDAK PERLU migrasi skema baru.** Seluruh model dan kolom yang dibutuhkan Fase 2 (`Budget` dengan `@@unique([userId, categoryId, month, year])`, `User.budgetFramework`, `User.baselineEssential`, `User.currentLevel`, `User.highestLevel`, `User.healthStatus`, `Account.type = EMERGENCY_FUND | INVESTMENT`, `Debt.isConsumptive`) sudah tersedia di database sejak Fase 1A.
* **Cakupan Pekerjaan Fase 2:**
  1. **Patch 1B (`client/`):** Menutup 4 bug fungsional + 2 polesan hasil audit kode Fase 1B sebelum membangun fitur baru.
  2. **Backend Fase 2 (`server/`):** Mesin kalkulasi `financialMath.ts` berbasis `decimal.js`, modul `budgets` (`ZERO_BASED` & `RULE_50_30_20`), modul `analytics` (`GET /api/v1/analytics/dashboard` dengan persistensi level otomatis + *Recovery Mode*), dan *unit test* Vitest komprehensif.
  3. **Frontend Fase 2 (`client/`):** Halaman `BudgetPage` (`/budgets`), upgrade `QuickAddModal` dengan sisa anggaran kategori *real-time*, serta upgrade `DashboardPage` ke **Dashboard v2** (*MilestoneBadge* dinamis, *EmergencyFundCard*, *LatteFactorCard* + modal *opportunity cost* 5 & 10 tahun, dan *LevelMissionsCard*).
* **Di Luar Scope Fase 2 (Masuk Fase 3):** CRUD & Simulator Utang *Debt Destroyer* (`Snowball`/`Avalanche`), Kalkulator FIRE penuh (Level 5–7), *Net Worth Snapshots* historis, dan *Export PDF* (`PDFKit`).

## 2. Spesifikasi Patch 1B (`client/` — Wajib Dikerjakan Pertama)

Perbaiki 4 bug nyata dan 2 polesan arsitektur berikut pada `client/` sebelum menambah fitur Fase 2:

### 2.1 Bug #1 — Opsi *"Tanpa Kategori"* pada Tab `INCOME` Tidak Bisa Dipilih
* **File:** `client/src/components/transactions/QuickAddModal.tsx`
* **Akar Masalah:** `useEffect` yang menyetel kategori *default* menyertakan `categoryId` di *dependency array* dan menimpa `categoryId === ''` kembali ke `incomeCategories[0].id`.
* **Perbaikan:** Pada cabang `tab === 'INCOME'`, hanya reset `categoryId` jika `categoryId !== ''` **dan** tidak ada di `incomeCategories` (misalnya saat baru pindah dari tab `EXPENSE`). Biarkan `categoryId === ''` (*Tanpa Kategori*) tetap valid untuk `INCOME`.

### 2.2 Bug #2 — Kolom *Sisa Pokok Utang* Nyangkut di Digit Pertama saat Mengetik
* **File:** `client/src/pages/OnboardingPage.tsx`
* **Akar Masalah:** Saat mengetik `totalPrincipal`, kode menulis `remainingBalance: item.remainingBalance || val` sehingga begitu digit pertama masuk (`"2"`), ketikan berikutnya (`"2000000"`) tidak lagi menyinkronkan `remainingBalance`.
* **Perbaikan:** Tambahkan properti `remainingTouched: boolean` (default `false`) pada interface `DraftDebt`.
  * Saat `totalPrincipal` berubah: jika `!item.remainingTouched`, sinkronkan `remainingBalance = val`.
  * Saat pengguna mengetik langsung di kolom `Sisa Pokok Utang Saat Ini`: ubah `remainingTouched: true`.

### 2.3 Bug #3 — Sesi Kedaluwarsa (`401`) Tidak Langsung Mengarahkan ke `/login`
* **File:** `client/src/api/client.ts` dan `client/src/main.tsx`
* **Akar Masalah:** `useMe()` memiliki `staleTime: 5 * 60 * 1000`, sehingga jika cookie kedaluwarsa saat pengguna aktif, mutasi gagal `401` tetapi `ProtectedAppRoute` tetap menganggap pengguna login selama maksimal 5 menit.
* **Perbaikan:**
  * Di `client/src/api/client.ts`, ekspor fungsi `registerUnauthorizedHandler(handler: () => void)`.
  * Di *response interceptor* saat `status === 401`: jika URL request **bukan** `/auth/login`, `/auth/register`, atau `/auth/me`, panggil handler tersebut.
  * Di `client/src/main.tsx`, daftarkan handler: `registerUnauthorizedHandler(() => { queryClient.setQueryData(queryKeys.auth.me, null); })`. Dengan demikian `ProtectedAppRoute` langsung memindahkan pengguna ke `/login` secara mulus tanpa *hard reload loop*.

### 2.4 Bug #4 — Terjebak di Halaman Kosong Setelah Menghapus Transaksi Terakhir di Halaman > 1
* **File:** `client/src/pages/TransactionsPage.tsx`
* **Perbaikan:** Tambahkan `useEffect`:
  ```typescript
  useEffect(() => {
    if (transactionsQuery.data && page > transactionsQuery.data.meta.totalPages) {
      setPage(transactionsQuery.data.meta.totalPages);
    }
  }, [transactionsQuery.data, page]);
  ```

### 2.5 Polesan #5 — Akurasi Bulan pada Transaksi *Backdate* di `QuickAddModal`
* **File:** `client/src/components/transactions/QuickAddModal.tsx`
* **Perbaikan:** Turunkan `selectedPeriod` (`{ year, month }`) dari `transactionDate` (bukan selalu bulan berjalan saat ini) saat mengambil ringkasan pengeluaran kategori dan budget bulanan, agar saat pengguna mencatat transaksi bulan lalu, teks sisa budget & toast sesuai dengan bulan transaksi tersebut.

### 2.6 Polesan #6 — Hilangkan *Cross-Page Coupling*
* **File Baru:** `client/src/utils/constants.ts`
* **Perbaikan:** Pindahkan `ACCOUNT_TYPE_LABELS` (dari `DashboardPage.tsx`) dan `LEVEL_TITLES_ID` (dari `LevelBadge.tsx`) ke `client/src/utils/constants.ts`, lalu impor dari sana di `DashboardPage.tsx`, `AccountsPage.tsx`, `LevelBadge.tsx`, dan komponen Fase 2.

## 3. Spesifikasi Backend Fase 2 (`server/`)

Semua aturan Fase 1A+ tetap berlaku ketat: **ESM `.js` import**, **Zod v4**, **100% `decimal.js` (`precision: 40`, `ROUND_HALF_UP`)**, **anti-IDOR (`userId` scoping)**, dan **pesan Bahasa Indonesia**.

### 3.1 Mesin Kalkulasi Finansial (`server/src/utils/financialMath.ts`)

Buat file `server/src/utils/financialMath.ts` berisi fungsi murni (*pure functions*, tanpa akses Prisma langsung agar mudah diuji unit test). Gunakan `Decimal` dari `decimal.js` dan `ZERO`, `toMoneyString` dari `./money.js`.

#### A. `calculateEmergencyFundTarget(params)`
* **Input:**
  * `historicalMonthlyEssentials: Decimal[]` — total pengeluaran `ESSENTIAL` per bulan unik dari maksimal 6 bulan terakhir (termasuk bulan periode yang diminta bila ada transaksi `ESSENTIAL`).
  * `baselineEssential: Decimal` — dari `user.baselineEssential`.
  * `emergencyFundBalance: Decimal` — jumlah saldo seluruh akun bertipe `EMERGENCY_FUND`.
  * `currentLevel: number` — digunakan untuk menentukan `activeTargetMonths` (`1` untuk Level 1–3, `3` untuk Level 4+).
* **Aturan Perhitungan:**
  * Jika `historicalMonthlyEssentials.length >= 3`:
    * `dataSource = 'ACTUAL_HISTORICAL'`, `badge = 'Data Aktual'`.
    * `monthlyBasis` = rata-rata `historicalMonthlyEssentials` (total dibagi jumlah bulan).
  * Jika `< 3`:
    * `dataSource = 'ONBOARDING_BASELINE'`, `badge = 'Estimasi Awal'`.
    * `monthlyBasis = baselineEssential`.
  * **Proteksi Pembagian Nol:** Jika `monthlyBasis.lte(0)`, set `monthsCovered = ZERO` dan `progressPct = ZERO`.
  * Target nominal:
    * $\text{target1Month} = \text{monthlyBasis} \times 1$
    * $\text{target3Months} = \text{monthlyBasis} \times 3$
    * $\text{target6Months} = \text{monthlyBasis} \times 6$
    * `activeTargetMonths`: `currentLevel >= 4 ? 3 : 1` (dan `idealTargetMonths = 6`).
    * `activeTargetAmount` = $\text{monthlyBasis} \times \text{activeTargetMonths}$.
    * `monthsCovered` = $\max\left(0, \frac{\text{emergencyFundBalance}}{\text{monthlyBasis}}\right)$.
    * `shortfallToActiveTarget` = $\max(0, \text{activeTargetAmount} - \text{emergencyFundBalance})$.
    * `progressPct` = $\text{clamp}\left(0, 100, \frac{\text{emergencyFundBalance}}{\text{activeTargetAmount}} \times 100\right)$.
* **Output:** Semua nominal & persentase diserialisasi via `toMoneyString(...)`, ditambah `dataSource`, `badge`, `historyMonthsCount`, `activeTargetMonths`.

#### B. `detectLatteFactors(params)`
* **Input:**
  * `transactions`: daftar transaksi 30 hari terakhir bertipe `EXPENSE` (`deletedAt: null`) berisi `{ categoryId: string; categoryName: string; expenseClass: ExpenseClass | null; amount: Decimal }`.
  * `monthlyIncome: Decimal` — total `INCOME` pada periode bulan berjalan.
  * `expectedReturnRatePct: Decimal` — dari `user.expectedReturnRate` (default `10.00`).
* **Aturan Perhitungan:**
  1. **Ambang Nominal Mikro Dinamis:**
     $$\text{microThreshold} = \begin{cases} \min(0.05 \times \text{monthlyIncome}, 100000) & \text{jika } \text{monthlyIncome} > 0 \\ 50000 & \text{jika } \text{monthlyIncome} = 0 \end{cases}$$
  2. **Penyaringan Ketat:** Hanya proses transaksi dengan `expenseClass === 'DISCRETIONARY'` **dan** `amount.lte(microThreshold)`. Abaikan seluruh kategori `ESSENTIAL` sekecil apa pun nominalnya.
  3. **Agregasi:** Kelompokkan per `categoryId`. Hanya sertakan kategori dengan frekuensi `count >= 3`.
  4. **Proyeksi Tahunan & *Opportunity Cost* Investasi (5 Tahun & 10 Tahun):**
     Untuk setiap kategori dengan total bulanan $P = \text{monthlyTotal}$ dan suku bunga bulanan $r_m = \frac{\text{expectedReturnRatePct}}{100 \times 12}$:
     * $\text{annualizedProjection} = P \times 12$
     * Nilai masa depan (*Future Value of Ordinary Monthly Annuity*) untuk $n \in \{60, 120\}$ bulan:
       $$FV(P, r_m, n) = \begin{cases} P \times n & \text{jika } r_m = 0 \\ P \times \frac{(1 + r_m)^n - 1}{r_m} & \text{jika } r_m > 0 \end{cases}$$
       Hitung seluruh pangkat memakai `Decimal.pow(n)` di `decimal.js` (**dilarang** memakai `Math.pow`).
  5. Urutkan hasil berdasarkan `annualizedProjection` terbesar ke terkecil, serta hitung ringkasan total (`totalMonthlyLeak`, `totalAnnualLeak`, `totalOpportunityCost5Yr`, `totalOpportunityCost10Yr`, `microThresholdUsed`).

#### C. `evaluateMilestoneLevel(params)`
* **Input:**
  * `previousHighestLevel: number`
  * `monthlySurplus: Decimal`
  * `hasPeriodTransactions: boolean`
  * `consumptiveDebtBalance: Decimal` (total `remainingBalance` dari utang dengan `isConsumptive === true` dan `isPaidOff === false`)
  * `emergencyFundBalance: Decimal` (total `balance` dari akun bertipe `EMERGENCY_FUND`)
  * `monthlyEssentialBasis: Decimal` (dari `calculateEmergencyFundTarget`)
  * `investmentPortfolio: Decimal` (total `balance` dari akun bertipe `INVESTMENT`)
  * `swrRatePct: Decimal` (dari `user.swrRate`, default `4.00`)
* **Aturan Penentuan Level (Konsisten dengan Onboarding & Anti False-Downgrade Awal Bulan):**
  * Jika `monthlyEssentialBasis.lte(0)`: kembalikan Level `1` secara aman (tanpa pembagian nol).
  * Hitung metrik:
    * $\text{efMonths} = \frac{\text{emergencyFundBalance}}{\text{monthlyEssentialBasis}}$
    * $\text{annualEssential} = \text{monthlyEssentialBasis} \times 12$
    * $\text{fireNumber} = \frac{\text{annualEssential}}{\text{swrRatePct} / 100}$
    * $\text{abundantNumber} = \text{fireNumber} \times 2$
  * Evaluasi berjenjang (`computedLevel` mulai dari `1`):
    * **Level 2 (*Kemandirian Dasar*):** jika `monthlySurplus.gt(0)` **atau** (`monthlySurplus.eq(0)` && `consumptiveDebtBalance.eq(0)`). *(Selaras dengan Onboarding: pengguna baru tanpa utang konsumtif langsung mulai di Level 2, sedangkan yang punya utang konsumtif mulai di Level 1).*
    * **Level 3 (*Ruang Bernapas*):** jika `efMonths.gte(1)` && (`monthlySurplus.gt(0)` || `!hasPeriodTransactions`). *(Catatan: `!hasPeriodTransactions` mencegah pengguna Level 3 jatuh ke Recovery Mode di tanggal 1 sebelum gajian masuk).*
    * **Level 4 (*Stabilitas Finansial*):** jika `consumptiveDebtBalance.eq(0)` && `efMonths.gte(3)`. *(Tidak memaksa surplus bulan ini > 0 agar pengguna stabil tidak turun level saat awal bulan).*
    * **Level 5 (*Fleksibilitas*):** jika `computedLevel >= 4` && `investmentPortfolio.gte(annualEssential)`.
    * **Level 6 (*Kebebasan Finansial Dasar*):** jika `computedLevel >= 4` && `fireNumber.gt(0)` && `investmentPortfolio.gte(fireNumber)`.
    * **Level 7 (*Kekayaan Melimpah*):** jika `computedLevel >= 4` && `abundantNumber.gt(0)` && `investmentPortfolio.gte(abundantNumber)`.
  * **Aturan *Recovery Mode* (Anti-Downgrade Punishment):**
    * `highestLevel = Math.max(previousHighestLevel, computedLevel)`
    * `healthStatus = computedLevel < highestLevel ? 'RECOVERY_MODE' : 'NORMAL'`
  * **Output Tambahan:**
    * `title` & `tagline` berbahasa Indonesia untuk `computedLevel`.
    * `nextLevelRequirements`: daftar syarat konkret untuk naik ke `computedLevel + 1` (atau kembali ke `highestLevel` saat `RECOVERY_MODE`), masing-masing berisi `{ code, label, currentDisplay, targetDisplay, isMet: boolean, progressPct: string }`.
    * `missions`: daftar To-Do dinamis berbahasa Indonesia (`{ id, title, description, priority: 'HIGH' | 'NORMAL', completed: boolean }`) khusus level saat ini. Jika `healthStatus === 'RECOVERY_MODE'`, wajib menyisipkan misi prioritas tertinggi di urutan pertama:
      * **Judul:** `"Isi Ulang Dana Darurat"`
      * **Deskripsi:** `"Dana darurat terpakai di bawah standar Level [highestLevel]. Lencana rekor Anda tetap aman — prioritaskan pengisian kembali sebelum menambah pos investasi baru."`

### 3.2 Modul Anggaran (`server/src/modules/budgets/`)

Buat 4 file: `budgets.schemas.ts`, `budgets.calculations.ts`, `budgets.service.ts`, `budgets.routes.ts`, lalu daftarkan `app.use('/api/v1/budgets', authCookie, budgetsRouter);` di `server/src/app.ts`.

* **Endpoint 1:** `GET /api/v1/budgets/:year/:month`
  * Validasi params: `year` integer `2000..2100`, `month` integer `1..12`.
  * Ambil paralel: `user.budgetFramework`, seluruh kategori pengeluaran (`expenseClass !== null`), seluruh baris `Budget` pada `(userId, year, month)`, dan seluruh transaksi aktif pada interval WIB `[start, nextMonthStart)`.
  * Hitung dengan `decimal.js`:
    * `totalIncome` (dari `INCOME`), `totalExpense` (dari `EXPENSE`), `debtPaymentTotal` (dari `DEBT_PAYMENT`), `surplus = totalIncome - totalExpense`.
    * Daftar `categories` (terurut `ESSENTIAL` dulu lalu `DISCRETIONARY`, kemudian nama A–Z): `{ categoryId, categoryName, expenseClass, allocated, spent, remaining, utilizationPct, isOverBudget }`.
    * Ringkasan `zeroBased`:
      * `totalAllocated`, `unallocated = totalIncome - totalAllocated`, `status`: `'BALANCED'` (jika `unallocated.eq(0)` dan `totalIncome.gt(0)`), `'UNDER_ALLOCATED'` (jika `unallocated.gt(0)`), `'OVER_ALLOCATED'` (jika `unallocated.lt(0)`), atau `'NO_INCOME'` (jika `totalIncome.eq(0)` dan `totalAllocated.eq(0)`).
    * Ringkasan `rule503020`:
      * `needs` (50%): `{ targetPct: "50.00", targetAmount, allocated, spent, actualPctOfIncome }`
      * `wants` (30%): `{ targetPct: "30.00", targetAmount, allocated, spent, actualPctOfIncome }`
      * `savings` (20%): `{ targetPct: "20.00", targetAmount, actualSavings: surplus, debtPaymentTotal, actualPctOfIncome }`
* **Endpoint 2:** `PUT /api/v1/budgets/:year/:month`
  * Body Zod:
    ```typescript
    {
      items: Array<{
        categoryId: uuid,
        allocated: nonNegativeMoney
      }> // min 1, max 100, tolak duplikat categoryId
    }
    ```
  * Di dalam `prisma.$transaction`:
    1. Verifikasi seluruh `categoryId` ada, milik `userId`, dan `expenseClass !== null` (jika ada yang tidak cocok, lempar `AppError.badRequest` / `AppError.notFound` — anti-IDOR).
    2. Lakukan `upsert` pada tabel `Budget` menggunakan unique key `userId_categoryId_month_year`.
  * Setelah transaksi selesai, kembalikan payload terbaru dengan struktur identik `GET /api/v1/budgets/:year/:month`.

### 3.3 Modul Analitik Terpadu (`server/src/modules/analytics/`)

Buat 3 file: `analytics.schemas.ts`, `analytics.service.ts`, `analytics.routes.ts`, lalu daftarkan `app.use('/api/v1/analytics', authCookie, analyticsRouter);` di `server/src/app.ts`. *(Pertahankan `/api/v1/dashboard/summary` tanpa diubah).*

* **Endpoint:** `GET /api/v1/analytics/dashboard?year=YYYY&month=MM`
* **Alur `analytics.service.ts`:**
  1. Tentukan `period` (default: `getCurrentWibPeriod()`), `isCurrentPeriod = period.year === current.year && period.month === current.month`.
  2. Hitung jendela waktu:
     * Bulan periode: `[monthStart, nextMonthStart)` via `getWibMonthRange`.
     * Historis 6 bulan untuk Dana Darurat: `[sixMonthStart, nextMonthStart)` (5 bulan sebelum `period` sampai akhir `period`).
     * Jendela 30 hari untuk *Latte Factor*: `latteEnd = isCurrentPeriod ? new Date() : nextMonthStart`, `latteStart = new Date(latteEnd.getTime() - 30 * 24 * 60 * 60 * 1000)`.
  3. Query paralel (`Promise.all`) dengan filter `userId` ketat:
     * `user` (`baselineEssential`, `budgetFramework`, `swrRate`, `inflationRate`, `expectedReturnRate`, `currentLevel`, `highestLevel`, `healthStatus`).
     * `accounts` (`id`, `type`, `balance`).
     * `activeDebts` (`remainingBalance`, `isConsumptive`, `isPaidOff: false`).
     * `periodTransactions` (`deletedAt: null`, `[monthStart, nextMonthStart)`).
     * `historicalEssentialTx` (`type: 'EXPENSE'`, `deletedAt: null`, `category: { expenseClass: 'ESSENTIAL' }`, `[sixMonthStart, nextMonthStart)`).
     * `latteCandidateTx` (`type: 'EXPENSE'`, `deletedAt: null`, `category: { expenseClass: 'DISCRETIONARY' }`, `[latteStart, latteEnd)`).
     * `periodBudgets` (`month: period.month`, `year: period.year`).
  4. Panggil `calculateDashboardSummary(...)` (re-use dari modul `dashboard`), `calculateEmergencyFundTarget(...)`, `detectLatteFactors(...)`, `evaluateMilestoneLevel(...)`, dan hitung `budgetHealth` (`totalAllocated`, `totalSpentInBudgetedCategories`, `overBudgetCategoriesCount`, `categories: Array<{ categoryId, allocated, spent, remaining }>`).
  5. **Guard Persistensi Level (Kritis):** **HANYA** jika `isCurrentPeriod === true` **dan** salah satu dari `currentLevel`, `highestLevel`, atau `healthStatus` berubah dibanding data `user` di database, lakukan `prisma.user.update` untuk menyimpannya. Jangan pernah menimpa level `User` saat pengguna sekadar melihat arsip bulan lalu.
  6. **Kontrak Respons JSON (`GET /api/v1/analytics/dashboard`):**
     ```json
     {
       "success": true,
       "message": "Analitik dashboard berhasil dimuat.",
       "data": {
         "period": { "year": 2026, "month": 11 },
         "isCurrentPeriod": true,
         "cashFlow": { "...": "sama persis dengan dashboard/summary" },
         "netWorth": { "...": "sama persis dengan dashboard/summary" },
         "categoryMonthlySpent": [{ "categoryId": "uuid", "spent": "250000.00" }],
         "emergencyFund": {
           "dataSource": "ONBOARDING_BASELINE",
           "badge": "Estimasi Awal",
           "historyMonthsCount": 1,
           "monthlyBasis": "3000000.00",
           "currentBalance": "1500000.00",
           "monthsCovered": "0.50",
           "activeTargetMonths": 1,
           "activeTargetAmount": "3000000.00",
           "shortfallToActiveTarget": "1500000.00",
           "progressPct": "50.00",
           "target1Month": "3000000.00",
           "target3Months": "9000000.00",
           "target6Months": "18000000.00"
         },
         "latteFactor": {
           "windowDays": 30,
           "microThresholdUsed": "50000.00",
           "expectedReturnRatePct": "10.00",
           "totalMonthlyLeak": "150000.00",
           "totalAnnualLeak": "1800000.00",
           "totalOpportunityCost5Yr": "11615560.86",
           "totalOpportunityCost10Yr": "30726746.79",
           "items": [
             {
               "categoryId": "uuid",
               "categoryName": "Jajan & Kopi",
               "monthlyFrequency": 6,
               "monthlyTotal": "150000.00",
               "annualizedProjection": "1800000.00",
               "opportunityCost5Yr": "11615560.86",
               "opportunityCost10Yr": "30726746.79"
             }
           ]
         },
         "milestone": {
           "currentLevel": 2,
           "highestLevel": 2,
           "healthStatus": "NORMAL",
           "title": "Kemandirian Dasar",
           "tagline": "...",
           "fireNumber": "900000000.00",
           "consumptiveDebtBalance": "0.00",
           "investmentPortfolio": "0.00",
           "nextLevelRequirements": [
             {
               "code": "EMERGENCY_FUND_1M",
               "label": "Dana Darurat minimal 1 bulan pengeluaran pokok",
               "currentDisplay": "Rp1.500.000",
               "targetDisplay": "Rp3.000.000",
               "isMet": false,
               "progressPct": "50.00"
             }
           ],
           "missions": [
             {
               "id": "L2_PAY_YOURSELF_FIRST",
               "title": "Terapkan Pay Yourself First",
               "description": "...",
               "priority": "NORMAL",
               "completed": false
             }
           ]
         },
         "budgetHealth": {
           "budgetFramework": "ZERO_BASED",
           "totalAllocated": "3000000.00",
           "overBudgetCategoriesCount": 0,
           "categories": [
             {
               "categoryId": "uuid",
               "allocated": "500000.00",
               "spent": "150000.00",
               "remaining": "350000.00"
             }
           ]
         }
       },
       "meta": {}
     }
     ```

### 3.4 Unit Test Backend (`server/src/__tests__/phase2.financialMath.test.ts`)
Tulis pengujian Vitest lengkap yang memverifikasi:
1. **Cold-start Dana Darurat:** `0` bulan & `2` bulan memakai `ONBOARDING_BASELINE` (`Estimasi Awal`); `3` bulan & `6` bulan beralih ke `ACTUAL_HISTORICAL` (`Data Aktual`); *guard* pembagian nol.
2. **Audit Latte Factor:** Mengabaikan kategori `ESSENTIAL` bernominal kecil; menolak kategori `DISCRETIONARY` yang hanya muncul 2 kali; menerapkan cap dinamis $\min(5\% \times \text{income}, 100000)$ dan *fallback* `50000` saat `income === 0`; akurasi *future value* 5 tahun & 10 tahun pada `expectedReturnRate = 0%` dan `10%`.
3. **Evaluasi Level 1–7 & *Recovery Mode*:**
   * Utang konsumtif > 0 & surplus 0 $\rightarrow$ Level 1.
   * Bebas utang konsumtif & surplus 0 $\rightarrow$ Level 2.
   * Surplus > 0 & EF $\ge 1\times$ $\rightarrow$ Level 3.
   * Bebas utang konsumtif & EF $\ge 3\times$ $\rightarrow$ Level 4 (meskipun di awal bulan surplus masih 0).
   * Investasi $\ge 12\times$ pengeluaran pokok (syarat L4 terpenuhi) $\rightarrow$ Level 5; $\ge \text{FIRE}$ $\rightarrow$ Level 6; $\ge 2\times \text{FIRE}$ $\rightarrow$ Level 7.
   * Pengguna dengan `previousHighestLevel = 4` yang EF-nya turun menjadi $2\times$ $\rightarrow$ `currentLevel = 3`, **`highestLevel` tetap `4`**, `healthStatus = 'RECOVERY_MODE'`, dan misi pertama adalah `"Isi Ulang Dana Darurat"`.
4. **Budget Calculation & Schema:** `ZERO_BASED` (`BALANCED`, `UNDER_ALLOCATED`, `OVER_ALLOCATED`), rasio `RULE_50_30_20`, serta validasi penolakan `categoryId` duplikat pada `PUT /budgets`.

## 4. Spesifikasi Frontend Fase 2 (`client/`)

### 4.1 Lapisan API & Sinkronisasi Cache
* Perbarui `client/src/api/types.ts` dengan tipe `BudgetOverviewResult`, `UpdateBudgetsPayload`, `AnalyticsDashboardResult`, `EmergencyFundAnalytics`, `LatteFactorAnalytics`, `MilestoneAnalytics`, `BudgetHealthSummary`.
* Tambahkan `budgets` dan `analytics` ke `client/src/api/queryKeys.ts`.
* Buat hook `client/src/api/hooks/useBudgets.ts` (`useBudgetOverview`, `useSaveBudgets`) dan `client/src/api/hooks/useAnalytics.ts` (`useAnalyticsDashboard`).
* **Peta Invalidasi Cache Lengkap:**
  * Mutasi transaksi (`create`, `delete`, `restore`): invalidasi `transactions`, `accounts`, `debts`, `dashboard`, **`analytics`**, **`budgets`**, dan **`auth.me`** (agar level di sidebar/header ikut terbarui secara *real-time*).
  * Mutasi akun (`create`, `update`) & preferensi (`updatePreferences`): invalidasi `analytics`, `budgets`, `dashboard`.
  * Mutasi `useSaveBudgets`: invalidasi `budgets` dan `analytics`.

### 4.2 Navigasi (`client/src/components/layout/AppLayout.tsx` & `App.tsx`)
* Tambahkan rute terproteksi `/budgets` (`BudgetPage`).
* Tambahkan item menu **Anggaran** (ikon `PieChart` atau `Calculator`, `shortLabel: 'Anggaran'`) tepat setelah *Riwayat Transaksi* di Desktop Sidebar dan Mobile Bottom Navigation (ubah grid mobile menjadi `grid-cols-5`).

### 4.3 Halaman Anggaran (`client/src/pages/BudgetPage.tsx`)
Bangun halaman manajemen anggaran yang intuitif dan *real-time*:
1. **Header & Pemilih Periode:** Pemilih bulan/tahun WIB yang seragam dengan Dashboard + *quick switcher* metode anggaran (`Zero-Based` vs `50 / 30 / 20`) yang langsung memanggil `useUpdatePreferences`.
2. **Panel Ringkasan Dinamis Sesuai Metode:**
   * **Jika `ZERO_BASED`:** Tampilkan 3 angka besar (`Total Pemasukan Bulan Ini`, `Total Teralokasi`, dan **`Sisa Tak Teralokasi`**). Kode warna status:
     * Hijau (`emerald`): `Sisa Tak Teralokasi = Rp0` (*"Anggaran Seimbang — Setiap Rupiah Punya Tugas!"*)
     * Kuning (`amber`): masih ada uang belum dialokasikan (*"Alokasikan sisa Rp... agar mencapai Rp0"*)
     * Merah (`rose`): alokasi melebihi pemasukan (*"Melebihi pemasukan sebesar Rp..."*)
   * **Jika `RULE_50_30_20`:** Tampilkan 3 kartu perbandingan proporsi target vs aktual (**50% Kebutuhan Pokok**, **30% Keinginan**, **20% Tabungan & Pelunasan Utang**) lengkap dengan bar visual.
3. **Daftar Alokasi per Kategori (Dikelompokkan `Kebutuhan Pokok` & `Keinginan`):**
   * Setiap baris menampilkan nama kategori, `MoneyInput` untuk nominal alokasi bulan tersebut, `Terpakai: Rp...`, `Sisa: Rp...` (merah jika *over-budget*), dan *progress bar* serapan anggaran (`clampPercentBarWidth` memakai `decimal.js`).
   * Sediakan tombol aksi cepat **"Isi Otomatis 50/30/20"** (opsional jika pemasukan > 0) untuk membantu pengguna baru, serta tombol sticky/footer **"Simpan Anggaran Bulan Ini"** (`PUT /api/v1/budgets/:year/:month`) dengan indikator perubahan belum disimpan (*dirty state*).

### 4.4 Upgrade `QuickAddModal.tsx` (*Eight Golden Rules #3 & #8*)
* Konsumsi `useAnalyticsDashboard(selectedPeriod.year, selectedPeriod.month, isOpen)` untuk membaca `budgetHealth.categories`.
* Pada tab `EXPENSE`, tepat di bawah pemilih Kategori:
  * Jika kategori memiliki alokasi anggaran (`allocated > 0`), tampilkan: **`Sisa budget bulan ini: Rp...`** (berwarna `emerald` jika aman, `amber` jika tersisa < 20%, `rose` jika terlampaui) di samping **`Terpakai: Rp... / Rp...`**.
  * Jika belum dialokasikan (`allocated == 0`), tampilkan `Terpakai bulan ini: Rp...` + tautan kecil *"Atur budget"* ke `/budgets`.
* Pada toast sukses `EXPENSE`, jika kategori memiliki budget, tampilkan dampak angka langsung:
  * *"Jajan & Kopi Rp25.000 tersimpan. Sisa budget kategori ini bulan ini: Rp175.000."*

### 4.5 Dashboard v2 (`client/src/pages/DashboardPage.tsx` & Komponen `src/components/dashboard/`)
Beralih dari `useDashboardSummary` ke **`useAnalyticsDashboard(period.year, period.month)`** dan susun 4 komponen analitik baru di `client/src/components/dashboard/`:

1. **`MilestoneCard.tsx` (Upgrade `LevelBadge`):**
   * Menampilkan Level saat ini (1–7), nama fase, progress bar tangga 7 level, dan lencana `Estimasi Awal` / `Data Aktual`.
   * **Banner *Recovery Mode*:** Jika `healthStatus === 'RECOVERY_MODE'`, tampilkan banner Amber mencolok: *"Mode Pemulihan Aktif — Rekor tertinggi Anda tetap Level X. Fokus misi isi ulang Dana Darurat."*
   * Tampilkan checklist **`Syarat Naik ke Level Berikutnya`** (`nextLevelRequirements`) dengan indikator tercapai/belum dan progress bar per syarat.
2. **`EmergencyFundCard.tsx` (Tracker Dana Darurat Dinamis):**
   * Tampilkan saldo akun Dana Darurat saat ini vs target aktif (`1x` atau `3x` pengeluaran pokok bulanan) + *progress bar* dan penanda milestone `1 bln`, `3 bln`, `6 bln`.
   * Tampilkan lencana transparan: **`Estimasi Awal (X/3 bln data)`** jika `dataSource === 'ONBOARDING_BASELINE'`, atau **`Data Aktual (rata-rata X bln)`** jika `ACTUAL_HISTORICAL`.
   * Tambahkan tombol cepat **`+ Isi Dana Darurat`** yang langsung membuka `QuickAddModal` pada tab `TRANSFER`.
3. **`LatteFactorCard.tsx` (Audit Kebocoran Halus + Modal *Shock Therapy*):**
   * Jika terdeteksi kebocoran (`items.length > 0`): tampilkan total kebocoran 30 hari terakhir, **Proyeksi Tahunan (`× 12`)**, dan daftar kategori teratas dengan frekuensi kemunculannya (misal *"Jajan & Kopi — 6x dalam 30 hari"*).
   * Sediakan tombol **"Lihat Dampak Investasi 5 & 10 Tahun"** yang membuka `Modal` berisi tabel rincian *opportunity cost* 5 tahun dan 10 tahun berbasis `expectedReturnRatePct` pengguna.
   * Jika bersih (`items.length === 0`): tampilkan status positif (*"Tidak ada kebocoran halus terdeteksi dalam 30 hari terakhir!"*).
4. **`LevelMissionsCard.tsx` (Misi & To-Do Dinamis per Level):**
   * Menampilkan daftar `milestone.missions` dari backend.
   * Misi berprioritas `HIGH` (seperti *"Isi Ulang Dana Darurat"* saat `RECOVERY_MODE`) disorot khusus di posisi paling atas dengan badge Amber.
   * Pengguna dapat mencentang status selesai lokal (atau melihat status otomatis untuk misi berbasis data) guna membantu eksekusi kebiasaan harian.

## 5. Prompt Eksekusi Siap Salin untuk Agent Antigravity

Untuk menghindari batasan kuota di tengah eksekusi, jalankan Fase 2 dalam **2 tahap berurutan** (**Trigger 2A** lalu **Trigger 2B**).

### Trigger 2A — Patch 1B (`client/`) + Backend Fase 2 (`server/`)

Salin dan tempel prompt berikut terlebih dahulu:

```
Execute **Phase 2 — Part A (Patch 1B Client Fixes + Backend Phase 2)** strictly according to @PHASE_2_ANTIGRAVITY.md and @.agent/rules/upgrade-rules.md.

Do NOT build the Phase 2 Frontend pages (`BudgetPage`, Dashboard v2 cards) in this turn yet — finish Patch 1B and the entire Backend Phase 2 cleanly with passing builds and tests first.

Scope of work:
1. **Patch 1B (`client/`):**
   - Fix `QuickAddModal.tsx`: allow selecting `""` ("Tanpa Kategori") on the `INCOME` tab without resetting to the first category, and derive `selectedPeriod` from `transactionDate` for backdated entries.
   - Fix `OnboardingPage.tsx`: add `remainingTouched: boolean` per `DraftDebt` so typing `totalPrincipal` syncs `remainingBalance` continuously until the user explicitly edits `remainingBalance`.
   - Fix `client/src/api/client.ts` & `main.tsx`: add `registerUnauthorizedHandler` so any `401` (except `/auth/login`, `/auth/register`, `/auth/me`) clears `queryKeys.auth.me` to `null` for clean route-guard redirection without reload loops.
   - Fix `TransactionsPage.tsx`: clamp `page` down to `meta.totalPages` when deleting the last item on a page > 1.
   - Extract `ACCOUNT_TYPE_LABELS` and `LEVEL_TITLES_ID` into `client/src/utils/constants.ts` and remove cross-page imports.

2. **Backend Phase 2 (`server/` — NO Prisma schema changes needed):**
   - Implement `server/src/utils/financialMath.ts` strictly using `decimal.js` (zero JS number math, zero `Math.pow`):
     - `calculateEmergencyFundTarget` (cold-start `< 3` months fallback to `baselineEssential` with `Estimasi Awal` vs `>= 3` months `ACTUAL_HISTORICAL` with `Data Aktual`, 1x/3x/6x targets, division-by-zero guards).
     - `detectLatteFactors` (`DISCRETIONARY` only, `amount <= min(5% * monthlyIncome, 100000)` with `50000` fallback when income is 0, `>= 3` occurrences in 30 days, annual projection + 5-year and 10-year monthly-annuity investment opportunity cost via `Decimal.pow`).
     - `evaluateMilestoneLevel` (Level 1–7 consistent with onboarding, `highestLevel = Math.max(...)`, `RECOVERY_MODE` without downgrading `highestLevel`, `nextLevelRequirements`, and Bahasa Indonesia `missions` with top-priority `"Isi Ulang Dana Darurat"` during `RECOVERY_MODE`).
   - Implement `server/src/modules/budgets/` (`GET /api/v1/budgets/:year/:month` and `PUT /api/v1/budgets/:year/:month` with ACID transaction, anti-IDOR category ownership checks, `ZERO_BASED` unallocated balance, and `RULE_50_30_20` breakdown). Mount in `server/src/app.ts`.
   - Implement `server/src/modules/analytics/` (`GET /api/v1/analytics/dashboard?year=YYYY&month=MM`) reusing `calculateDashboardSummary`, integrating Emergency Fund, Latte Factor, Milestone, and `budgetHealth`. Persist updated `currentLevel`/`highestLevel`/`healthStatus` to `User` ONLY when `isCurrentPeriod === true`. Keep `/api/v1/dashboard/summary` intact. Mount in `server/src/app.ts`.
   - Write comprehensive Vitest tests in `server/src/__tests__/phase2.financialMath.test.ts` covering all edge cases defined in Section 3.4 of @PHASE_2_ANTIGRAVITY.md.

Verification commands to run and fix before reporting completion:
- In `server/`: `npm run typecheck`, `npm run build`, `npm test`
- In `client/`: `npm run typecheck`, `npm run build`, `npm test`

Report all modified/created files and test counts before stopping for Trigger 2B.
```

---

### Trigger 2B — Frontend Fase 2 (`client/`)

Setelah Trigger 2A selesai dan semua build + test lulus, salin dan tempel prompt berikut:

```
Phase 2 Part A is verified. Now execute **Phase 2 — Part B (Frontend Phase 2: Budgeting, Emergency Fund, Latte Factor & Dashboard v2)** strictly according to Section 4 of @PHASE_2_ANTIGRAVITY.md and @.agent/rules/upgrade-rules.md.

Scope of work (`client/` ONLY — do NOT modify `server/` unless an actual contract bug is proven):
1. Update `client/src/api/types.ts`, `queryKeys.ts`, and create `useBudgets.ts` + `useAnalytics.ts` matching `GET/PUT /api/v1/budgets/:year/:month` and `GET /api/v1/analytics/dashboard` 1:1 (all money values as `string`).
2. Update cache invalidation across `useTransactions.ts`, `useAccounts.ts`, `useAuth.ts`, and `useBudgets.ts` so `analytics`, `budgets`, `dashboard`, and `auth.me` (on transaction mutations) stay synchronized in real time.
3. Update `AppLayout.tsx` and `App.tsx` to add `/budgets` ("Anggaran") in Desktop Sidebar and Mobile 5-column Bottom Navigation.
4. Build `client/src/pages/BudgetPage.tsx`:
   - Month/year WIB switcher + quick `ZERO_BASED` vs `RULE_50_30_20` framework toggle (`PATCH /auth/preferences`).
   - Dynamic summary header: Zero-Based `Sisa Tak Teralokasi` status banner (Emerald `Rp0`, Amber under-allocated, Rose over-allocated) OR 50/30/20 target-vs-actual cards.
   - Category allocation rows grouped by `Kebutuhan Pokok` (`ESSENTIAL`) and `Keinginan` (`DISCRETIONARY`) with `MoneyInput`, live spent/remaining figures, decimal-safe progress bars, dirty-state indicator, and batch `"Simpan Anggaran Bulan Ini"` button.
5. Upgrade `client/src/components/transactions/QuickAddModal.tsx`:
   - Show live remaining category budget (`Sisa budget bulan ini: Rp...`) inline on the `EXPENSE` tab using `budgetHealth` from `useAnalyticsDashboard`.
   - Enhance the `EXPENSE` success toast to report the updated remaining category budget when budgeted.
6. Build Dashboard v2 components in `client/src/components/dashboard/` and integrate them into `client/src/pages/DashboardPage.tsx` (switching from `useDashboardSummary` to `useAnalyticsDashboard`):
   - `MilestoneCard.tsx` (7-level progress indicator, Amber `RECOVERY_MODE` banner preserving `highestLevel`, and `nextLevelRequirements` checklist).
   - `EmergencyFundCard.tsx` (dynamic 1x/3x/6x target tracker, transparent `Estimasi Awal` vs `Data Aktual` badge, and `+ Isi Dana Darurat` CTA opening QuickAdd on `TRANSFER`).
   - `LatteFactorCard.tsx` (30-day micro-leak summary, annual projection, and a Modal showing 5-year & 10-year compounded investment opportunity cost).
   - `LevelMissionsCard.tsx` (dynamic level To-Do list with Amber top-priority highlight for `"Isi Ulang Dana Darurat"` during `RECOVERY_MODE`).

All user-facing UI text, labels, empty states, and toasts MUST be in natural Bahasa Indonesia. Zero placeholders or `// TODO`.

Verification commands to run in `client/` and fix before reporting completion:
- `npm run typecheck`
- `npm run build`
- `npm test`

Summarize all created/modified files and confirm readiness for End-to-End Phase 2 testing.
```

## 6. Checklist Verifikasi End-to-End (Definition of Done Fase 2)

Jalankan `server` (`:4000`) dan `client` (`:5173`), lalu verifikasi skenario berikut secara berurutan:

* [ ] **Build & Unit Test:** `typecheck`, `build`, dan `test` di `server/` maupun `client/` seluruhnya hijau tanpa error.
* [ ] **Verifikasi Patch 1B:**
  * Di `QuickAddModal` tab `INCOME`, pilih **"Tanpa Kategori"** $\rightarrow$ tidak kembali ke kategori pertama dan berhasil disimpan.
  * Di `OnboardingPage` Langkah 3 (akun baru), ketik Total Pokok `2000000` $\rightarrow$ Sisa Pokok ikut menjadi `2000000`, bukan nyangkut di `2`.
* [ ] **Zero-Based Budgeting & `QuickAddModal`:**
  * Catat pemasukan Rp5.000.000 bulan ini $\rightarrow$ buka `/budgets` $\rightarrow$ alokasikan kategori hingga total Rp5.000.000 $\rightarrow$ banner `Sisa Tak Teralokasi` berubah hijau (`Rp0`) dan tersimpan.
  * Buka `QuickAddModal` (`Shift + N`) tab `EXPENSE` dan pilih kategori yang baru dianggarkan $\rightarrow$ muncul `Sisa budget bulan ini: Rp...` secara *live* dan toast setelah simpan menampilkan sisa budget terbaru.
* [ ] **Switch 50/30/20:** Ganti kerangka anggaran ke **Aturan 50 / 30 / 20** $\rightarrow$ kartu proporsi 50% Kebutuhan / 30% Keinginan / 20% Tabungan menampilkan target nominal dan realisasi aktual yang cocok.
* [ ] **Audit *Latte Factor*:**
  * Catat 3 transaksi `EXPENSE` kecil pada kategori `DISCRETIONARY` (misal *Jajan & Kopi* Rp25.000 $\times 3$) dan 3 transaksi kecil pada kategori `ESSENTIAL` (misal *Transportasi* Rp15.000 $\times 3$).
  * Cek `LatteFactorCard` di Dashboard: **hanya** *Jajan & Kopi* yang terdeteksi (`3x`, Rp75.000/bln, proyeksi Rp900.000/thn), dan modal menampilkan *opportunity cost* 5 & 10 tahun.
* [ ] **Dynamic Emergency Fund & Cold Start:** Akun baru dengan histori $< 3$ bulan menampilkan lencana **`Estimasi Awal`** berbasis `baselineEssential`.
* [ ] **Naik Level & *Recovery Mode*:**
  * Pastikan utang konsumtif Rp0, lalu transfer dana ke akun bertipe `EMERGENCY_FUND` hingga saldo $\ge 3\times$ pengeluaran pokok $\rightarrow$ Dashboard otomatis naik ke **Level 4: Stabilitas Finansial**.
  * Catat transaksi `EXPENSE` dari akun `EMERGENCY_FUND` hingga saldo turun di bawah $3\times$ $\rightarrow$ **`highestLevel` tetap Level 4**, status berubah menjadi banner Amber **`Mode Pemulihan`**, dan misi paling atas adalah **`Isi Ulang Dana Darurat`**.