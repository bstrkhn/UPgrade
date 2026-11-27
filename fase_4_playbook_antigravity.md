# Phase 4 Playbook: Final QA, Security Hardening, Performance & Cloud Deployment — UPgrade (Antigravity)

Dokumen ini adalah panduan tahap akhir (**Fase 4**) untuk proyek **UPgrade**. Isinya merangkum hasil audit menyeluruh kode Fase 3 (`server` 55/55 test & `client` 26/26 test), daftar penambalan terakhir sebelum *go-live*, optimasi performa SPA, audit keamanan/IDOR, serta konfigurasi *deployment* penuh ke **Neon/Supabase + Render/Railway + Vercel**.

Simpan file ini di root repositori `upgrade-app/` (sejajar dengan `server/` dan `client/`).

## 1. Hasil Audit Kode Fase 3 (Ringkasan & Temuan Pra-Produksi)

Seluruh fitur utama Fase 1–3 sudah selesai, lulus `typecheck`, `build`, dan seluruh *unit test* (55 test backend + 26 test frontend). Seluruh celah Patch 2B (`LevelMissionsCard` per `userId`, proteksi FAB mobile di `BudgetPage`, pencegahan reset draf saat *refetch*, penghapusan `useDashboard.ts`, serta `ErrorBanner`) juga sudah terimplementasi dengan bersih.

Sebelum aplikasi dipublikasikan ke internet (*production*), audit menyeluruh menemukan **6 celah teknis & kesiapan *deployment*** yang wajib dibereskan di Fase 4:

| No | Area | Temuan Audit Kode Fase 3 | Dampak Jika Dibiarkan |
| :--- | :--- | :--- | :--- |
| **1** | **Client Error Handling (`client/src/api/client.ts` & `useReports.ts`)** | Interceptor Axios di `client.ts` langsung mengubah semua `AxiosError` menjadi `ApiClientError`. Saat `/reports/monthly-pdf` gagal dengan `responseType: 'blob'`, `axios.isAxiosError(error)` di `useReports.ts` selalu bernilai `false`, sehingga pesan error Bahasa Indonesia di dalam `Blob` JSON tidak pernah terbaca. | Pengguna melihat pesan bahasa Inggris *"Request failed with status code 400/500"* saat unduh PDF gagal. |
| **2** | **Vercel SPA Routing (`client/vercel.json`)** | Folder `client/` belum memiliki file `vercel.json` dengan aturan *rewrite* ke `/index.html`. | Saat pengguna menekan `F5` di `/dashboard`, `/debts`, atau `/fire` setelah deploy ke Vercel, muncul error **`404 NOT_FOUND`**. |
| **3** | **Production DB Migration & Readiness (`server/`)** | `server/package.json` hanya memiliki `prisma:migrate` (`prisma migrate dev`), belum memiliki `prisma:migrate:deploy` dan endpoint cek kesiapan database (`/api/v1/health/ready`). | *Deploy pipeline* di Render/Railway bisa salah perintah migrasi dan tidak mendeteksi jika koneksi Neon/Supabase bermasalah. |
| **4** | **Proteksi CPU/RAM Endpoint Berat (`server/`)** | Rate limiter baru terpasang pada `/login` & `/register`. Endpoint pembuat PDF (`GET /reports/monthly-pdf`) dan simulator (`/debts/simulate`, `/analytics/fire/simulate`) belum memiliki *rate limiter* khusus. | Rentan penyalahgunaan (*spam* unduh PDF) yang menghabiskan memori server *free tier*. |
| **5** | **Bundle Size & Aksesibilitas SPA (`client/`)** | `App.tsx` mengimpor 11 halaman secara *eager* (termasuk 3 halaman berat ber-`Recharts`) dalam satu bundel besar (`chunkSizeWarningLimit: 1200`), `Modal.tsx` memakai `id="modal-title"` statis, serta `AccountsPage`/`TransactionsPage` belum menampilkan `ErrorBanner`. | Beban muat awal (*Initial Load / LCP*) di jaringan seluler menjadi lambat dan aksesibilitas dialog kurang optimal. |
| **6** | **Kejelasan Snapshot Periode Lampau (`NetWorthPage.tsx`)** | `POST /analytics/snapshot` selalu memakai saldo akun & utang *live* saat ini untuk `totalAssets`/`totalLiabilities`, sementara `savingRatePct` diambil dari bulan yang dipilih. | Pengguna bisa mengira tombol *"Simpan Snapshot"* pada bulan lalu menghitung ulang saldo historis bulan tersebut. |

