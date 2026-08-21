# 🚀 Panduan Deployment: Sinergi Visual UGC Generator Prompt

Panduan lengkap untuk mempublikasikan (deploy) aplikasi **Sinergi Visual UGC Generator Prompt** ke layanan cloud modern:
- **Full-Stack (Frontend + Backend Serverless API):** [Vercel](https://vercel.com)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL) & [MongoDB Atlas](https://www.mongodb.com/atlas)
- **AI Provider:** [OpenAI Platform](https://platform.openai.com) (GPT-4o-mini Vision & Prompt Engine)
- **Payment Gateway:** [Midtrans](https://midtrans.com) / [Xendit](https://xendit.co)

---

## 1. 🌐 Deploy Full-Stack ke Vercel (Rekomendasi)

Proyek ini telah dikonfigurasi dengan arsitektur **Vercel Serverless Function** (`@vercel/python` untuk FastAPI) dan **React SPA Static Build** (`@vercel/static-build`) melalui [`vercel.json`](./vercel.json).

### Langkah-langkah:
1. Masuk ke [Vercel Dashboard](https://vercel.com) dan klik **Add New... > Project**.
2. Pilih repositori GitHub: `Web-UGC-Generator-Prompt-v1`.
3. Pada halaman konfigurasi project:
   - **Framework Preset:** `Other` (atau biarkan Vercel mendeteksi secara otomatis dari `vercel.json`).
   - **Root Directory:** `./` (Biarkan di root repository, **JANGAN** diubah ke folder `frontend`).
   - **Build & Output Settings:** Biarkan default (dikelola oleh `vercel.json`).
4. Masukkan **Environment Variables** berikut pada tab Environment Variables:

| Variable Name | Contoh Value | Kategori | Deskripsi |
| :--- | :--- | :--- | :--- |
| `OPENAI_API_KEY` | `sk-proj-xxxx...` | Server Secret | **Wajib**. Kunci OpenAI API untuk Vision & Prompt Engine. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Server Config | Model AI OpenAI (default: `gpt-4o-mini`). |
| `SUPABASE_URL` | `https://your-project.supabase.co` | Server Secret | URL Project Supabase untuk DB & Auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Server Secret | Service Role Key Supabase (Bypass RLS & Admin). |
| `REACT_APP_SUPABASE_URL` | `https://your-project.supabase.co` | Client Public | URL Project Supabase untuk browser. |
| `REACT_APP_SUPABASE_ANON_KEY` | `eyJhbGci...` | Client Public | Anon Public Key Supabase untuk browser. |
| `MONGO_URL` | `mongodb+srv://...` | Server Secret | Connection string MongoDB Atlas. |
| `DB_NAME` | `ugc_prompt_studio` | Server Secret | Nama database MongoDB. |
| `CORS_ORIGINS` | `*` | Server Secret | Izinkan CORS origins. |

5. Klik **Deploy**.
6. Setelah deployment selesai:
   - Akses URL aplikasi (contoh: `https://your-project.vercel.app/`).
   - Uji endpoint health check di: `https://your-project.vercel.app/api/health`.

---

## 2. 🔍 Pengujian Fitur di Production

1. **Health Check Endpoint:**
   Buka browser dan buka `https://your-project.vercel.app/api/health`.
   Response yang diharapkan:
   ```json
   {
     "status": "ok",
     "service": "sinergi-visual-ugc-generator",
     "openai_configured": true
   }
   ```
2. **Upload & Analisis Produk (`/create`):**
   - Buka halaman `/create`.
   - Upload foto produk (JPG, PNG, atau WEBP).
   - Backend Vercel akan menganalisis foto via OpenAI GPT-4o-mini Vision dan menampilkan **Detail Karakteristik Produk**.
3. **Generate UGC Video Prompt:**
   - Pilih Gaya Video & Creator.
   - Klik **Generate Prompt**.
   - Sistem akan menghasilkan Master Prompt & Scene Prompts lengkap.

---

## 3. 🗄️ Setup Database & Supabase Auth

1. Buka [Supabase Dashboard](https://supabase.com) dan buat project baru.
2. Buka menu **SQL Editor**, buka file [`supabase/schema.sql`](./supabase/schema.sql), salin kodenya dan klik **Run**.
3. Buka menu **Authentication > Providers**:
   - Aktifkan **Google Provider** jika ingin menggunakan 1-Klik Login Google OAuth.
   - Masukkan *Client ID* dan *Client Secret* dari Google Cloud Console.

---

## 4. 💳 Setup Webhook Midtrans (Opsional)

1. Buka [Midtrans Dashboard](https://dashboard.midtrans.com) (Sandbox / Production).
2. Masuk ke menu **Settings > Configuration**.
3. Pada kolom **Payment Notification URL**, masukkan:
   ```
   https://[DOMAIN-VERCEL-ANDA]/api/payments/webhook
   ```
4. Klik **Save**.
