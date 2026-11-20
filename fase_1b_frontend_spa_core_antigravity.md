# Phase 1B Playbook: Frontend SPA Core — UPgrade (Antigravity)

Dokumen ini adalah spesifikasi teknis terperinci sekaligus prompt eksekusi **Fase 1B (Frontend SPA Core)** untuk membangun folder `client/` secara penuh dan terintegrasi 1:1 dengan Backend Fase 1A+ (`server/`).

Simpan file ini di root repositori `upgrade-app/` (sejajar dengan `server/` dan `PATCH_1A_PLUS_ANTIGRAVITY.md`).

---

## 1. Tujuan & Batasan Ruang Lingkup (Scope)

**Target Fase 1B:** Menghasilkan aplikasi SPA React yang responsif (desktop + mobile), aman dengan `HttpOnly` cookie, menerapkan *Eight Golden Rules of Interface Design*, serta terhubung mulus ke seluruh endpoint Backend Fase 1A+.

### Termasuk di Fase 1B (`client/` ONLY)
1. Setup `client/` (React + Vite + TypeScript + Tailwind CSS v4 + React Router + Axios + TanStack Query + Lucide React).
2. Lapisan API (`src/api/`) yang sinkron 1:1 dengan kontrak JSON `server/` beserta strategi *cache invalidation* otomatis.
3. Halaman Autentikasi (`/login`, `/register`) + *Route Guards* (Auth Guard & Onboarding Guard).
4. Wizard **Onboarding 3 Langkah** (`/onboarding`) diakhiri *Closure Screen* penetapan Level awal.
5. **App Shell Responsif** (Sidebar di Desktop, Bottom Navigation + Floating Action Button di Mobile) & *global shortcut* `Shift + N`.
6. **QuickAddModal** 4 tipe transaksi (`EXPENSE`, `INCOME`, `TRANSFER`, `DEBT_PAYMENT`) lengkap dengan saldo akun *live*, total pengeluaran kategori bulan ini, peringatan *overdraft*, dan validasi kondisional.
7. **Halaman Riwayat Transaksi (`/transactions`)** dengan filter lengkap (tipe, akun, kategori, rentang tanggal), paginasi, *soft delete*, dan **UndoToast 7 detik** (`/restore`).
8. **Dashboard v1 (`/dashboard`)** menampilkan KPI *Net Worth*, *Monthly Cash Flow*, *Saving Rate*, pemilih periode bulan/tahun, ringkasan kartu saldo akun, dan 5 transaksi terakhir.
9. **Halaman Akun & Kategori (`/accounts`)** untuk mengelola dompet/rekening/investasi (tambah & ubah nama/tipe tanpa ubah saldo langsung) serta kategori kustom (`POST` & `DELETE` dengan proteksi kategori sistem).
10. **Halaman Pengaturan Dasar (`/settings`)** untuk memperbarui nama, `baselineEssential`, `budgetFramework`, dan asumsi SWR/inflasi/return (`PATCH /api/v1/auth/preferences`).

### Di Luar Scope Fase 1B (Dikerjakan di Fase 2 & 3)
* Halaman Budgeting penuh (`/budget`), Tracker Dana Darurat & Latte Factor (Fase 2).
* Simulasi *Debt Destroyer* Snowball/Avalanche, Kalkulator FIRE, grafik *Net Worth Snapshot*, & Export PDF (Fase 3).
* **Catatan:** Jangan ubah kode di `server/` pada fase ini kecuali ditemukan bug kontrak kritis.

---

## 2. Kontrak API 1:1 (Tersinkronisasi dengan `server/` 1A+)

Frontend **wajib** memakai bentuk tipe dan payload berikut tanpa asumsi tambahan. Seluruh nilai uang dari/ke API bertipe **`string`** (contoh: `"1500000.00"`).

### 2.1 Standar Envelope Respons
```typescript
export interface ApiSuccessEnvelope<T, M = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta: M;
}

export interface ApiErrorIssue {
  field: string;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  data: null;
  meta: {
    errors?: ApiErrorIssue[];
    details?: unknown;
  };
}
```