## 2. Spesifikasi Teknis Perbaikan & Hardening (Fase 4)

### 2.1 Backend Hardening (`server/`)

1. **Tambahkan Rate Limiter API Umum & PDF (`server/src/middlewares/rateLimiter.ts`):**
   * Pertahankan `authRateLimiter` (10 req / 15 menit / IP) khusus untuk `POST /auth/login` dan `POST /auth/register`.
   * Tambahkan `apiRateLimiter`: 180 req / menit / IP dipasang di `/api/v1` (mengecualikan `/api/v1/health`).
   * Tambahkan `reportRateLimiter`: 15 req / 15 menit / IP dipasang khusus pada `GET /api/v1/reports/monthly-pdf`.
   * Seluruh respons `429` wajib memakai amplop JSON standar `{ success: false, message: "...Bahasa Indonesia...", data: null, meta: {} }`.

2. **Perkuat Endpoint Health & Readiness (`server/src/app.ts`):**
   * Pertahankan `GET /api/v1/health` (ringan, tanpa query DB — cocok untuk *liveness probe* Render/Railway).
   * Tambahkan `GET /api/v1/health/ready` yang menjalankan `await prisma.$queryRaw\`SELECT 1\``; kembalikan `200 OK` jika database terhubung, atau `503 Service Unavailable` dengan pesan Bahasa Indonesia jika gagal.

3. **Keamanan Cookie & Header Produksi (`server/src/config/env.ts`, `cors.ts`, `authCookie.ts`):**
   * Verifikasi `helmet()` aktif dan tidak mengganggu pengunduhan `application/pdf`.
   * Verifikasi `CORS` menolak origin asing dan hanya mengizinkan `env.CLIENT_URL` dengan `credentials: true`.
   * Tambahkan opsi env opsional `COOKIE_SAMESITE` (`lax` | `none`, default otomatis `none` saat `isProduction` dan `lax` saat lokal) agar fleksibel jika nanti memakai *custom domain* / Vercel proxy.
   * Perbarui `server/package.json`: tambahkan script:
     * `"prisma:migrate:deploy": "prisma migrate deploy"`
     * `"start:prod": "npx prisma migrate deploy && node dist/src/server.js"`
   * Perbarui `server/.env.example` dengan dokumentasi lengkap variabel *development* vs *production* (termasuk catatan `DATABASE_URL` Neon/Supabase).

4. **Test Keamanan & Integrasi Aplikasi (`server/src/__tests__/phase4.security.test.ts`):**
   Tambahkan suite pengujian Vitest terhadap `createApp()` (atau helper middleware) yang memverifikasi:
   * Header keamanan `x-powered-by` tidak terkirim dan header `helmet` terpasang.
   * Rute terproteksi (`/api/v1/accounts`, `/api/v1/transactions`, `/api/v1/debts`, `/api/v1/budgets/2026/11`, `/api/v1/analytics/dashboard`, `/api/v1/reports/monthly-pdf`) seluruhnya menolak akses tanpa cookie dengan `401 Unauthorized` dan amplop `{ success: false, ... }`.
   * Rute tidak dikenal mengembalikan `404 Not Found` berbahasa Indonesia.
   * Validasi *payload* JSON rusak mengembalikan `400 Bad Request` berbahasa Indonesia.
   * Seluruh `prisma.*` query pada modul `accounts`, `categories`, `transactions`, `budgets`, `debts`, `analytics`, dan `reports` terbukti terikat pada `userId` (audit IDOR).

### 2.2 Frontend Hardening & Optimasi Performa (`client/`)

1. **Perbaiki Parsing Error `Blob` untuk PDF (`client/src/api/client.ts` & `useReports.ts`):**
   * Ubah *error handler* di `apiClient.interceptors.response` menjadi `async (error: unknown)` agar jika `axiosErr.response?.data instanceof Blob`, interceptor membaca `await blob.text()`, mem-parse JSON `ApiErrorEnvelope` secara aman, lalu membentuk `ApiClientError(parsedMessage, status, issues)` dalam Bahasa Indonesia.
   * Sederhanakan `useReports.ts` karena `ApiClientError` kini sudah membawa pesan Bahasa Indonesia yang akurat.

