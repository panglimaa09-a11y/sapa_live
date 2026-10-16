# Agen Keepalive Supabase SapaLive

**Tugas:** login → logout via Supabase Auth setiap 6 jam, supaya project
`sapa_live` tidak di-pause otomatis (free tier pause setelah 7 hari tanpa aktivitas).

## Status

- [x] Script: `keepalive.mjs` (Node, tanpa dependensi)
- [x] Jadwal: cron `sapalive-supabase-keepalive`, tiap 6 jam
- [ ] **BELUM AKTIF** — menunggu Tuan:
  1. Buat project Supabase `sapa_live`
  2. Buat user khusus keepalive (BUKAN admin), mis. `keepalive@sapalive.my.id`
  3. Beri ke Jarvis: URL project + anon key + email/password user itu
     (via kredensial aman — JANGAN ketik password di chat)

Setelah kredensial masuk, Jarvis menyimpan ke
`~/.config/sapalive/keepalive.env` (0600) dan mengaktifkan cron.

## Catatan

- User keepalive hanya butuh bisa login/logout — tanpa hak admin,
  tanpa akses data. Prinsip hak minimal.
- Interval 6 jam = 4x sehari, jauh di bawah batas inaktivitas 7 hari.
- Script keluar dengan kode 2 + pesan `NOT_CONFIGURED` bila kredensial
  belum ada (tidak dianggap gagal).