### 2.2 Peta Endpoint & Payload Aktif
| Fitur | Method & Path | Request / Query | Response `data` & `meta` |
| :--- | :--- | :--- | :--- |
| **Register** | `POST /auth/register` | `{ name, email, password }` | `data: { user }` (`201`) |
| **Login** | `POST /auth/login` | `{ email, password }` | `data: { user }` |
| **Logout** | `POST /auth/logout` | — | `data: null` |
| **Session** | `GET /auth/me` | — | `data: { user }` |
| **Preferences** | `PATCH /auth/preferences` | `{ name?, budgetFramework?, swrRate?, inflationRate?, expectedReturnRate?, baselineEssential? }` | `data: { user }` |
| **Onboarding** | `POST /onboarding` | `{ baselineEssential, budgetFramework, accounts[], debts[] }` | `data: { user, accounts, debts, summary }` (`201`) |
| **Accounts** | `GET /accounts` | — | `data: { accounts }` |
| **Create Account** | `POST /accounts` | `{ name, type, balance?, isLiquid? }` | `data: { account }` (`201`) |
| **Update Account** | `PATCH /accounts/:id` | `{ name?, type?, isLiquid? }` | `data: { account }` |
| **Categories** | `GET /categories` | `?kind=INCOME\|ESSENTIAL\|DISCRETIONARY` | `data: { categories }` |
| **Create Category** | `POST /categories` | `{ name, kind }` | `data: { category }` (`201`) |
| **Delete Category** | `DELETE /categories/:id` | — | `data: null` |
| **Debts (Read)** | `GET /debts` | `?activeOnly=true\|false` | `data: { debts }` |
| **Transactions** | `GET /transactions` | `?type=&accountId=&categoryId=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=20` | `data: { transactions }`, `meta: { page, pageSize, total, totalPages }` |
| **Create Tx** | `POST /transactions` | Discriminated union 4 tipe (`INCOME`, `EXPENSE`, `TRANSFER`, `DEBT_PAYMENT`) | `data: { transaction, accounts, debt }`, `meta: { warnings: string[] }` (`201`) |
| **Soft Delete Tx** | `DELETE /transactions/:id` | — | `data: { transaction, accounts, debt }`, `meta: { warnings: string[] }` |
| **Restore Tx** | `POST /transactions/:id/restore` | — | `data: { transaction, accounts, debt }`, `meta: { warnings: string[] }` |
| **Dashboard v1** | `GET /dashboard/summary` | `?year=YYYY&month=MM` | `data: { period, cashFlow, netWorth, categoryMonthlySpent }` |

---

## 3. Arsitektur Folder `client/`

