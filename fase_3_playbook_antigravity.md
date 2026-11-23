# Phase 3 Playbook: Patch 2B, Debt Destroyer, FIRE L5–L7, Net Worth Snapshots & PDF Export — UPgrade (Antigravity)

Dokumen ini adalah spesifikasi teknis lengkap sekaligus *playbook* eksekusi **Patch 2B + Fase 3** lintas `server/` dan `client/` untuk proyek **UPgrade**.

Simpan file ini di root repositori `upgrade-app/` (sejajar dengan `server/`, `client/`, dan `fase_2_playbook_antigravity.md`).

---

## 1. Ringkasan Ruang Lingkup & Status Skema Database

* **Status Database (`server/prisma/schema.prisma`):** **TIDAK PERLU migrasi skema baru.** Model `Debt` (dengan `isConsumptive`, `totalPrincipal`, `remainingBalance`, `annualInterestPct`, `interestType`, `minimumMonthlyPay`, `dueDateDay`, `isPaidOff`) dan model `NetWorthSnapshot` (dengan `@@unique([userId, snapshotMonth, snapshotYear])`) sudah tersedia di database sejak Fase 1A.
* **Cakupan Pekerjaan Fase 3:**
  1. **Patch 2B (`client/`):** Menutup 3 celah kecil UI/state + kebersihan kode hasil audit Fase 2B sebelum membangun halaman Fase 3.
  2. **Backend Fase 3 (`server/`):**
     * Tambahan rumus finansial murni (`decimal.js`) di `server/src/utils/financialMath.ts`: `simulateDebtPayoff` (*Snowball* vs *Avalanche*, bunga `FLAT` & `EFFECTIVE`, *rollover surplus*, anti *infinite loop*) dan `calculateFireProjection` (*Fisher real return*, kurva *compound interest* Level 5/6/7).
     * CRUD lengkap Utang + Simulator: `POST /api/v1/debts`, `PATCH /api/v1/debts/:id`, `DELETE /api/v1/debts/:id`, `POST /api/v1/debts/simulate`.
     * Endpoint FIRE & Snapshots di modul `analytics`: `POST /api/v1/analytics/fire/simulate`, `GET /api/v1/analytics/snapshots`, `POST /api/v1/analytics/snapshot`.
     * Modul pelaporan PDF (`server/src/modules/reports/` + `server/src/utils/pdfGenerator.ts`): `GET /api/v1/reports/monthly-pdf?year=YYYY&month=MM` berbasis **`pdfkit`** (*streaming* ringan tanpa Puppeteer).
     * *Unit test* Vitest komprehensif di `server/src/__tests__/phase3.debtFirePdf.test.ts`.
  3. **Frontend Fase 3 (`client/`):**
     * Instalasi `recharts` untuk grafik interaktif.
     * Pembaruan navigasi responsif (`AppLayout.tsx`: Sidebar 2 kelompok di desktop + 5 kolom mobile dengan laci **"Lainnya"**).
     * 3 Halaman baru: **`DebtsPage.tsx`** (`/debts`), **`FirePage.tsx`** (`/fire`), dan **`NetWorthPage.tsx`** (`/net-worth`), ditambah tombol cepat **"Unduh PDF"** di `DashboardPage.tsx`.

---

## 2. Spesifikasi Patch 2B (`client/` — Wajib Dikerjakan Pertama)

Bereskan 4 item kebersihan dan *edge case* berikut sebelum membangun fitur baru:

### 2.1 Isolasi Checklist Misi per Pengguna & Kunci Misi Pemulihan (`LevelMissionsCard.tsx`)
* **File:** `client/src/components/dashboard/LevelMissionsCard.tsx` dan `client/src/pages/DashboardPage.tsx`
* **Akar Masalah:** Key `localStorage` masih global (`upgrade_completed_missions_v1`) sehingga centangan Akun A ikut terbaca jika Akun B login di browser yang sama; selain itu misi `RECOVERY_REFILL_EMERGENCY_FUND` seharusnya tidak bisa dicentang manual.
* **Perbaikan:**
  * Tambahkan prop `userId: string` pada `LevelMissionsCard` (dikirim dari `user.id` di `DashboardPage.tsx`).
  * Gunakan key `upgrade_completed_missions_v1_${userId}` dan sinkronkan ulang state `localChecked` lewat `useEffect` setiap kali `userId` berubah.
  * Di `toggleMission(...)`, blokir perubahan manual jika `serverCompleted === true` **atau** `missionId === 'RECOVERY_REFILL_EMERGENCY_FUND'` (tampilkan tooltip/teks kecil *"Otomatis selesai saat Dana Darurat terisi kembali"*).

### 2.2 Perbaiki Bentrokan FAB Mobile & Reset Draf Refetch (`BudgetPage.tsx`)
* **File:** `client/src/pages/BudgetPage.tsx`
* **Perbaikan A (Anti Tumpuk FAB Mobile):** Pada *sticky save bar* di bawah form (`sticky bottom-16 z-10 ...`), tambahkan *padding* kanan aman di mobile (`pr-20 lg:pr-5`) dan susun secara vertikal (`flex-col items-stretch sm:flex-row sm:items-center`) agar tombol melayang `+` (FAB di `right-4 bottom-20`) tidak menutupi tombol **"Simpan Anggaran"**.
* **Perbaikan B (Tahan Draf Saat Background Refetch):** Simpan `lastSyncedKeyRef` (`${period.year}-${period.month}`) dan cek `isDirty`:
  * Sinkronkan `draftAllocations` dari `overview.categories` **hanya** saat periode berubah (`periodKey !== lastSyncedKeyRef.current`), saat draf masih kosong awal, atau tepat setelah mutasi `upsertBudgetsMutation` berhasil (lewat `onSuccess`). Jangan menimpa draf yang sedang disunting pengguna hanya karena ada *background refetch* (misal setelah mencatat transaksi via `Shift + N`).