2. **Code-Splitting (`React.lazy` + `Suspense`) & Optimasi Vite (`client/src/App.tsx` & `vite.config.ts`):**
   * Ubah import halaman berat berbasis grafik dan halaman sekunder menjadi `lazy(() => import(...))` (`DebtsPage`, `FirePage`, `NetWorthPage`, `BudgetPage`, `AccountsPage`, `SettingsPage`, `OnboardingPage`), dibungkus `<Suspense fallback={<PageSkeleton />}>` di dalam `App.tsx`.
   * Konfigurasikan `build.rollupOptions.output.manualChunks` di `client/vite.config.ts` untuk memisahkan `vendor-react` (`react`, `react-dom`, `react-router-dom`), `vendor-charts` (`recharts`), dan `vendor-data` (`@tanstack/react-query`, `axios`, `decimal.js`) agar *browser caching* optimal dan bundel awal ramping.

3. **Polesan Aksesibilitas & Konsistensi UX (*Eight Golden Rules* + `modern-web-guidance`):**
   * **`Modal.tsx`:** Ganti `id="modal-title"` statis dengan `const titleId = useId();` dari React agar selalu unik.
   * **`AccountsPage.tsx` & `TransactionsPage.tsx`:** Tambahkan `ErrorBanner` dengan tombol *"Coba Lagi"* jika query gagal, menyamakan kualitas *error recovery* dengan `DashboardPage`, `BudgetPage`, `DebtsPage`, `FirePage`, dan `NetWorthPage`.
   * **`NetWorthPage.tsx`:** Jika `snapshotPeriod` bukan bulan berjalan saat ini, tampilkan catatan informasi halus (*"Catatan: Total Aset & Liabilitas diambil dari saldo aktif saat ini, sedangkan Saving Rate dihitung dari arus kas periode terpilih."*) agar pengguna selalu transparan terhadap sumber data.
   * **`AppLayout.tsx`:** Pastikan laci mobile **"Lainnya"** otomatis menutup bila rute berubah (`location.pathname`).

4. **Tambahkan Konfigurasi Deployment SPA (`client/vercel.json`):**
   Buat file `client/vercel.json` dengan *rewrite* SPA + header keamanan dasar:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
         ]
       }
     ]
   }
   ```

5. **File Dokumentasi Deployment Root (`DEPLOYMENT.md` & `render.yaml`):**
   * Buat `render.yaml` di root repositori untuk memudahkan *one-click setup* layanan web `server/` di Render.
   * Buat `DEPLOYMENT.md` berbahasa Indonesia yang merinci langkah demi langkah setup **Neon/Supabase (PostgreSQL)**, **Render/Railway (Express API)**, dan **Vercel (React SPA)** beserta tabel variabel `.env` dan *troubleshooting* cookie lintas-domain (`SameSite=None; Secure` + opsi Vercel Rewrite Proxy jika pengguna memakai Safari dengan blokir *third-party cookie*).

## 3. Matriks Audit Final (Keamanan, Finansial & *Eight Golden Rules*)

| Domain Audit | Standar Wajib UPgrade | Status Verifikasi |
| :--- | :--- | :--- |
| **Presisi Moneter** | Nol operasi `number` JS pada uang; 100% `decimal.js` (`DECIMAL(15,2)`); `Number()` hanya di batas data `Recharts`. | Wajib lolos di seluruh file `server/` & `client/` |
| **Integritas ACID** | `INCOME`, `EXPENSE`, `TRANSFER`, `DEBT_PAYMENT`, `DELETE`, `RESTORE`, `ONBOARDING`, dan `PUT /budgets` berjalan atomik di `prisma.$transaction`. | Terverifikasi |
| **Proteksi IDOR** | Seluruh operasi baca/tulis memfilter `userId: requireUserId(req)`. | Diverifikasi ulang di `phase4.security.test.ts` |
| **Auth & Cookie** | Argon2 + timing-safe dummy hash; JWT hanya di `HttpOnly` cookie (nol token di `localStorage`); `trust proxy = 1` di *production*. | Terverifikasi |
| **Rate Limiting** | Strict pada `/login` & `/register` (10/15m), sedang pada `/reports/monthly-pdf` (15/15m), umum pada `/api/v1` (180/1m), bebas pada `/health`. | Diimplementasikan di Fase 4 |
| **Eight Golden Rules** | Warna semantik seragam, `Shift + N` & FAB, toast informatif + budget sisa, stepper onboarding closure, pencegahan error & *overdraft warning*, Undo 7 detik, kontrol asumsi SWR/Inflasi/Budget, saldo & budget tampil inline. | Lengkap di seluruh 8 halaman terproteksi |

## 4. Panduan Konfigurasi Environment Cloud (Ringkas)

### A. Database — Neon.tech / Supabase (PostgreSQL)
* Buat proyek PostgreSQL gratis dan salin *connection string* (`sslmode=require`).
* Jika memakai **Supabase**, gunakan *Session Pooler* / *Direct Connection* untuk `npx prisma migrate deploy`.

### B. Backend API — Render / Railway (`server/`)
* **Root Directory:** `server`
* **Build Command:** `npm ci && npx prisma generate && npm run build`
* **Start Command:** `npm run start:prod` *(otomatis menjalankan `prisma migrate deploy` lalu `node dist/src/server.js`)*
* **Health Check Path:** `/api/v1/health`
* **Environment Variables Wajib:**
  * `NODE_ENV=production`
  * `PORT=4000` *(Render akan menyuntikkan `PORT` otomatis)*
  * `DATABASE_URL=postgresql://...`
  * `CLIENT_URL=https://nama-app-anda.vercel.app` *(tanpa garis miring di akhir)*
  * `JWT_SECRET=<string acak minimal 64 karakter hex>`
  * `JWT_EXPIRES_IN_DAYS=7`