```text
client/
├── .env.example                    # VITE_API_BASE_URL=http://localhost:4000/api/v1
├── index.html                      # Judul "UPgrade — Manajemen Keuangan & Roadmap Financial Freedom", lang="id"
├── package.json
├── tsconfig.json
├── vite.config.ts                  # React + @tailwindcss/vite
└── src/
    ├── main.tsx                    # QueryClientProvider + BrowserRouter + ToastProvider
    ├── index.css                   # Tailwind v4 + Semantic Color Tokens + Typography
    ├── App.tsx                     # Routes + AuthGuard + OnboardingGuard + AppLayout
    ├── api/
    │   ├── client.ts               # Axios instance (withCredentials: true) + ApiError extractor
    │   ├── types.ts                # Interface 1:1 dengan serializer backend
    │   ├── queryKeys.ts            # Sentralisasi TanStack Query keys
    │   └── hooks/
    │       ├── useAuth.ts          # useMe, useLogin, useRegister, useLogout, useUpdatePreferences
    │       ├── useOnboarding.ts    # useCompleteOnboarding
    │       ├── useAccounts.ts      # useAccounts, useCreateAccount, useUpdateAccount
    │       ├── useCategories.ts    # useCategories, useCreateCategory, useDeleteCategory
    │       ├── useDebts.ts         # useDebts(activeOnly?)
    │       ├── useTransactions.ts  # useTransactions, useCreateTransaction, useDeleteTransaction, useRestoreTransaction
    │       └── useDashboard.ts     # useDashboardSummary(year, month)
    ├── context/
    │   ├── ToastContext.tsx        # Support toast standar (success/error/warning) & UndoToast 7 detik
    │   └── QuickAddContext.tsx     # Global state modal + keyboard shortcut Shift + N
    ├── utils/
    │   ├── currency.ts             # formatRupiah, sanitizeMoneyInput, compareMoney (via decimal.js)
    │   ├── date.ts                 # formatDateId, getCurrentWibPeriod, toDateInputValue, monthNameId
    │   └── __tests__/
    │       └── currency.test.ts    # Unit test utilitas uang & sanitizer
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.tsx       # Sidebar desktop, BottomNav mobile, Header, FAB + QuickAdd trigger
    │   │   └── RouteGuards.tsx     # PublicOnlyRoute, OnboardingRoute, ProtectedAppRoute
    │   ├── common/
    │   │   ├── Modal.tsx           # Accessible dialog (Esc to close, backdrop click, focus lock)
    │   │   ├── MoneyInput.tsx      # Input nominal dengan prefix "Rp", blokir negatif/huruf, format bersih
    │   │   ├── ToastViewport.tsx   # Renderer toast + progress bar hitung mundur 7 detik untuk UndoToast
    │   │   ├── EmptyState.tsx      # Ilustrasi/ikon bersih saat data masih kosong
    │   │   └── LevelBadge.tsx      # Lencana Level 1–7 + status badge ("Estimasi Awal" / "Recovery Mode")
    │   └── transactions/
    │       ├── QuickAddModal.tsx   # Jantung UX (<10 detik input, 4 tab semantik, overdraft warning)
    │       └── TransactionRow.tsx  # Baris transaksi dengan warna semantik, badge kategori, tombol hapus
    └── pages/
        ├── LoginPage.tsx
        ├── RegisterPage.tsx
        ├── OnboardingPage.tsx      # Stepper 3 langkah + Layar Penutupan Level Awal
        ├── DashboardPage.tsx       # KPI Cash Flow, Saving Rate, Net Worth, Saldo Akun, 5 Tx Terakhir
        ├── TransactionsPage.tsx    # Filter lengkap, daftar transaksi, paginasi, hapus + UndoToast
        ├── AccountsPage.tsx        # Manajemen Akun Aset (CRUD) + Kategori Kustom (Create/Delete)
        └── SettingsPage.tsx        # Pengaturan Profil, Baseline Pengeluaran Pokok, & Asumsi SWR/Budget
```

---

## 4. Desain Visual & Penerapan Konkret *Eight Golden Rules*

### 4.1 Token Warna Semantik & Estetika UI
Gunakan pendekatan desain **Clean Modern FinTech** (latar slate terang `#F8FAFC`, kartu putih bersih dengan border halus `#E2E8F0`, tipografi angka `tabular-nums` agar nominal Rupiah selalu sejajar vertikal):
* **`INCOME` / Surplus:** Emerald (`emerald-600`, latar `emerald-50`, border `emerald-200`).
* **`EXPENSE` / Defisit:** Rose (`rose-600`, latar `rose-50`, border `rose-200`).
* **`TRANSFER`:** Blue (`blue-600`, latar `blue-50`, border `blue-200`).
* **`DEBT_PAYMENT`:** Violet (`violet-600`, latar `violet-50`, border `violet-200`).
* **`RECOVERY_MODE` / Overdraft Warning:** Amber (`amber-600`, latar `amber-50`, border `amber-200`).
* **Primary Brand (`UPgrade`):** Indigo/Slate gelap (`slate-900` untuk CTA utama, aksen `indigo-600`).

