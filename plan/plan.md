# FASHION_MART — Persiapan Pindah ke GitHub & Hosting Mandiri

FASHION_MART dikemas menjadi satu container Docker yang bisa dijalankan di Railway, Render, Fly.io, atau VPS, tanpa bergantung pada Emergent.
Semua fitur yang sudah ada tetap sama. AI pindah ke Gemini API Key milik pemilik, dan Midtrans siap untuk mode Production (sukses hanya saat status settlement).

## Untuk siapa
- **Pemilik / developer**: memindahkan kode ke GitHub, lalu men-deploy sendiri di hosting pilihan.
- **Pengguna akhir** (pembeli, seller/admin, kreator, pendukung): tidak ada perubahan pengalaman.

## Fitur inti dan pengalaman (yang disiapkan)
1. **Source code lengkap siap GitHub**
   - Seluruh kode backend dan frontend yang ada, tanpa redesign.
   - File rahasia (`.env`) tidak ikut ter-commit.
   - Disertakan contoh konfigurasi (`.env.example`) berisi nama variabel saja, tanpa nilai rahasia.
2. **Satu layanan, satu domain**
   - Container yang sama menyajikan frontend (hasil build) dan API `/api/...`.
   - Tidak perlu reverse proxy terpisah, tidak ada masalah CORS, dan cookie login bekerja di domain yang sama.
3. **Lepas dari Emergent**
   - AI Stylist (chat streaming) dan AI Listing (JSON 4 marketplace) memakai Gemini API Key sendiri dari Google AI Studio.
   - Model utama `gemini-3-flash-preview`; jika sedang penuh atau terkena batas kuota, otomatis memakai `gemini-2.5-flash`.
   - Library `emergentintegrations`, Emergent LLM Key, dan plugin overlay khusus pratinjau Emergent dihapus dari proses build dan runtime.
4. **Database**
   - MongoDB Atlas dimulai dalam keadaan kosong.
   - Saat aplikasi pertama kali jalan, index dibuat otomatis dan seed mengisi: 10 produk, akun admin, serta voucher FASHION10, HEMAT50K, dan GRATISONGKIR. Seed aman dijalankan berulang dan tidak menggandakan data.
   - Tidak ada migrasi data lama dan tidak ada data uji Sandbox yang dibawa.
5. **Midtrans Production via environment variable**
   - Mode dan kunci dibaca dari environment variable; tidak ada kunci di kode.
   - Pesanan toko dan dukungan Saweria dianggap lunas hanya saat status `settlement`. Kartu kredit yang masih `capture` tetap menunggu.
   - Catatan "kartu uji Sandbox" disembunyikan saat mode Production.
   - Webhook memakai endpoint yang sudah ada: `https://<domain-anda>/api/webhooks/midtrans`.
6. **Panduan deploy singkat (README)**
   - Daftar environment variable.
   - Perintah build dan start lokal dengan Docker.
   - Langkah di Railway/Render/Fly.io/VPS.
   - Pengaturan webhook di dashboard Midtrans.

## Alur pemilik
1. Push project ke GitHub lewat tombol "Save to GitHub" di Emergent.
2. Buat cluster MongoDB Atlas (gratis cukup) dan salin connection string-nya.
3. Buat Gemini API Key di aistudio.google.com/apikey.
4. Ambil Server Key dan Client Key Production di dashboard Midtrans → Settings → Access Keys.
5. Di hosting pilihan, buat layanan baru dari repo GitHub. Hosting mendeteksi Dockerfile secara otomatis.
6. Isi environment variable (daftar di bawah), lalu deploy.
7. Di dashboard Midtrans Production → Settings → Payment Settings:
   - Payment Notification URL: `https://<domain-anda>/api/webhooks/midtrans`
   - Finish / Unfinish / Error Redirect URL: `https://<domain-anda>/orders`
   - Tekan "Test notification URL" dan pastikan hasilnya HTTP 200.
8. Login sebagai admin dengan email dan password dari environment variable, lalu lakukan satu transaksi nyata Rp10.000 dan refund untuk memastikan pembayaran berjalan.

## Environment variable yang diisi pemilik
| Variabel | Isi |
|---|---|
| `MONGO_URL` | Connection string MongoDB Atlas |
| `DB_NAME` | Nama database, misalnya `fashionmart` |
| `JWT_SECRET` | Teks acak panjang (minimal 32 karakter) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Akun admin seller pertama (ganti dari nilai demo) |
| `GEMINI_API_KEY` | Dari Google AI Studio |
| `MIDTRANS_IS_PRODUCTION` | `true` |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | Kunci Production dari dashboard Midtrans |
| `CORS_ORIGINS` | `https://<domain-anda>` |
| `PORT` | Biasanya diisi otomatis oleh hosting |

## Nuansa UI/UX
- Tampilan, bahasa ID/EN, dan alur tidak berubah.
- Satu-satunya perbedaan yang terlihat: catatan kartu uji Sandbox tidak muncul di mode Production.

## Tahapan implementasi
- **Tahap 1 (dikerjakan sekarang)**:
  - Dockerfile satu container (build frontend + jalankan backend yang juga menyajikan frontend);
  - daftar dependency tanpa paket Emergent;
  - AI pindah ke Gemini API Key sendiri;
  - Midtrans Production via environment variable dengan aturan settlement-only;
  - catatan Sandbox disembunyikan di mode Production;
  - `.env.example`, `.gitignore` untuk file rahasia, dan README deploy;
  - pemeriksaan bahwa image ter-build dan aplikasi berjalan tanpa layanan Emergent.
- **Tahap 2 (oleh pemilik)**: push ke GitHub, membuat Atlas/Gemini/Midtrans, deploy, mengatur webhook, dan transaksi nyata Rp10.000.
- **Tahap 3 (opsional, nanti)**: domain kustom dan pemantauan atau backup database.

## Asumsi
- Push ke GitHub dilakukan pemilik lewat fitur "Save to GitHub" Emergent; rencana ini hanya menyiapkan isi repo.
- Hosting yang dipakai menyediakan HTTPS, karena cookie login hanya dikirim lewat HTTPS. Railway, Render, dan Fly.io menyediakannya otomatis; VPS perlu sertifikat sendiri.
- Kunci Midtrans Sandbox, Emergent LLM Key, dan `JWT_SECRET` yang dipakai di Emergent tidak dibawa ke repo. Kunci Sandbox Midtrans yang pernah dikirim lewat chat sebaiknya dianggap terekspos dan diganti (rotate) di dashboard Midtrans.
- Riwayat chat AI Stylist, pesanan, akun pelanggan, dan profil kreator di Emergent tidak dipindahkan; database baru dimulai bersih.
- Dukungan Saweria tetap bisa dilakukan tanpa login, sama seperti sekarang.
- Mode Sandbox tetap bisa dipakai di hosting baru hanya dengan `MIDTRANS_IS_PRODUCTION=false` plus kunci Sandbox; tidak ada mock atau mode uji lain.
- Kuota Gemini mengikuti tier akun Google pemilik. Jika batas tercapai, pengguna melihat pesan "coba lagi" seperti saat ini.
- Tidak ada fitur, desain, atau integrasi baru di luar daftar di atas.