### 2.3 Hapus Hook Mati `useDashboard.ts`
* **File:** Hapus `client/src/api/hooks/useDashboard.ts`, hapus entri `dashboard` dari `client/src/api/queryKeys.ts`, dan bersihkan panggilan `invalidateQueries({ queryKey: queryKeys.dashboard.all })` yang sudah tidak terpakai di `useAccounts.ts`, `useAuth.ts`, `useBudgets.ts`, `useOnboarding.ts`, dan `useTransactions.ts` (karena seluruh aplikasi kini memakai `queryKeys.analytics`).

### 2.4 Banner Error + Tombol "Coba Lagi" Saat Query Gagal
* **File:** `client/src/pages/DashboardPage.tsx`, `client/src/pages/BudgetPage.tsx`, dan seluruh halaman Fase 3 baru.
* **Perbaikan:** Buat komponen ringan `client/src/components/common/ErrorBanner.tsx` (`message`, `onRetry`) dan tampilkan saat `isError === true` agar pengguna tidak melihat angka `Rp0` yang menyesatkan ketika koneksi ke server terputus.

---

## 3. Spesifikasi Backend Fase 3 (`server/`)

Semua aturan arsitektur tetap berlaku ketat: **ESM `.js` import**, **Zod v4**, **100% `decimal.js` (`precision: 40`, `ROUND_HALF_UP`)**, **anti-IDOR (`userId` scoping)**, dan **pesan Bahasa Indonesia**.

### 3.1 Tambahan Rumus Murni di `server/src/utils/financialMath.ts`

#### A. `simulateDebtPayoff(params)` (*Debt Destroyer*: Snowball vs Avalanche)
* **Input:**
  * `debts`: array utang aktif dengan `{ id, name, totalPrincipal: Decimal, remainingBalance: Decimal, annualInterestPct: Decimal, interestType: 'FLAT' | 'EFFECTIVE', minimumMonthlyPay: Decimal }`.
  * `extraMonthlyPayment: Decimal` ($\ge 0$).
  * `startDate?: Date` (default: `new Date()` dalam WIB).
* **Konstanta Guard:** `MAX_SIMULATION_MONTHS = 600` (50 tahun — mencegah *infinite loop* mutlak).
* **Algoritma untuk Masing-Masing Strategi (`SNOWBALL` & `AVALANCHE`):**
  1. Saring utang dengan `remainingBalance.gt(ZERO)`. Jika kosong, kembalikan `isPayable: true`, `monthsToDebtFree: 0`, `totalInterestPaid: "0.00"`, `schedule: []`, `payoffOrder: []`.
  2. Urutkan prioritas awal:
     * **`SNOWBALL`:** `remainingBalance ASC`, *tie-breaker* `annualInterestPct DESC`, lalu `name ASC`.
     * **`AVALANCHE`:** `annualInterestPct DESC`, *tie-breaker* `remainingBalance ASC`, lalu `name ASC`.
  3. Hitung anggaran bulanan tetap (*rollover pool*):
     $$\text{monthlyBudget} = \left(\sum_{i} \text{minimumMonthlyPay}_i\right) + \text{extraMonthlyPayment}$$
     *(Karena total anggaran bulanan tetap konstan setiap bulan, begitu satu utang lunas, porsi cicilan minimumnya otomatis bergulir / rollover ke utang prioritas berikutnya).*
  4. **Guard Awal Anti-Utang Tak Terbayar:** Hitung total bunga bulan ke-1 dari seluruh utang. Jika $\text{monthlyBudget} \le \text{totalFirstMonthInterest}$ (atau `monthlyBudget.lte(ZERO)`), langsung hentikan dan kembalikan `isPayable: false`, `unpayableReason: "Total pembayaran bulanan belum mencukupi untuk menutup beban bunga utang. Tambahkan pembayaran ekstra bulanan."`.
  5. **Iterasi Bulan $m = 1 \dots 600$:**
     * Untuk setiap utang aktif (`balance > 0`), hitung bunga bulan ini:
       * Jika `interestType === 'FLAT'`:
         $$I_i = \text{totalPrincipal}_i \times \frac{\text{annualInterestPct}_i}{100 \times 12}$$
       * Jika `interestType === 'EFFECTIVE'`:
         $$I_i = \text{balance}_i \times \frac{\text{annualInterestPct}_i}{100 \times 12}$$
     * Bulatkan $I_i$ ke 2 desimal (`toDecimalPlaces(2, Decimal.ROUND_HALF_UP)`).
     * **Tahap 1 (Cicilan Minimum):** Sisihkan dari `remainingBudget = monthlyBudget` untuk tiap utang aktif sebesar $\min(\text{minimumMonthlyPay}_i, \text{balance}_i + I_i, \text{remainingBudget})$. Pembayaran dialokasikan untuk melunasi bunga $I_i$ terlebih dahulu; sisanya memotong pokok `balance_i`.
     * **Tahap 2 (*Extra & Rollover Allocation*):** Selama `remainingBudget > 0`, alokasikan sisa anggaran mengikuti urutan prioritas strategi ke utang aktif pertama: lunasi sisa bunga yang belum terbayar (jika ada), lalu potong `balance_i` hingga 0.
     * Jika sebuah utang mencapai `balance == 0` pada bulan $m$, catat ke `payoffOrder` (`debtId`, `name`, `paidOffMonth: m`, `paidOffDate`, `totalInterestPaid`).
     * Catat ringkasan bulan ke `schedule` (`month: m`, `date: YYYY-MM`, `totalRemainingBalance`, `totalInterestThisMonth`, `totalPrincipalThisMonth`, `totalPaidThisMonth`).
     * Hentikan loop jika seluruh utang mencapai `0`.
  6. Jika setelah bulan ke-600 masih ada saldo $> 0$, kembalikan `isPayable: false` dengan `unpayableReason` Bahasa Indonesia.