### 4.2 Matriks Penerapan *Eight Golden Rules*
1. **Strive for Consistency:** Semua angka uang memakai `formatRupiah(...)` + class `tabular-nums`; seluruh badge dan ikon mengikuti 5 token warna semantik di atas.
2. **Seek Universal Usability:**
   * Desktop: tombol `+ Catat Transaksi` di sidebar/header dengan hint shortcut `Shift + N`, plus listener keyboard global `Shift + N` (abaikan jika `document.activeElement` adalah `INPUT`, `TEXTAREA`, `SELECT`, atau `contentEditable`).
   * Mobile: *Floating Action Button* (FAB) berukuran `56px` di pojok kanan bawah di atas *Bottom Navigation*.
3. **Offer Informative Feedback:**
   * Simpan transaksi sukses: tampilkan toast kontekstual dengan nominal & dampak (contoh: `"Pengeluaran Rp25.000 tercatat. Total kategori Jajan & Kopi bulan ini: Rp125.000"`).
   * Jika `meta.warnings` dari backend tidak kosong (saldo negatif), tampilkan peringatan Amber yang jelas bersamaan dengan toast sukses.
4. **Design Dialogs to Yield Closure:**
   * Wizard `OnboardingPage` memiliki *stepper* visual 3 langkah (`1. Pengeluaran Pokok` $\rightarrow$ `2. Akun Aset` $\rightarrow$ `3. Utang Aktif`) dan **wajib** berakhir pada layar ringkasan hasil (`summary` dari respons `POST /onboarding`) yang merayakan penetapan Level awal + ringkasan *Net Worth* sebelum tombol **"Masuk ke Dashboard"**.
5. **Prevent Errors:**
   * Komponen `MoneyInput` menolak huruf/tanda minus, membersihkan nol di depan yang tidak perlu, dan hanya mengirim string valid (`^\d{1,13}(\.\d{1,2})?$`) ke API.
   * Di `QuickAddModal`:
     * Tab `EXPENSE`: hanya menampilkan kategori `ESSENTIAL` dan `DISCRETIONARY` (dikelompokkan dengan `<optgroup label="Kebutuhan Pokok">` & `<optgroup label="Keinginan">`).
     * Tab `INCOME`: hanya menampilkan kategori `INCOME` (opsional).
     * Tab `TRANSFER`: menampilkan *dropdown* Akun Tujuan yang otomatis **mengecualikan** Akun Sumber yang sedang dipilih.
     * Tab `DEBT_PAYMENT`: hanya menampilkan utang aktif (`isPaidOff === false`); jika tidak ada utang aktif, tampilkan informasi ramah dan nonaktifkan tombol simpan. Sediakan toggle opsional *"Rincikan Pokok & Bunga"* yang memvalidasi `pokok + bunga === nominal` serta `pokok <= remainingBalance` secara *real-time* memakai `decimal.js`.
     * **Inline Overdraft Warning:** Jika tipe `EXPENSE`, `TRANSFER`, atau `DEBT_PAYMENT` dan `amount > sourceAccount.balance`, tampilkan kotak peringatan Amber di dalam modal (*"Perhatian: nominal melebihi saldo tersedia di [Nama Akun]. Saldo akan menjadi negatif jika dilanjutkan."*) tanpa memblokir pengiriman (karena backend mengizinkan *overdraft* dengan `warnings`).
6. **Permit Easy Reversal of Actions:**
   * Menghapus transaksi di `TransactionsPage` atau `DashboardPage` memanggil `DELETE /api/v1/transactions/:id` dan langsung memunculkan **`UndoToast`** berdurasi **7 detik** dengan progress bar animasi dan tombol **"Urungkan"** yang memanggil `POST /api/v1/transactions/:id/restore`.
7. **Keep Users in Control:**
   * Halaman `SettingsPage` memungkinkan pengguna mengubah `baselineEssential`, `budgetFramework`, `swrRate`, `inflationRate`, dan `expectedReturnRate` kapan saja.
   * Halaman `AccountsPage` memungkinkan pengguna menambah akun baru dan kategori kustom (`INCOME`, `ESSENTIAL`, `DISCRETIONARY`).
