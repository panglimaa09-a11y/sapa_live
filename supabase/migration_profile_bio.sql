-- Tambah kolom bio ke profiles (untuk bio di halaman Pengaturan).
-- Jalankan via Supabase SQL Editor (tidak bisa via REST).
alter table profiles add column if not exists bio text;