* **Perbandingan (`comparison`):**
  * `interestSavedByAvalanche = snowball.totalInterestPaid - avalanche.totalInterestPaid` (jika keduanya `isPayable`).
  * `monthsSavedByAvalanche = snowball.monthsToDebtFree - avalanche.monthsToDebtFree`.
  * `recommendedStrategy`: `'AVALANCHE'` jika `interestSavedByAvalanche.gt(ZERO)`, `'SNOWBALL'` jika `interestSavedByAvalanche.lt(ZERO)`, atau `'TIE'` jika sama.

#### B. `calculateFireProjection(params)` (*SWR & FIRE Countdown L5–L7*)
* **Input:**
  * `monthlyEssentialBasis: Decimal`
  * `currentInvestmentPortfolio: Decimal`
  * `monthlyContribution: Decimal` ($\ge 0$)
  * `swrRatePct: Decimal` ($> 0$, default `4.00`)
  * `inflationRatePct: Decimal` ($\ge 0$, default `4.50`)
  * `expectedReturnRatePct: Decimal` ($\ge 0$, default `10.00`)
  * `maxYears?: number` (default `50`, dibatasi `1..60`)
  * `startDate?: Date`
* **Rumus Wajib (`decimal.js`):**
  * Pengeluaran pokok tahunan:
    $$\text{annualEssential} = \text{monthlyEssentialBasis} \times 12$$
  * Target 3 Tangga Kekayaan:
    * Level 5 (*Fleksibilitas*): $\text{targetLevel5} = \text{annualEssential}$
    * Level 6 (*FIRE Number*): $\text{fireNumber} = \frac{\text{annualEssential}}{\text{swrRatePct} / 100}$
    * Level 7 (*Abundant Wealth*): $\text{abundantNumber} = \text{fireNumber} \times 2$
  * Tingkat Imbal Hasil Riil Tahunan (*Fisher Equation*):
    $$r_{\text{real}} = \frac{1 + r_{\text{return}}/100}{1 + r_{\text{inflation}}/100} - 1$$
    $$\text{realReturnRatePct} = r_{\text{real}} \times 100$$
  * Laju bulanan riil: $r_m = \frac{r_{\text{real}}}{12}$.
  * Simulasi bulanan $m = 1 \dots (\text{maxYears} \times 12)$:
    $$\text{portfolio}_m = \max\left(0, \text{portfolio}_{m-1} \times (1 + r_m) + \text{monthlyContribution}\right)$$
    $$\text{contributed}_m = \text{contributed}_{m-1} + \text{monthlyContribution}$$
  * Catat bulan pencapaian pertama untuk Level 5, Level 6 (FIRE), dan Level 7 (`monthsToTarget`, `years`, `remainingMonths`, `targetDate: YYYY-MM`, `alreadyReached`, `isReachableWithinHorizon`).
  * Kembalikan array `yearlyProjection` (tahun `0` sampai $\min(\text{maxYears}, \max(10, \text{fireYears} + 5))$ agar grafik `Recharts` selalu proporsional dan informatif): `{ year, calendarYear, projectedPortfolio, totalContributed, investmentGrowth, fireNumber, level5Target, abundantNumber }`.
  * **Guard:** Jika `monthlyEssentialBasis.lte(ZERO)` atau `swrRatePct.lte(ZERO)`, kembalikan target `"0.00"` tanpa *division by zero*.

---

### 3.2 Modul Utang Lengkap (`server/src/modules/debts/`)

Perluas modul `debts` yang sudah memiliki `GET /api/v1/debts`:

| Method | Endpoint | Validasi & Perilaku Bisnis |
| :--- | :--- | :--- |
| `GET` | `/api/v1/debts` | (Sudah ada) Filter opsional `?activeOnly=true\|false`. |
| `POST` | `/api/v1/debts` | Buat utang baru (`name`, `isConsumptive`, `totalPrincipal: positiveMoney`, `remainingBalance?: nonNegativeMoney <= totalPrincipal`, `annualInterestPct: percentageRate`, `interestType: FLAT\|EFFECTIVE`, `minimumMonthlyPay: nonNegativeMoney`, `dueDateDay?: 1..31`). Otomatis set `isPaidOff = remainingBalance.isZero()`. Kembalikan status `201`. |
| `PATCH` | `/api/v1/debts/:id` | Ubah data utang milik `userId` (anti-IDOR). Boleh ubah `name`, `isConsumptive`, `annualInterestPct`, `interestType`, `minimumMonthlyPay`, `dueDateDay`. Jika `remainingBalance` dikirim: **hanya izinkan** bila utang belum memiliki transaksi `DEBT_PAYMENT` (`count === 0`) dan `<= totalPrincipal`; jika sudah ada riwayat pembayaran, tolak `409 Conflict` (*"Sisa utang tidak bisa diubah langsung karena sudah memiliki riwayat pembayaran. Gunakan transaksi Bayar Utang."*). |
| `DELETE` | `/api/v1/debts/:id` | Anti-IDOR. Jika utang sudah memiliki transaksi `DEBT_PAYMENT` (termasuk *soft-deleted* untuk integritas *Undo*), tolak `409 Conflict` (*"Utang yang sudah memiliki riwayat pembayaran tidak dapat dihapus."*). |
| `POST` | `/api/v1/debts/simulate` | Body `{ extraMonthlyPayment: nonNegativeMoney (default "0") }`. Ambil semua utang aktif milik `userId`, panggil `simulateDebtPayoff`, dan kembalikan `{ activeDebtsCount, totalRemainingBalance, totalMinimumMonthlyPay, extraMonthlyPayment, snowball, avalanche, comparison }`. |