8. **Reduce Short-Term Memory Load:**
   * Di `QuickAddModal`, langsung di bawah pemilih Akun Sumber tampilkan: **`Saldo tersedia: Rp...`** (dan saldo Akun Tujuan pada tab `TRANSFER`).
   * Di tab `EXPENSE`, langsung di bawah pemilih Kategori tampilkan: **`Terpakai bulan ini: Rp...`** (diambil dari `dashboard.summary.categoryMonthlySpent`).
   * Di tab `DEBT_PAYMENT`, langsung di bawah pemilih Utang tampilkan: **`Sisa utang: Rp...`** dan cicilan minimum bulanannya.

---

## 5. Aturan Teknis Penting (Anti-Bug Frontend)

1. **Presisi Angka di Frontend:** Pasang `decimal.js` di `client/` juga! Gunakan `Decimal` di `src/utils/currency.ts` untuk `formatRupiah`, penjumlahan total aset/utang di *Onboarding*, validasi *overdraft*, dan validasi *split* pokok + bunga utang. Jangan gunakan `parseFloat(...)` untuk membandingkan atau menjumlahkan uang.
2. **Penanganan Cookie & 401 Tanpa Infinite Loop:**
   * Axios instance wajib menyetel `withCredentials: true` dan `baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'`.
   * Di `useMe()` (`GET /auth/me`), set `retry: false` dan `staleTime: 5 * 60 * 1000`. Jika `GET /auth/me` mengembalikan `401`, anggap `user = null` (belum login) — **jangan** paksa `window.location.href = '/login'` di interceptor saat URL-nya `/auth/me` agar tidak terjadi *reload loop* di halaman `/login` atau `/register`.
3. **Invalidasi Cache Terpusat:**
   * Setelah `createTransaction`, `softDeleteTransaction`, atau `restoreTransaction` sukses, wajib invalidasi **semua** query berikut:
     * `queryKeys.transactions.all`
     * `queryKeys.accounts.all`
     * `queryKeys.debts.all`
     * `queryKeys.dashboard.all`
   * Setelah `completeOnboarding` sukses, langsung `queryClient.setQueryData(queryKeys.auth.me, data.user)` dan invalidasi `accounts`, `debts`, `dashboard`.
   * Setelah `logout` sukses, panggil `queryClient.clear()` agar data pengguna sebelumnya tidak pernah tersisa di cache memori saat berganti akun.
4. **Filter Tanggal ke Backend:** Saat mengirim `from` dan `to` pada `GET /api/v1/transactions`, kirim format tanggal `YYYY-MM-DD` dari `<input type="date">` karena backend Patch 1A+ sudah menormalisasinya otomatis ke awal hari (`00:00:00.000+07:00`) dan akhir hari (`23:59:59.999+07:00`) WIB.

---

## 6. Prompt Siap Salin untuk Agent Antigravity

Salin dan tempel prompt berikut ke panel Agent Antigravity setelah menyimpan file `PHASE_1B_FRONTEND_ANTIGRAVITY.md` di root repositori:

