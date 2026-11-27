# Panduan Deployment Produksi — UPgrade (7-Level Financial Freedom Roadmap)

Dokumen ini menjelaskan langkah-langkah publikasi (*deployment*) aplikasi monorepo **UPgrade** (`server/` + `client/`) ke layanan cloud modern tanpa XAMPP:

* **Database (PostgreSQL 16):** [Neon.tech](https://neon.tech) atau [Supabase](https://supabase.com)
* **Backend REST API (Express 5 + Prisma + PDFKit):** [Render](https://render.com) atau [Railway](https://railway.app)
* **Frontend SPA (React + Vite + Tailwind CSS v4):** [Vercel](https://vercel.com)

---

## 1. Persiapan Database PostgreSQL (Neon / Supabase)

1. Buat proyek baru di **Neon.tech** (atau **Supabase**) dengan versi PostgreSQL 16.
2. Salin **Connection String** (`DATABASE_URL`) dengan parameter `?sslmode=require`, contoh:
   ```text
   postgresql://neondb_owner:PASSWORD_ANDA@ep-cool-forest-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   > **Catatan Pengguna Supabase:** Jika menggunakan Supabase, gunakan URI **Session Pooler (Port 5432)** atau **Direct Connection** agar perintah migrasi `npx prisma migrate deploy` berjalan lancar.
3. **(Opsional — Inisialisasi Migrasi Pertama dari Lokal):**
   Jika folder `server/prisma/migrations` belum di-generate ke Git, tempel `DATABASE_URL` Neon/Supabase Anda ke `server/.env` lokal lalu jalankan sekali:
   ```powershell
   cd server
   npx prisma migrate dev --name init
   ```
   Setelah folder `server/prisma/migrations` terbentuk, *commit* folder `migrations` tersebut ke GitHub (jangan pernah meng-commit file `.env`).

---

## 2. Deployment Backend API (`server/`) ke Render atau Railway

### Opsi A — Menggunakan Blueprint `render.yaml` (Otomatis di Render)
Repositori ini sudah dilengkapi file [`render.yaml`](./render.yaml) di root proyek:
1. Masuk ke Dashboard **Render** $\rightarrow$ **New** $\rightarrow$ **Blueprint**.
2. Hubungkan repositori GitHub **UPgrade** Anda.
3. Isi dua variabel yang diminta saat pembuatan:
   * `DATABASE_URL`: connection string PostgreSQL dari Neon/Supabase.
   * `CLIENT_URL`: URL aplikasi Vercel Anda tanpa garis miring di akhir (contoh: `https://upgrade-finance.vercel.app`).

### Opsi B — Konfigurasi Manual Web Service (Render / Railway)
* **Root Directory:** `server`
* **Build Command:**
  ```bash
  npm ci && npx prisma generate && npm run build
  ```
* **Start Command:**
  ```bash
  npm run start:prod
  ```
  *(Otomatis menjalankan `npx prisma migrate deploy && node dist/src/server.js`)*.
* **Health Check Path (Liveness):** `/api/v1/health`
* **Readiness Check Path (Database):** `/api/v1/health/ready`

### Tabel Environment Variables Backend (`server/`)

| Variabel | Contoh Nilai Produksi | Keterangan |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Wajib `production` agar `trust proxy = 1` dan cookie `Secure` aktif. |
| `PORT` | `4000` | Render/Railway akan menyuntikkan port secara otomatis. |
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Connection string PostgreSQL 16 dari Neon atau Supabase. |
| `CLIENT_URL` | `https://upgrade-app.vercel.app` | Origin frontend untuk CORS (`credentials: true`). Tanpa `/` di akhir. |
| `JWT_SECRET` | `8f9d2a...` (minimal 32–64 karakter acak) | Buat dengan `openssl rand -hex 32`. |
| `JWT_EXPIRES_IN_DAYS` | `7` | Masa berlaku sesi login cookie `HttpOnly` dalam hari. |
| `COOKIE_SAMESITE` | *(Opsional)* `none` atau `lax` | Default otomatis `none` di `production`. Set ke `lax` jika memakai Vercel Rewrite Proxy. |

---

## 3. Deployment Frontend SPA (`client/`) ke Vercel

1. Masuk ke Dashboard **Vercel** $\rightarrow$ **Add New Project** $\rightarrow$ pilih repositori GitHub **UPgrade**.
2. Pada bagian **Root Directory**, klik **Edit** dan pilih folder **`client`**.
3. Pastikan konfigurasi build terdeteksi sebagai berikut:
   * **Framework Preset:** `Vite`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Tambahkan **Environment Variable** di Vercel:

| Variabel | Contoh Nilai Produksi | Keterangan |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://upgrade-api.onrender.com/api/v1` | URL penuh ke `/api/v1` backend Anda di Render/Railway. |

5. Klik **Deploy**. File [`client/vercel.json`](./client/vercel.json) sudah mengatur *SPA fallback rewrite* (`/(.*) -> /index.html`) sehingga *refresh* halaman (`F5`) di `/dashboard`, `/budgets`, `/debts`, `/fire`, atau `/net-worth` tidak akan pernah menghasilkan `404 NOT_FOUND`.

---

## 4. Tips First-Party Cookie Proxy untuk Safari / iOS & Brave

Secara default, ketika frontend (`*.vercel.app`) dan backend (`*.onrender.com`) berada pada *root domain* yang berbeda, backend mengirim cookie `HttpOnly` dengan atribut `SameSite=None; Secure`.

Namun, peramban dengan proteksi *Intelligent Tracking Prevention (ITP)* ketat seperti **Safari di iOS/macOS** dan **Brave** sering memblokir cookie lintas-domain (*third-party cookies*). Agar sesi login berjalan **100% First-Party Cookie** di seluruh perangkat tanpa membeli custom domain:

1. Ubah `client/vercel.json` menjadi seperti berikut (ganti `https://upgrade-api.onrender.com` dengan URL backend Render/Railway Anda):
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://upgrade-api.onrender.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
2. Di Dashboard **Vercel** (Environment Variables `client/`), ubah:
   ```text
   VITE_API_BASE_URL=/api/v1
   ```
3. Di Dashboard **Render / Railway** (Environment Variables `server/`), tambahkan:
   ```text
   COOKIE_SAMESITE=lax
   ```
Dengan konfigurasi di atas, seluruh permintaan API diteruskan melalui domain Vercel yang sama sehingga cookie `upgrade_token` diperlakukan sebagai *first-party cookie* (`SameSite=Lax; Secure`) yang aman di Safari iOS, Chrome, Firefox, dan Brave.

---

## 5. Checklist Verifikasi Pasca-Deploy (Smoke Test)

* [ ] `GET https://<backend-anda>/api/v1/health` mengembalikan `200 OK` (`"UPgrade API berjalan dengan baik."`).
* [ ] `GET https://<backend-anda>/api/v1/health/ready` mengembalikan `200 OK` (`"Database UPgrade terhubung dan siap melayani permintaan."`).
* [ ] Daftar akun baru di `https://<frontend-anda>.vercel.app/register` $\rightarrow$ otomatis mendapatkan 18 kategori bawaan Bahasa Indonesia dan diarahkan ke `/onboarding`.
* [ ] Selesaikan 3 langkah Onboarding $\rightarrow$ Layar Penutupan Level awal tampil dan mengarahkan ke `/dashboard`.
* [ ] Tekan `Shift + N` (atau tombol `+` di mobile) $\rightarrow$ catat transaksi `INCOME`, `EXPENSE`, `TRANSFER`, dan `DEBT_PAYMENT` $\rightarrow$ uji hapus transaksi dan klik **Urungkan** pada *UndoToast* 7 detik.
* [ ] Klik **Unduh PDF** di `/dashboard` atau `/net-worth` $\rightarrow$ laporan keuangan PDF A4 terunduh rapi.