---

### 3.3 Perluasan Modul Analitik: FIRE & Net Worth Snapshots (`server/src/modules/analytics/`)

Tambahkan 3 endpoint baru pada `analytics.routes.ts` (tetap di bawah `authCookie`):

1. **`POST /api/v1/analytics/fire/simulate`**
   * Body Zod (semua field opsional agar bisa langsung dipanggil dengan `{}` memakai data aktual pengguna):
     * `monthlyEssentialBasis?: positiveMoney`
     * `currentInvestmentPortfolio?: nonNegativeMoney`
     * `monthlyContribution?: nonNegativeMoney`
     * `swrRatePct?: positiveRate` (`> 0` dan `<= 100`)
     * `inflationRatePct?: percentageRate` (`0..100`)
     * `expectedReturnRatePct?: percentageRate` (`0..100`)
     * `maxYears?: integer 5..60` (default `40`)
   * Jika field tidak dikirim, ambil nilai *default* dari database pengguna:
     * `monthlyEssentialBasis` dari `calculateEmergencyFundTarget` (otomatis *cold-start* `Estimasi Awal` vs `Data Aktual`).
     * `currentInvestmentPortfolio` dari jumlah saldo akun `type === 'INVESTMENT'`.
     * `monthlyContribution` dari `max(0, surplus bulan berjalan)` (atau `"0"` jika defisit).
     * `swrRatePct`, `inflationRatePct`, `expectedReturnRatePct` dari tabel `User`.
   * Kembalikan `{ inputsUsed, dataSourceBadge, projection }` hasil `calculateFireProjection`.

2. **`GET /api/v1/analytics/snapshots`**
   * Mengambil seluruh `NetWorthSnapshot` milik `userId` urut kronologis (`snapshotYear ASC, snapshotMonth ASC`), plus ringkasan Neraca *live* saat ini (`currentBalanceSheet`: `totalAssets`, `totalLiabilities`, `netWorth`, `assetsByType`, `consumptiveDebtTotal`, `productiveDebtTotal`).

3. **`POST /api/v1/analytics/snapshot`** (*Tutup Buku Bulanan*)
   * Body Zod opsional `{ year?: 2000..2100, month?: 1..12 }` (default: periode WIB saat ini).
   * Hitung `totalAssets`, `totalLiabilities`, `netWorth`, dan `savingRatePct` periode tersebut menggunakan `calculateDashboardSummary` (`decimal.js`), lalu lakukan `prisma.netWorthSnapshot.upsert` berdasarkan `userId_snapshotMonth_snapshotYear`.
   * Kembalikan status `201` dengan objek `snapshot` terbaru dan pesan `"Snapshot Neraca periode [Bulan Tahun] berhasil disimpan."`.

---

### 3.4 Modul Export Laporan PDF Bulanan (`server/src/modules/reports/` & `server/src/utils/pdfGenerator.ts`)

Buat modul baru `reports` dan daftarkan `app.use('/api/v1/reports', authCookie, reportsRouter);` di `server/src/app.ts`.

* **Endpoint:** `GET /api/v1/reports/monthly-pdf?year=YYYY&month=MM`
  * Validasi query memakai `year` (`2000..2100`) & `month` (`1..12`), default ke `getCurrentWibPeriod()`.
  * Ambil data: identitas `user` (`name`, `email`), hasil `getAnalyticsDashboard(userId, period)`, dan daftar transaksi aktif periode tersebut (`deletedAt: null`, `[monthStart, nextMonthStart)`, `orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }]`, *include* `sourceAccount`, `destinationAccount`, `category`, `debt`).
  * Panggil `generateMonthlyReportPdf(reportData)` (menggunakan `pdfkit` yang sudah terpasang di `server/package.json`) yang menghasilkan `Promise<Buffer>` atau *stream* langsung ke `res`.
  * Set header HTTP:
    * `Content-Type: application/pdf`
    * `Content-Disposition: attachment; filename="UPgrade-Laporan-${year}-${String(month).padStart(2, '0')}.pdf"`
    * `Cache-Control: no-store`
* **Panduan Layout `pdfGenerator.ts` (Anti Kolom Tumpang Tindih):**
  * Ukuran kertas `A4`, margin `42pt`, font standar bawaan `Helvetica` & `Helvetica-Bold` (tidak bergantung file font eksternal).
  * **Bagian 1 — Header:** Judul **"UPgrade — Laporan Keuangan Bulanan"**, subjudul periode (`November 2026`), nama & email pengguna, serta waktu cetak WIB.
  * **Bagian 2 — Ringkasan Eksekutif (Grid 2 Kolom):**
    * Kolom Kiri (*Arus Kas*): Pemasukan, Pengeluaran Pokok, Pengeluaran Diskresi, Cicilan Utang, Surplus/Defisit, Saving Rate.
    * Kolom Kanan (*Neraca & Level*): Total Aset, Total Utang Aktif, Net Worth, Level UPgrade (`Level X — [Nama]`), Status (`Normal` / `Mode Pemulihan`), Progres Dana Darurat (`[saldo] / [target]`, label `Estimasi Awal` / `Data Aktual`).
  * **Bagian 3 — Top 5 Kategori Pengeluaran & Temuan *Latte Factor*:** Tabel ringkas kategori pengeluaran terbesar bulan ini + daftar pos kebocoran *Latte Factor* (atau teks *"Tidak ada kebocoran halus terdeteksi dalam 30 hari terakhir."*).
  * **Bagian 4 — Rincian Mutasi Transaksi:** Tabel 5 kolom dengan lebar tetap dalam batas printable width (`511pt`): `Tanggal (68pt)`, `Jenis (68pt)`, `Kategori / Catatan (175pt)`, `Akun (110pt)`, `Nominal (90pt, right-aligned)`.
  * **Kontrol Halaman Otomatis:** Sebelum menggambar setiap baris tabel, periksa `if (doc.y > doc.page.height - 70)`: panggil `doc.addPage()` dan gambar ulang header kolom tabel agar tidak pernah terpotong atau bertumpuk. Tambahkan nomor halaman di footer (*"Halaman X dari Y — Dihasilkan oleh UPgrade"*).