```text
Execute **Phase 1B (Frontend SPA Core)** strictly according to @PHASE_1B_FRONTEND_ANTIGRAVITY.md and the workspace rules in @.agent/rules/upgrade-rules.md.

Scope of work (Frontend `client/` ONLY — do NOT modify `server/` unless an actual contract bug is proven):
1. Cleanup minor repo hygiene first: delete any stray `server/server-review*.md` files if present and ensure `*-review*.md` is listed in root `.gitignore`.
2. Scaffold `client/` using Vite + React + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`) and install: `axios`, `@tanstack/react-query`, `react-router-dom`, `lucide-react`, `decimal.js`, and dev deps `vitest` (for utility unit tests). Create `client/.env.example` and `client/.env` pointing to `http://localhost:4000/api/v1`.
3. Implement `client/src/utils/currency.ts` (using `decimal.js`: `formatRupiah`, `sanitizeMoneyInput`, `isValidPositiveMoney`, `isValidNonNegativeMoney`, `sumMoney`, `compareMoney`) and `client/src/utils/date.ts` (WIB period helper, Bahasa Indonesia date formatting, month names). Write Vitest unit tests in `client/src/utils/__tests__/currency.test.ts`.
4. Implement `client/src/api/` with exact 1:1 TypeScript types matching `server/` 1A+ serializers (`ApiSuccessEnvelope`, `ApiErrorEnvelope`, `PublicUser`, `PublicAccount`, `PublicCategory`, `PublicDebt`, `PublicTransaction`, `DashboardSummaryResult`), Axios instance with `withCredentials: true` and Indonesian error message extraction (NO 401 redirect loop on `/auth/me`), centralized `queryKeys.ts`, and TanStack Query hooks for `auth`, `onboarding`, `accounts`, `categories`, `debts`, `transactions`, and `dashboard`. Enforce full cache invalidation (`transactions`, `accounts`, `debts`, `dashboard`) on all transaction mutations and `queryClient.clear()` on logout.
5. Implement `ToastContext` + `ToastViewport` (including a 7-second animated countdown **`UndoToast`** with `"Urungkan"` button calling `POST /transactions/:id/restore`) and `QuickAddContext` (supporting global `Shift + N` desktop keyboard shortcut ignoring active form inputs).
6. Implement Auth & Route Guards:
   - `LoginPage` and `RegisterPage` (with live password requirement indicators: min 8 chars, letter + number, Indonesian copy).
   - `PublicOnlyRoute`, `OnboardingRoute`, and `ProtectedAppRoute` enforcing `onboardingCompleted === false -> /onboarding` and `onboardingCompleted === true -> /dashboard`.
7. Implement `OnboardingPage` (3-step visual progress stepper: Step 1 Baseline Essential (> Rp0) & Budget Framework, Step 2 Initial Asset Accounts with live total, Step 3 Optional Active Debts with `"Saya Tidak Punya Utang"` skip option, ending on a celebratory **Closure Screen** displaying `summary.level`, `summary.title`, `summary.badge` ("Estimasi Awal"), `summary.netWorth`, and CTA to `/dashboard`).
8. Implement responsive `AppLayout` (Desktop Sidebar + Mobile BottomNav + Mobile FAB) and the core `QuickAddModal` applying all Eight Golden Rules:
   - 4 semantic-colored tabs: `EXPENSE` (Rose), `INCOME` (Emerald), `TRANSFER` (Blue), `DEBT_PAYMENT` (Violet).
   - Live source account balance (`Saldo tersedia: Rp...`), live category monthly spend (`Terpakai bulan ini: Rp...` from `dashboard.summary.categoryMonthlySpent`), live debt remaining balance, conditional category/account/debt filtering, optional principal+interest split validation for `DEBT_PAYMENT`, inline Amber overdraft warning, and contextual informative toast showing `meta.warnings` if returned.
9. Implement Phase 1B pages:
   - `DashboardPage`: Period month/year switcher, `LevelBadge` ("Level X" + "Estimasi Awal"), 3 KPI cards (Net Worth, Cash Flow In/Out/Surplus, Saving Rate %), Account Balances grid with quick `+ Tambah Akun` modal, and 5 latest transactions with delete + UndoToast.
   - `TransactionsPage`: Full filter bar (type, account, category, `from`/`to` date inputs), paginated transaction list, soft-delete + 7-second UndoToast.
   - `AccountsPage`: Manage Asset Accounts (create & edit name/type/liquidity without editing balance directly) and Manage Categories (view grouped by `INCOME`/`ESSENTIAL`/`DISCRETIONARY`, create custom category, delete non-system unused category).
   - `SettingsPage`: Update user profile, `baselineEssential`, `budgetFramework`, `swrRate`, `inflationRate`, and `expectedReturnRate` via `PATCH /api/v1/auth/preferences`.

