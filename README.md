# SapaLive

Platform sosial real-time: pencocokan acak, video chat 1v1 (WebRTC), dan pesan teks.
Khusus 18+. Brand orisinal — bukan tiruan Ayar.chat.

- **Produk:** SapaLive — "Temukan Teman Baru, Mulai Percakapan."
- **Domain produksi:** https://sapalive.my.id (dibeli terpisah — status: menunggu pembelian)
- **Repo:** `sapa-live` · **Package:** `sapa-live` · **DB produksi:** `sapa_live`
- **Stack:** Next.js 16 + Tailwind v4 + Supabase (Postgres/Auth/Realtime) + WebRTC
- **Bahasa:** Indonesia & Inggris (toggle di Pengaturan)

## Rute

| Rute | Fungsi |
|---|---|
| `/` | Landing page |
| `/register`, `/login`, `/welcome` | Auth + verifikasi 18+ (DOB + checkbox) |
| `/dashboard` | Statistik & koneksi terakhir |
| `/explore` | Jumlah antrean live (presence realtime) |
| `/match` | Lobby pencocokan acak |
| `/call/[sessionId]` | Video call 1v1 |
| `/connections` | Riwayat lawan bicara |
| `/messages` | Pesan teks realtime |
| `/notifications` | Notifikasi |
| `/settings` | Profil, bahasa, privasi, hapus akun |
| `/safety`, `/privacy`, `/terms` | Pusat keamanan & legal |
| `/admin` | Moderasi laporan + ban (khusus `is_admin`) |
| `/token` | Dompet token |

## Development

```bash
cp .env.example .env.local   # isi kredensial Supabase
npm install
npm run dev                  # http://localhost:3000
```

Tanpa Supabase, aplikasi jalan dalam **mode demo** (matchmaking antar-tab via
BroadcastChannel, jelas berlabel demo).

## Database

```bash
# Supabase Dashboard → SQL Editor → jalankan:
supabase/schema.sql
```

Tabel: `profiles`, `wallets`, `token_transactions`, `matches`, `messages`,
`notifications`, `blocks`, `reports`. RLS aktif. **Tidak ada seed dummy** —
semua data berasal dari aktivitas pengguna nyata.

Jadikan user sebagai admin: di SQL Editor,
`update profiles set is_admin = true where id = '<uuid>';`

## Arsitektur penting

- **Matchmaking** (`lib/matchmaking.ts`): antrean lobby via Supabase Realtime
  presence + broadcast. Protokol klaim deterministik (peerId terkecil menang),
  tanpa server pusat. Teruji: 2/4/6 peer selalu jadi pasangan 1v1 utuh.
- **Signaling WebRTC** (`lib/signaling.ts`): broadcast per-room; STUN publik
  gratis. Untuk produksi di balik NAT simetris, tambah TURN di `lib/webrtc.ts`.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` + `/offline`.

## Deploy

```bash
docker compose up --build        # sapa-live-web :3000 (+ redis, postgres)
```

Atau deploy folder ini ke Vercel (hubungkan repo GitHub → import → isi env).

## Keamanan pra-rilis (wajib per PRD)

- [ ] Beli & verifikasi domain `sapalive.my.id`, DNS, HTTPS
- [ ] Project Supabase `sapa_live` + schema.sql + Google OAuth client
- [ ] Audit keamanan (RLS, rate limit, abuse)
- [ ] Uji seluruh alur utama end-to-end

## Addendum v1.1.0 — Token Economy & Paid Creator Calls

Migrasi: `supabase/migration_addendum.sql` (aditif, idempoten — jalankan
setelah `schema.sql`). Tanpa data dummy: discovery menampilkan empty state
jujur bila belum ada kreator eligible.

### API backend (semua validasi di server, envelope `{ok}` / `{ok:false,error}`)

| Method & Path | Fungsi |
|---|---|
| `GET /api/topup/packages` | Daftar paket token (harga contoh) |
| `POST /api/topup/create` | Buat order + invoice Pakasir → `payment_link` |
| `GET /api/topup/status?order_id=` | Cek Pakasir; bila lunas → kredit atomik sekali saja |
| `GET /api/discover` | Kreator FEMALE, 18+, VERIFIED, ACTIVE (tanpa yang diblokir) |
| `POST /api/calls/request` | Minta panggilan: cek kelayakan, blokir, saldo ≥ tarif |
| `GET /api/calls/[id]` | Detail panggilan (peserta/admin) |
| `POST /api/calls/[id]/accept` | Kreator terima |
| `POST /api/calls/[id]/decline` | Kreator tolak |
| `POST /api/calls/[id]/connected` | Tandai WebRTC tersambung (syarat penagihan) |
| `POST /api/calls/[id]/end` | Akhiri → `settle_call()` atomik & idempoten |
| `POST /api/creator/apply` | Daftar kreator (FEMALE, 18+) → PENDING_REVIEW |
| `POST /api/creator/availability` | Toggle tersedia (tidak mengubah status aktivasi) |
| `POST /api/withdrawals/request` | Tarik penghasilan AVAILABLE |
| `POST /api/admin/creator/[id]` | approve/reject/suspend/activate kreator |
| `POST /api/admin/withdrawals/[id]` | approve/reject/mark_paid penarikan |
| `POST /api/admin/earnings/release` | PENDING → AVAILABLE |

Penagihan: fungsi SQL `settle_call()` — floor ke interval 30 detik penuh,
3 token/interval (dari `billing_config`), debit dibatasi saldo, ledger
append-only dengan idempotency key, anti double-charge via
`unique(call_id, interval_number)` dan `unique(idempotency_key)`.

### Konfigurasi yang BELUM ditentukan Tuan (jangan produksi sebelum diisi)

- Komisi platform (`billing_config.platform_fee_pct`, sekarang 0)
- Harga paket token (`lib/billing.ts` TOPUP_PACKAGES — harga contoh)
- Batas minimal penarikan & metode pembayaran kreator
- Penyedia verifikasi wajah (saat ini alur `MANUAL_REVIEW` oleh admin)

### Env baru (server only)

`SUPABASE_SERVICE_ROLE_KEY`, `PAKASIR_PROJECT_SLUG`, `PAKASIR_API_KEY`
(lihat `.env.example`).