---

### 3.5 Unit Test Backend Fase 3 (`server/src/__tests__/phase3.debtFirePdf.test.ts`)

Wajib menguji skenario berikut lewat Vitest:
1. **Debt Destroyer `FLAT` vs `EFFECTIVE`:** Verifikasi akurasi perhitungan bunga bulan ke-1 dan penurunan bunga di bulan berikutnya pada tipe `EFFECTIVE` dibanding tetap pada `FLAT`.
2. **Snowball vs Avalanche & Rollover Surplus:** Kasus 2 utang (Utang A: sisa Rp1.000.000 bunga 5% efektif; Utang B: sisa Rp3.000.000 bunga 24% efektif) $\rightarrow$ verifikasi urutan lunas berbeda, `avalanche.totalInterestPaid < snowball.totalInterestPaid`, `comparison.recommendedStrategy === 'AVALANCHE'`, dan `interestSavedByAvalanche > 0`.
3. **Unpayable Debt Guard (Anti Infinite Loop):** Ketika `minimumMonthlyPay + extraMonthlyPayment <= monthlyInterest`, fungsi langsung mengembalikan `isPayable: false` dalam < 10 ms tanpa menggantung.
4. **FIRE Projection & Fisher Real Return:** Verifikasi `fireNumber = 25 * annualEssential` saat `SWR = 4%`, `realReturnRatePct` akurat sesuai $\frac{1.10}{1.045} - 1 \approx 5{,}26\%$, kasus `alreadyReached` (`monthsToTarget === 0`), serta kasus *negative real return* (`inflationRate > expectedReturnRate`) tanpa `NaN`.
5. **PDF Generator Smoke Test:** Menghasilkan `Buffer` valid yang diawali `%PDF-` untuk kasus 0 transaksi (empty state) dan kasus 60 transaksi (memverifikasi multi-halaman berjalan tanpa error).

---

## 4. Spesifikasi Frontend Fase 3 (`client/`)

### 4.1 Dependensi, Tipe & Hooks API
* Pasang `recharts` di `client/` (`npm install recharts`).
* Tambahkan tipe 1:1 di `client/src/api/types.ts` untuk `CreateDebtPayload`, `UpdateDebtPayload`, `DebtSimulationResult`, `FireSimulationPayload`, `FireSimulationResult`, `NetWorthSnapshotItem`, `NetWorthSnapshotsResponse`.
* Perbarui `client/src/api/queryKeys.ts` dengan `snapshots: { all: ['analytics', 'snapshots'] }` dan `fire: { all: ['analytics', 'fire'] }`.
* Perluas `client/src/api/hooks/useDebts.ts`: tambahkan `useCreateDebt`, `useUpdateDebt`, `useDeleteDebt`, `useSimulateDebts`. Pastikan mutasi utang menginvalidasi `debts.all`, `analytics.all`, `budgets.all`, dan `auth.me`.
* Perluas `client/src/api/hooks/useAnalytics.ts`: tambahkan `useFireSimulation`, `useNetWorthSnapshots`, `useCreateSnapshot`.
* Buat `client/src/api/hooks/useReports.ts` berisi fungsi `downloadMonthlyPdf(year, month)` menggunakan `apiClient.get('/reports/monthly-pdf', { params: { year, month }, responseType: 'blob' })`, memicu unduhan file `UPgrade-Laporan-YYYY-MM.pdf` via `URL.createObjectURL`, dan mem-parse pesan error JSON jika respons error berbentuk `Blob`.

### 4.2 Pembaruan Navigasi Responsif (`AppLayout.tsx` & `App.tsx`)
* Tambahkan 3 rute terproteksi di `App.tsx`: `/debts` (`DebtsPage`), `/fire` (`FirePage`), `/net-worth` (`NetWorthPage`).
* **Desktop Sidebar:** Kelompokkan menjadi 2 grup visual yang bersih:
  * **Harian:** Dashboard (`/dashboard`), Riwayat Transaksi (`/transactions`), Anggaran (`/budgets`).
  * **Strategi & Aset:** Bebas Utang (`/debts`), Kalkulator FIRE (`/fire`), Neraca & Laporan (`/net-worth`), Akun & Kategori (`/accounts`), Pengaturan (`/settings`).
* **Mobile Bottom Navigation:** Pertahankan tepat **5 tombol** (`Dashboard`, `Transaksi`, `Anggaran`, `Utang`, `Lainnya`). Tombol **"Lainnya"** membuka *drawer* / modal bawah yang rapi berisi tautan ke **Kalkulator FIRE**, **Neraca & Laporan PDF**, **Akun & Kategori**, dan **Pengaturan** (menyorot aktif jika pengguna berada di salah satu rute tersebut).

