# 🚀 Panduan Deployment: Sinergi Visual UGC Generator Prompt

Panduan lengkap untuk mempublikasikan (deploy) aplikasi **Sinergi Visual UGC Generator Prompt** ke layanan cloud modern:
- **Frontend:** [Vercel](https://vercel.com)
- **Backend:** [Render](https://render.com) atau [Railway](https://railway.app)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL) & [MongoDB Atlas](https://www.mongodb.com/atlas)
- **Payment Gateway:** [Midtrans](https://midtrans.com) / [Xendit](https://xendit.co)

---

## 1. 🌐 Deploy Frontend ke Vercel

### Langkah-langkah:
1. Masuk ke [Vercel Dashboard](https://vercel.com) dan klik **Add New... > Project**.
2. Pilih repositori GitHub proyek ini.
3. Pada halaman konfigurasi project:
   - **Framework Preset:** `Create React App`
   - **Root Directory:** Klik `Edit` dan pilih folder `frontend`.
   - **Build Command:** `npm run build` (atau biarkan default)
   - **Output Directory:** `build`
4. Tambahkan **Environment Variables** berikut:
   | Key | Value Contoh | Deskripsi |
   | :--- | :--- | :--- |
   | `REACT_APP_BACKEND_URL` | `https://sinergi-backend.onrender.com` | URL API Backend yang telah di-deploy |
   | `REACT_APP_SUPABASE_URL` | `https://your-project.supabase.co` | URL Project Supabase Anda |
   | `REACT_APP_SUPABASE_ANON_KEY` | `eyJhbGci...` | Anon/Public API Key Supabase |
5. Klik **Deploy**. Vercel akan membaca file [`frontend/vercel.json`](./frontend/vercel.json) untuk mengaktifkan SPA routing otomatis.

---

## 2. ⚡ Deploy Backend ke Render (Rekomendasi Gratis / Tercepat)

### Langkah-langkah:
1. Masuk ke [Render Dashboard](https://render.com) dan pilih **New + > Web Service**.
2. Hubungkan repositori GitHub Anda.
3. Konfigurasi Web Service:
   - **Name:** `sinergi-visual-backend`
   - **Runtime:** `Python 3`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Tambahkan **Environment Variables**:
   | Key | Value Contoh |
   | :--- | :--- |
   | `GEMINI_API_KEY` | `AQ.Ab8RN6...` (Google AI Studio Key) |
   | `GEMINI_MODEL` | `gemini-1.5-flash` |
   | `MONGO_URL` | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` |
   | `DB_NAME` | `ugc_prompt_studio` |
   | `CORS_ORIGINS` | `*` (atau URL Vercel frontend Anda) |
   | `MIDTRANS_SERVER_KEY` | `SB-Mid-server-xxxx` (Kunci Midtrans) |
   | `MIDTRANS_CLIENT_KEY` | `SB-Mid-client-xxxx` |
   | `MIDTRANS_IS_PRODUCTION` | `false` (Gunakan `true` jika live) |
5. Klik **Create Web Service**.

> **Tips MongoDB Atlas:** Jika belum memiliki MongoDB online gratis, buat cluster gratis M0 di [mongodb.com/atlas](https://www.mongodb.com/atlas) dan salin *Connection String* ke `MONGO_URL`.

---

## 3. 🚆 Deploy Backend ke Railway (Alternatif)

1. Buka [Railway.app](https://railway.app) dan pilih **New Project > Deploy from GitHub repo**.
2. File [`railway.json`](./railway.json) dan [`backend/Procfile`](./backend/Procfile) akan otomatis terdeteksi.
3. Masuk ke tab **Variables** pada service backend dan masukkan variabel environment yang sama seperti di atas.
4. Di tab **Settings > Networking**, klik **Generate Domain** untuk mendapatkan URL publik backend.

---

## 4. 🗄️ Setup Database & Supabase Auth

1. Buka [Supabase Dashboard](https://supabase.com) dan buat project baru.
2. Buka menu **SQL Editor**, buka file [`supabase/schema.sql`](./supabase/schema.sql), salin kodenya dan klik **Run**.
3. Buka menu **Authentication > Providers**:
   - Aktifkan **Google Provider** jika ingin menggunakan 1-Klik Login Google OAuth.
   - Masukkan *Client ID* dan *Client Secret* dari Google Cloud Console.

---

## 5. 💳 Setup Webhook Midtrans (Opsional untuk Pembayaran Otomatis)

1. Buka [Midtrans Dashboard](https://dashboard.midtrans.com) (Sandbox / Production).
2. Masuk ke menu **Settings > Configuration**.
3. Pada kolom **Payment Notification URL**, masukkan:
   ```
   https://[URL-BACKEND-ANDA]/api/payments/webhook
   ```
4. Klik **Save**. Sekarang, setiap pembayaran QRIS/VA yang berhasil akan langsung mengaktifkan saldo kredit atau paket user secara otomatis!