All user-facing UI text, labels, empty states, validation messages, and toasts MUST be in natural Bahasa Indonesia. Zero placeholders or `// TODO`.

After writing all files, run in `client/`:
- `npm run typecheck` (or `npx tsc --noEmit`)
- `npm run build`
- `npm test`

Fix every TypeScript, Vite build, or test issue before reporting completion. Summarize all created files and list exact steps to run `server` + `client` together for End-to-End verification.
```

---

## 7. Checklist Verifikasi End-to-End (Definition of Done Fase 1)

Setelah Antigravity menyelesaikan Fase 1B, jalankan kedua server (`server` di `:4000` dan `client` di `:5173`) lalu verifikasi skenario berikut di browser:

* [ ] **Build & Test:** `npm run typecheck`, `npm run build`, dan `npm test` di `client/` seluruhnya lulus dengan 0 error.
* [ ] **Alur Auth & Guard:** Register akun baru $\rightarrow$ cookie `upgrade_token` (`HttpOnly`) terpasang di DevTools Application $\rightarrow$ otomatis masuk `/onboarding` $\rightarrow$ jika mengetik URL `/dashboard` manual sebelum selesai onboarding tetap diarahkan kembali ke `/onboarding`.
* [ ] **Alur Onboarding Closure:** Isi `baselineEssential`, 2 akun (misal BCA Rp1.000.000 & GoPay Rp200.000), dan 1 utang konsumtif (misal Paylater Rp500.000) $\rightarrow$ tampil layar penetapan **Level 1: Ketergantungan Kritis** dengan *Net Worth* `Rp700.000` $\rightarrow$ masuk `/dashboard` dan tidak bisa kembali ke `/onboarding`.
* [ ] **Quick Add & Integritas 4 Tipe Transaksi:**
  * Tekan `Shift + N` di desktop $\rightarrow$ `QuickAddModal` terbuka.
  * Catat `INCOME` Rp500.000 ke BCA $\rightarrow$ saldo BCA jadi Rp1.500.000, Cash Flow Masuk naik Rp500.000.
  * Catat `TRANSFER` Rp300.000 dari BCA ke GoPay $\rightarrow$ BCA Rp1.200.000, GoPay Rp500.000, **Cash Flow Keluar & Saving Rate tetap Rp0 / tidak berubah**.
  * Catat `EXPENSE` Rp25.000 kategori *Jajan & Kopi* dari GoPay $\rightarrow$ GoPay Rp475.000, Cash Flow Keluar naik Rp25.000, dan saat buka `QuickAddModal` lagi lalu pilih *Jajan & Kopi* muncul `Terpakai bulan ini: Rp25.000`.
  * Catat `DEBT_PAYMENT` Rp100.000 (Pokok Rp80.000, Bunga Rp20.000) dari BCA ke Paylater $\rightarrow$ BCA Rp1.100.000, sisa Paylater Rp420.000.
* [ ] **Overdraft Warning:** Coba catat `EXPENSE` Rp600.000 dari GoPay (saldo Rp475.000) $\rightarrow$ peringatan Amber muncul inline; jika tetap disimpan, saldo menjadi `-Rp125.000` dan toast peringatan dari `meta.warnings` tampil.
* [ ] **Soft Delete & Undo 7 Detik:** Hapus transaksi *Jajan & Kopi* Rp25.000 $\rightarrow$ saldo GoPay kembali naik Rp25.000 dan `UndoToast` muncul 7 detik $\rightarrow$ klik **Urungkan** $\rightarrow$ transaksi kembali muncul dan saldo kembali terpotong Rp25.000.
* [ ] **Ketahanan Sesi:** Tekan `F5` (refresh halaman) 15 kali berturut-turut di `/dashboard` $\rightarrow$ sesi tetap login dan tidak pernah muncul error `429`.