### 4.3 Halaman Baru Fase 3

#### 1. `client/src/pages/DebtsPage.tsx` (`/debts` — Debt Destroyer)
* **Ringkasan KPI Utang:** Total Sisa Utang Aktif, Total Utang Konsumtif (syarat Level 4 = Rp0), dan Total Cicilan Minimum Bulanan.
* **Manajemen Utang (CRUD):**
  * Daftar utang aktif & tab/bagian utang lunas (`isPaidOff === true`).
  * Setiap kartu utang menampilkan nama, badge `Konsumtif` / `Produktif`, sisa pokok vs total pokok (*progress bar* pelunasan), bunga `%` & jenis (`Flat` / `Efektif`), jatuh tempo tanggal ke-`dueDateDay`, tombol cepat **`Bayar Cicilan`** (membuka `QuickAddModal('DEBT_PAYMENT')`), tombol **Ubah**, dan tombol **Hapus**.
  * Modal **Tambah Utang** & Modal **Ubah Utang** (jelaskan bahwa sisa utang tidak dapat diedit langsung jika sudah ada pembayaran).
* **Panel Simulasi Interaktif (*Snowball* vs *Avalanche*):**
  * Input **`Pembayaran Ekstra Bulanan`** (`MoneyInput` + tombol cepat `+Rp100rb`, `+Rp500rb`, `+Rp1jt`) dengan tombol **"Simulasikan Pelunasan"**.
  * Dua kartu perbandingan berdampingan (**Debt Snowball** vs **Debt Avalanche**) menampilkan `debtFreeDate`, durasi bulan, total bunga dibayar, dan banner rekomendasi: *"Metode Avalanche menghemat bunga sebesar Rp... dan lebih cepat X bulan!"*.
  * Grafik **`Recharts` `LineChart`** membandingkan kurva penurunan total sisa utang per bulan antara *Snowball* (indigo) dan *Avalanche* (emerald), serta urutan pelunasan utang (*payoff order*).
  * Jika `isPayable === false`, tampilkan kotak peringatan Amber dengan pesan `unpayableReason` dari backend.

#### 2. `client/src/pages/FirePage.tsx` (`/fire` — Kalkulator SWR & FIRE Countdown L5–L7)
* **Kartu Target 3 Tangga Kekayaan (L5, L6, L7):** Progres portofolio investasi saat ini terhadap **Level 5 (12x Pengeluaran Pokok)**, **Level 6 (Angka FIRE)**, dan **Level 7 (2x Angka FIRE)** lengkap dengan badge sumber data (`Estimasi Awal` vs `Data Aktual`).
* **Banner Countdown FIRE:** Menonjolkan estimasi waktu menuju Level 6 (*"Estimasi mencapai Kebebasan Finansial Dasar dalam X Tahun Y Bulan — [Bulan Tahun]"*), beserta nilai **Imbal Hasil Riil (setelah inflasi)** yang dihitung dari *Fisher Equation*.
* **Panel Kontrol Parameter Interaktif:**
  * `MoneyInput` untuk Pengeluaran Pokok Bulanan, Portofolio Investasi Awal, dan Setoran Investasi Rutin/bln.
  * Input/slider untuk **SWR (%)**, **Inflasi (%)**, dan **Ekspektasi Return Investasi (%)**.
  * Dua tombol aksi: **"Hitung Proyeksi"** (`POST /analytics/fire/simulate`) dan **"Simpan Asumsi ke Profil"** (`PATCH /auth/preferences` untuk SWR/Inflasi/Return).
* **Grafik Proyeksi `Recharts` `AreaChart`:** Membandingkan pertumbuhan **`Total Portofolio`** (area indigo/emerald) melawan **`Total Modal Disetor`** (area slate) sepanjang sumbu tahun, dilengkapi garis referensi horizontal (`ReferenceLine`) untuk **Target Level 5** dan **Angka FIRE (Level 6)**.

#### 3. `client/src/pages/NetWorthPage.tsx` (`/net-worth` — Neraca, Snapshot Historis & Export PDF)
* **Ringkasan Neraca Keuangan (*Balance Sheet*):** 3 KPI utama (*Total Aset*, *Total Liabilitas*, *Kekayaan Bersih*) diikuti rincian Aset dikelompokkan berdasarkan jenis (`Tunai`, `Bank`, `E-Wallet`, `Dana Darurat`, `Investasi`) dan Liabilitas (`Utang Konsumtif` vs `Utang Produktif`).
* **Panel Snapshot Historis & "Tutup Buku Bulan Ini":**
  * Pemilih bulan/tahun WIB + tombol **`Simpan Snapshot Bulan Ini`** (`POST /api/v1/analytics/snapshot`).
  * Grafik **`Recharts` `AreaChart` / `LineChart`** menampilkan tren historis **Kekayaan Bersih**, **Total Aset**, dan **Total Liabilitas** dari seluruh snapshot yang tersimpan (atau `EmptyState` ramah dengan tombol simpan snapshot pertama jika data masih kosong).
  * Tabel riwayat snapshot bulanan (Periode, Aset, Liabilitas, Net Worth, Saving Rate %).
* **Panel Export Laporan Kas Bulanan (PDF):**
  * Pemilih periode bulan/tahun + tombol **`Unduh Laporan Bulanan (PDF)`** yang memanggil `downloadMonthlyPdf(year, month)` dengan indikator loading dan *toast* notifikasi.
  * Tambahkan juga tombol cepat **`Unduh PDF`** di baris header `DashboardPage.tsx` yang langsung mengunduh laporan PDF untuk periode yang sedang dipilih di Dashboard.