### C. Frontend SPA — Vercel (`client/`)
* **Root Directory:** `client`
* **Framework Preset:** Vite
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* **Environment Variables Wajib:**
  * `VITE_API_BASE_URL=https://nama-backend-anda.onrender.com/api/v1`

> **Tips Anti-Blokir Cookie di Safari / Brave (Cross-Domain):** Jika frontend (`*.vercel.app`) dan backend (`*.onrender.com`) berada pada *root domain* yang berbeda, browser ketat seperti Safari iOS dapat memblokir cookie pihak ketiga meskipun sudah `SameSite=None; Secure`. Solusi terbaik gratis di Vercel: tambahkan rewrite proxy di `client/vercel.json` (`{ "source": "/api/:path*", "destination": "https://BACKEND_ANDA.onrender.com/api/:path*" }`) dan set `VITE_API_BASE_URL=/api/v1` agar cookie berjalan *first-party* (`SameSite=Lax`) di semua browser.

## 5. Prompt Siap Salin untuk Agent Antigravity (Trigger 4 — Final)

Salin dan tempel prompt berikut ke panel Agent Antigravity setelah menyimpan `PHASE_4_ANTIGRAVITY.md` di root repositori:

```text
Execute **Phase 4 (Final QA, Security Hardening, Performance Optimization & Cloud Deployment Prep)** strictly according to @PHASE_4_ANTIGRAVITY.md and @.agent/rules/upgrade-rules.md.

Scope of work (both `server/` and `client/` — NO Prisma schema changes):
1. **Backend Hardening (`server/`):**
   - In `server/src/middlewares/rateLimiter.ts` & `server/src/app.ts`: add `apiRateLimiter` (180 req/min/IP on `/api/v1` excluding `/health*`) and `reportRateLimiter` (15 req/15min/IP on `GET /api/v1/reports/monthly-pdf`), keeping `authRateLimiter` strictly on `/auth/login` and `/auth/register`. All `429` responses must use the standard Indonesian JSON envelope.
   - In `server/src/app.ts`: add `GET /api/v1/health/ready` running `prisma.$queryRaw` (`SELECT 1`) returning `200` when healthy or `503` with an Indonesian message if unreachable. Keep `GET /api/v1/health` lightweight.
   - In `server/src/config/env.ts` & `authCookie.ts`: support optional `COOKIE_SAMESITE` (`lax` | `none`, defaulting to `none` in production and `lax` locally).
   - Update `server/package.json` with `"prisma:migrate:deploy": "prisma migrate deploy"` and `"start:prod": "npx prisma migrate deploy && node dist/src/server.js"`, and update `server/.env.example` with clear production notes.
   - Create `server/src/__tests__/phase4.security.test.ts` testing `createApp()` HTTP contracts (without needing live DB): `helmet` headers, `x-powered-by` disabled, `401` rejection on all protected module prefixes without cookie, `404` Indonesian envelope, malformed JSON `400` Indonesian envelope, and `GET /api/v1/health`.

2. **Frontend Hardening & Performance (`client/`):**
   - Fix Blob error parsing in `client/src/api/client.ts` (make error interceptor async so JSON error envelopes inside `Blob` responses are parsed into `ApiClientError` with their Bahasa Indonesia message) and simplify `client/src/api/hooks/useReports.ts` accordingly.
   - Implement route-level code splitting (`React.lazy` + `<Suspense>`) in `client/src/App.tsx` for `OnboardingPage`, `BudgetPage`, `DebtsPage`, `FirePage`, `NetWorthPage`, `AccountsPage`, and `SettingsPage`, plus `manualChunks` in `client/vite.config.ts` (`vendor-react`, `vendor-charts`, `vendor-data`).
   - Polish accessibility & consistency: use React `useId()` in `Modal.tsx`; add `ErrorBanner` with retry to `AccountsPage.tsx` and `TransactionsPage.tsx`; auto-close the mobile "Lainnya" drawer on route change in `AppLayout.tsx`; display a concise transparent helper note on `NetWorthPage.tsx` whenever the selected snapshot period is not the current month.
   - Create `client/vercel.json` with SPA fallback rewrite (`/(.*) -> /index.html`) and security headers.

3. **Deployment Artifacts (Root):**
   - Create `render.yaml` for Render backend deployment (`server/`).
   - Create `DEPLOYMENT.md` in clear Bahasa Indonesia covering Neon/Supabase, Render/Railway, Vercel, exact environment variable tables, and the optional Vercel `/api/*` first-party cookie proxy tip for Safari/iOS.

After all edits, run verification commands (PowerShell-safe):
- In `server/`: `npm run typecheck; npm run build; npm test`
- In `client/`: `npm run typecheck; npm run build; npm test`

Confirm zero compiler errors, all tests passing, and report the final `client/dist` chunk sizes to verify code-splitting worked.
```

## 6. Checklist Go-Live & Smoke Test Production (PowerShell & Browser)

Jalankan verifikasi akhir berikut setelah Agent selesai dan setelah aplikasi ter-deploy ke cloud:

### A. Verifikasi Lokal (PowerShell)
```powershell
# Di folder server/
npm run typecheck; npm run build; npm test

# Di folder client/
npm run typecheck; npm run build; npm test
```

### B. Smoke Test Production (Setelah Deploy ke Neon + Render + Vercel)
* [ ] Buka `https://<backend-anda>/api/v1/health` $\rightarrow$ respons `200 OK` (`status: "ok"`).
* [ ] Buka `https://<backend-anda>/api/v1/health/ready` $\rightarrow$ respons `200 OK` (koneksi PostgreSQL Neon/Supabase aktif).
* [ ] Buka `https://<frontend-anda>.vercel.app`, daftar akun baru, selesaikan 3 langkah Onboarding, lalu masuk `/dashboard`.
* [ ] Tekan **`F5` (Refresh)** langsung di `/debts`, `/fire`, dan `/net-worth` $\rightarrow$ halaman termuat normal (bukan `404` Vercel) dan sesi tetap login via `HttpOnly` cookie.
* [ ] Catat 1 transaksi `EXPENSE`, hapus, lalu klik **Urungkan (Undo)** dalam 7 detik $\rightarrow$ saldo dan KPI kembali akurat.
* [ ] Klik **Unduh PDF** di `/dashboard` $\rightarrow$ file `UPgrade-Laporan-YYYY-MM.pdf` terunduh dan terbuka rapi di browser.
* [ ] Cek repositori GitHub Anda: pastikan tidak ada file `.env` maupun `*-review*.md` yang ikut ter-commit.