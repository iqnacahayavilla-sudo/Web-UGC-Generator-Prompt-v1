# Panduan Skema Database Supabase & Sistem Token Sinergi Visual

Skema database PostgreSQL pada folder ini (`supabase/schema.sql`) dirancang untuk mengelola sistem **SaaS Monetisasi & Token Credit System** untuk **Sinergi Visual UGC Generator Prompt**.

---

## 📋 Struktur Tabel

1. **`users`**
   - Menyimpan data profil user dan tipe paket langganan (`free`, `pro`, `enterprise`).
2. **`user_credits`**
   - Menyimpan saldo kredit harian (`daily_credits_remaining`), bonus token (`bonus_credits`), kuota paket (`daily_quota`), dan tanggal reset terakhir (`last_reset_date`).
3. **`subscriptions`**
   - Mencatat histori transaksi paket langganan, status (`active`, `expired`, `cancelled`), dan referensi pembayaran.
4. **`prompt_logs`**
   - Mencatat histori penggunaan prompt, jumlah token yang terpakai (`tokens_used`), model AI yang digunakan, dan tanggal pembuatan.

---

## ⚡ Logika Bisnis & Stored Procedure

- **Reset Harian Otomatis (00:00 WIB / Asia/Jakarta GMT+7):**
  - Stored procedure `consume_user_credits()` secara otomatis mengecek apakah `last_reset_date < TODAY_WIB`.
  - Jika tanggal telah berganti ke hari baru, `daily_credits_remaining` akan di-reset otomatis sesuai kuota paket:
    - **Free:** 100 Token / hari
    - **Pro:** 1.000 Token / hari
    - **Enterprise:** 5.000 Token / hari
- **Hierarki Pemotongan Token:**
  - Token dipotong mendahulukan saldo harian `daily_credits_remaining`.
  - Jika `daily_credits_remaining` habis, pemotongan otomatis beralih ke `bonus_credits` (kredit top-up yang tidak hangus).
  - Jika total kredit adalah 0, fungsi mengembalikan status `KREDIT_HABIS` (HTTP 403) untuk memicu checkout/upgrade modal di frontend.

---

## 🚀 Cara Menjalankan di Supabase Dashboard

1. Buka [Supabase Dashboard](https://app.supabase.com).
2. Masuk ke proyek Anda dan pilih menu **SQL Editor**.
3. Salin seluruh isi file [`supabase/schema.sql`](./schema.sql) dan tempelkan ke SQL Editor.
4. Klik tombol **Run** untuk mengeksekusi skema dan stored procedure.