---

## 5. Prompt Eksekusi Siap Salin untuk Agent Antigravity

Eksekusi Fase 3 dalam **2 tahap berurutan** (**Trigger 3A** lalu **Trigger 3B**) agar tetap aman dari batas kuota dan mudah diaudit.

### Trigger 3A — Patch 2B (`client/`) + Backend Fase 3 (`server/`)

Salin dan tempel prompt berikut ke panel Agent Antigravity:

```text
Execute **Phase 3 — Part A (Patch 2B Client Fixes + Backend Phase 3: Debt Destroyer, FIRE L5–L7, Net Worth Snapshots & PDFKit Export)** strictly according to @PHASE_3_ANTIGRAVITY.md and @.agent/rules/upgrade-rules.md.

Do NOT build the Phase 3 Frontend pages (`DebtsPage`, `FirePage`, `NetWorthPage`) in this turn yet — finish Patch 2B and the entire Backend Phase 3 cleanly with passing builds and tests first.

Scope of work:
1. **Patch 2B (`client/`):**
   - `LevelMissionsCard.tsx` + `DashboardPage.tsx`: scope `localStorage` mission completion key by `userId` (`upgrade_completed_missions_v1_${userId}`), reset when `userId` changes, and lock `RECOVERY_REFILL_EMERGENCY_FUND` so it cannot be manually checked off.
   - `BudgetPage.tsx`: add safe mobile right padding (`pr-20 lg:pr-5`) / stacked layout on the sticky save bar so the Mobile FAB never overlaps the Save button, and prevent background refetches from overwriting unsaved `draftAllocations` while `isDirty` is true (reset draft only on period change or after save/reset).
   - Remove unused `client/src/api/hooks/useDashboard.ts` and clean up unused `queryKeys.dashboard` references across hooks.
   - Add reusable `client/src/components/common/ErrorBanner.tsx` with a `"Coba Lagi"` retry button and wire it into `DashboardPage.tsx` and `BudgetPage.tsx` when queries error.

2. **Backend Phase 3 (`server/` — NO Prisma schema changes needed):**
   - Extend `server/src/utils/financialMath.ts` strictly using `decimal.js` (zero JS number math):
     - `simulateDebtPayoff` (SNOWBALL vs AVALANCHE, FLAT & EFFECTIVE interest, rollover surplus, 600-month anti-infinite-loop guard with `isPayable: false` + Indonesian reason, payoff order, monthly schedule, and exact interest/months saved comparison).
     - `calculateFireProjection` (Level 5 12x essential, Level 6 FIRE Number, Level 7 2x FIRE, Fisher real return rate `(1 + r) / (1 + inf) - 1`, monthly compound simulation, countdown years/months, and yearly chart projection points with division-by-zero guards).
   - Complete `server/src/modules/debts/`: implement `POST /api/v1/debts`, `PATCH /api/v1/debts/:id` (protect `remainingBalance` when payments exist), `DELETE /api/v1/debts/:id` (block deletion if payments exist), and `POST /api/v1/debts/simulate` — all strictly userId-scoped (anti-IDOR).
   - Extend `server/src/modules/analytics/`: implement `POST /api/v1/analytics/fire/simulate`, `GET /api/v1/analytics/snapshots` (including live balance sheet breakdown), and `POST /api/v1/analytics/snapshot` (upsert monthly `NetWorthSnapshot`).
   - Build `server/src/utils/pdfGenerator.ts` and `server/src/modules/reports/` (`GET /api/v1/reports/monthly-pdf?year=YYYY&month=MM`) using `pdfkit` (NO Puppeteer) with clean A4 Bahasa Indonesia layout, Executive Summary, Milestone & Emergency Fund status, Top 5 Expense Categories & Latte Factor findings, and paginated transaction table with repeating headers and zero overlapping columns. Mount `reportsRouter` under `authCookie` in `server/src/app.ts`.
   - Write comprehensive Vitest tests in `server/src/__tests__/phase3.debtFirePdf.test.ts` covering all scenarios in Section 3.5 of @PHASE_3_ANTIGRAVITY.md (including PDF `%PDF-` buffer smoke test for empty and 60-row multi-page reports).

Verification commands to run and fix before reporting completion:
- In `server/`: `npm run typecheck`, `npm run build`, `npm test`
- In `client/`: `npm run typecheck`, `npm run build`, `npm test`

Report all modified/created files and passing test counts before stopping for Trigger 3B.
```

### Trigger 3B — Frontend Fase 3 (`client/`)

Setelah Trigger 3A lulus seluruh `typecheck`, `build`, dan `test`, salin dan tempel prompt berikut:

```text
Phase 3 Part A is 100% passing. Now execute **Phase 3 — Part B (Frontend Phase 3: Debt Destroyer, FIRE Calculator L5–L7, Net Worth Snapshots & PDF Export)** strictly according to Section 4 of @PHASE_3_ANTIGRAVITY.md and @.agent/rules/upgrade-rules.md.

Scope of work (`client/` ONLY — do NOT modify `server/` unless an actual contract bug is proven):
1. Install `recharts` in `client/`.
2. Update `client/src/api/types.ts`, `queryKeys.ts`, `useDebts.ts` (add create/update/delete/simulate hooks with full cache invalidation), `useAnalytics.ts` (add `useFireSimulation`, `useNetWorthSnapshots`, `useCreateSnapshot`), and create `client/src/api/hooks/useReports.ts` (`downloadMonthlyPdf` via `responseType: 'blob'` with JSON error-blob parsing).
3. Update `App.tsx` and `AppLayout.tsx`:
   - Add protected routes `/debts`, `/fire`, and `/net-worth`.
   - Group Desktop Sidebar cleanly into "Harian" (Dashboard, Transaksi, Anggaran) and "Strategi & Aset" (Bebas Utang, Kalkulator FIRE, Neraca & Laporan, Akun & Kategori, Pengaturan).
   - Keep Mobile Bottom Navigation to 5 clean slots (Dashboard, Transaksi, Anggaran, Utang, Lainnya) where "Lainnya" opens an accessible bottom drawer linking to Kalkulator FIRE, Neraca & Laporan PDF, Akun & Kategori, and Pengaturan.
4. Build `client/src/pages/DebtsPage.tsx`:
   - Debt KPI summary cards, Active & Paid-Off debt lists, Add/Edit/Delete Debt modals, quick "Bayar Cicilan" button opening `QuickAddModal('DEBT_PAYMENT')`.
   - Interactive Snowball vs Avalanche simulator with `MoneyInput` extra payment + quick preset chips, side-by-side comparison cards showing exact interest saved & `debtFreeDate`, payoff order list, `Recharts` `LineChart` balance trajectory comparison, and Amber unpayable warning handling.
5. Build `client/src/pages/FirePage.tsx`:
   - Level 5 / Level 6 (FIRE) / Level 7 (Abundant) progress cards with `Estimasi Awal` vs `Data Aktual` badge.
   - Countdown summary banner with Fisher real-return display.
   - Interactive parameter panel (`MoneyInput` + SWR/Inflation/Return controls) with "Hitung Proyeksi" and "Simpan Asumsi ke Profil" (`PATCH /auth/preferences`) buttons.
   - `Recharts` `AreaChart` plotting compounded portfolio growth vs total capital contributed with `ReferenceLine` markers for Level 5 and FIRE Number.
6. Build `client/src/pages/NetWorthPage.tsx` and add quick PDF button to `DashboardPage.tsx`:
   - Live Balance Sheet breakdown (Assets by `AccountType` vs Consumptive/Productive Liabilities).
   - Monthly Snapshot section with "Simpan Snapshot Bulan Ini" (`POST /analytics/snapshot`), `Recharts` historical Net Worth trend chart, and snapshot history table.
   - Monthly PDF Export panel (period selector + "Unduh Laporan Bulanan (PDF)" button) plus a convenient quick "Unduh PDF" button on `DashboardPage.tsx` header for the active selected period.

All user-facing UI text, chart tooltips, empty states, validation messages, and toasts MUST be in natural Bahasa Indonesia. Zero JS floating-point arithmetic on monetary values (always use `decimal.js` helpers for math; pass `Number(...)` ONLY at the final Recharts chart data boundary). Zero placeholders or `// TODO`.

Verification commands to run in `client/` and fix before reporting completion:
- `npm run typecheck`
- `npm run build`
- `npm test`

Summarize all created/modified files and confirm readiness for End-to-End Phase 3 testing.
```

---

## 6. Checklist Verifikasi End-to-End (Definition of Done Fase 3)

Jalankan `server` (`:4000`) dan `client` (`:5173`), lalu verifikasi seluruh alur berikut:

* [ ] **Build & Unit Test:** `typecheck`, `build`, dan `test` di `server/` maupun `client/` seluruhnya hijau (0 error).
* [ ] **Verifikasi Patch 2B:**
  * Centang misi di Akun A, keluar, masuk Akun B $\rightarrow$ centangan Akun A tidak muncul di Akun B; misi *Recovery Mode* tidak bisa dicentang manual.
  * Di tampilan mobile (`375px`) halaman `/budgets`, tombol *"Simpan Anggaran"* tidak tertutup FAB `+`, dan draf yang belum disimpan tidak hilang saat mencatat transaksi lewat `QuickAddModal`.
* [ ] **Debt Destroyer (`/debts`):**
  * Tambah 2 utang (misal Utang A Rp1.000.000 bunga 6% Efektif; Utang B Rp3.000.000 bunga 24% Efektif) $\rightarrow$ jalankan simulasi dengan ekstra Rp500.000/bln $\rightarrow$ kartu perbandingan menunjukkan **Avalanche** menghemat bunga lebih besar dari **Snowball**, grafik kurva tampil mulus, dan tombol *"Bayar Cicilan"* membuka tab `DEBT_PAYMENT`.
  * Coba hapus utang yang sudah pernah dibayar $\rightarrow$ ditolak ramah (`409`).
* [ ] **Kalkulator SWR & FIRE (`/fire`):**
  * Ubah setoran investasi bulanan atau ubah `SWR` dari `4%` ke `3.5%` $\rightarrow$ Angka FIRE, countdown tahun/bulan, dan kurva `AreaChart` langsung terbarui.
  * Klik *"Simpan Asumsi ke Profil"* $\rightarrow$ perubahan tersimpan di `SettingsPage` dan bertahan setelah refresh.
* [ ] **Neraca & Snapshot (`/net-worth`):**
  * Klik *"Simpan Snapshot Bulan Ini"* $\rightarrow$ baris snapshot muncul di tabel & grafik tren; klik ulang di bulan yang sama memperbarui (*upsert*) baris bulan tersebut tanpa duplikasi.
* [ ] **Export Laporan PDF:**
  * Klik *"Unduh Laporan Bulanan (PDF)"* di `/net-worth` atau *"Unduh PDF"* di `/dashboard` $\rightarrow$ file `UPgrade-Laporan-YYYY-MM.pdf` terunduh, dapat dibuka normal di PDF viewer, menampilkan Ringkasan Eksekutif, Status Level, Top 5 Pengeluaran, *Latte Factor*, dan tabel transaksi rapi tanpa teks bertumpuk.