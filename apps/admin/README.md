# SapaLive Admin Control Center

Panel administrasi SapaLive — **aplikasi Next.js 16 terpisah** dari aplikasi
web utama. Tidak ada registrasi publik, tidak ada data dummy: setiap angka di
dashboard berasal dari query nyata ke Supabase; tabel kosong ditampilkan sebagai
empty state yang jujur.

## Domain (keputusan jujur)

- `sapa.live` **sudah dimiliki orang lain** — tidak dipakai.
- Target nyata: web utama `sapalive.my.id`, admin **`admin.sapalive.my.id`**.
- `api.sapa.live` **sengaja tidak dibangun**: addendum menyebutnya opsional.
  Arsitektur: panel admin mengakses Supabase **server-side langsung** dengan
  `service_role` — tidak ada CORS lintas domain, tidak ada API gateway terpisah.

## Arsitektur

```
apps/admin/                    ← root deploy aplikasi ini
├── proxy.ts                   ← gate 3 lapis (bukan middleware.ts:
│                                Next 16 mendepresiasi middleware)
├── lib/
│   ├── supabase.ts            ← session client (user) + service client (admin)
│   ├── crypto.ts              ← AES-256-GCM (secret MFA), HMAC (cookie admfa)
│   ├── permissions.ts         ← matriks RBAC 5 role
│   ├── audit.ts               ← logAudit() — dipanggil di SETIAP mutasi
│   ├── rate-limit.ts          ← login 5x/menit/IP (in-memory)
│   ├── auth.ts                ← helper sesi (getStaffSession, requireStaff…)
│   ├── actions.ts             ← semua server actions (login/MFA/mutasi)
│   └── ui.tsx                 ← komponen UI bersama (dark theme)
├── app/
│   ├── login/ → /mfa/ → /mfa-setup/    ← alur auth (publik)
│   └── (protected)/                    ← semua halaman butuh sesi+role+MFA
│       dashboard · users · creators · verifications · calls · transactions
│       earnings · withdrawals · reports · moderation · system-health
│       audit-logs · settings · access-control
└── .env.example
```

**Gate 3 lapis di `proxy.ts`** (setiap request ke route terproteksi):

1. Sesi Supabase **divalidasi ke Supabase Auth** (`/auth/v1/user`) — bukan
   sekadar “cookie ada”.
2. Baris `admin_roles` **wajib ada** untuk user tersebut.
3. MFA: jika sudah enroll → cookie `admfa` (HMAC-SHA256 `userId.exp.sig`,
   httpOnly, 12 jam, **tanpa atribut Domain**) harus valid; jika belum enroll
   → paksa ke `/mfa-setup` (enroll wajib saat login pertama).

Defense in depth: setiap server component memanggil `requireStaff()` /
`requirePermission()` lagi sebelum membaca data.

**MFA TOTP wajib.** Secret dienkripsi AES-256-GCM dengan
`ADMIN_MFA_ENCRYPTION_KEY` sebelum disimpan di `admin_mfa`. QR dibuat dengan
`qrcode`, verifikasi dengan `otplib`.

**Rate limit login:** 5 percobaan/menit/IP, in-memory `Map`. Keterbatasan yang
diketahui: tidak berlaku lintas instance — untuk multi-instance pakai Redis/
Upstash. Belum dipasang.

## Database

Jalankan `supabase/migration_admin.sql` di SQL Editor (setelah migrasi utama
dan `migration_addendum.sql`). Isi:

- `admin_roles(user_id, role, created_at, created_by)` — role staf
- `admin_mfa(user_id, secret_encrypted, enabled, created_at)`
- `admin_audit_logs(id, actor_id, action, resource_type, resource_id, meta, created_at)` — append-only
- Fungsi `is_staff()` / `staff_role()` (security definer) untuk RLS
- RLS: **select hanya untuk staf**; **tanpa client write sama sekali**
  (semua tulis via service_role)
- `admin_adjust_tokens(user_id, amount, reason)` — koreksi saldo **hanya via
  kompensasi** (baris `ADMIN_ADJUST` baru di `token_ledger`), tidak pernah
  mengedit ledger yang sudah ada.

### Provisioning admin pertama (via SQL manual)

```sql
-- Ganti <user-id> dengan UUID user dari Supabase Dashboard → Authentication → Users
-- (buat dulu akunnya via "Add user" di dashboard bila belum ada).
INSERT INTO public.admin_roles (user_id, role, created_by)
VALUES ('<user-id>', 'SUPER_ADMIN', '<user-id>')
ON CONFLICT (user_id) DO UPDATE SET role = 'SUPER_ADMIN';
```

## Environment

| Variabel | Keterangan |
|---|---|
| `SUPABASE_URL` | URL project Supabase (sama dengan app utama) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server-side saja**, jangan `NEXT_PUBLIC_` |
| `ADMIN_MFA_ENCRYPTION_KEY` | 32 byte → 64 hex. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

## Deploy Vercel

1. New Project → import repo → **Root Directory: `apps/admin`**.
2. Framework preset: Next.js. Build command & output: default.
3. Isi 3 environment variable di atas (Production).
4. Domain: tambahkan `admin.sapalive.my.id` di Project → Domains
   (domain perlu dibeli & diarahkan dulu — lihat “Belum bisa”).

## Matriks RBAC

| Kemampuan | SUPER_ADMIN | ADMIN | MODERATOR | FINANCE | SUPPORT |
|---|---|---|---|---|---|
| Dashboard & analitik | ✓ | ✓ | — | ✓* | — |
| Users (baca/cari) | ✓ | ✓ | — | — | ✓ (read) |
| Suspend/unsuspend user | ✓ | ✓ | ✓** | — | — |
| Kreator & verifikasi | ✓ | ✓ | baca | — | — |
| Panggilan (metadata) | ✓ | ✓ | — | — | — |
| Transaksi/ledger + koreksi | ✓ | baca | — | ✓ | — |
| Earnings release | ✓ | — | — | ✓ | — |
| Withdrawals | ✓ | ✓ | — | ✓ | — |
| Laporan & moderasi | ✓ | ✓ | ✓ | — | baca |
| System health | ✓ | ✓ | — | — | — |
| Audit log | ✓ | ✓ | — | ✓ | — |
| Settings (billing_config) | tulis | baca | — | — | — |
| Access control (admin_roles) | ✓ | — | — | — | — |
| Email user | penuh | disamarkan | — | disamarkan | disamarkan |

\* FINANCE melihat KPI token/penarikan di dashboard, bukan analitik pengguna.
\** MODERATOR boleh suspend bila diberi izin via `reports:write` +
`users:suspend` (lihat `lib/permissions.ts`).

Aturan tambahan:

- Setiap mutasi admin **wajib** `logAudit()` — termasuk perubahan settings,
  role, koreksi saldo, approve/reject verifikasi & withdrawal.
- Penangguhan butuh **alasan tertulis**; koreksi saldo butuh **alasan wajib**
  dan tercatat sebagai transaksi kompensasi (`ADMIN_ADJUST`), bukan edit.
- Email pengguna **disamarkan** untuk non-super-admin.

## Yang BELUM BISA / belum terverifikasi (jujur)

- **DNS & domain**: `admin.sapalive.my.id` belum dibeli/diarahkan — butuh Tuan.
- **Email provider**: belum ada (belum dibutuhkan panel ini).
- **Pen-test keamanan**: belum dilakukan. Jangan klaim siap produksi.
- **SSO**: belum ada (sengaja — mengurangi permukaan serangan).
- **Rate limit multi-instance**: in-memory saja; butuh Redis bila >1 instance.
- **Verifikasi end-to-end** (butuh Supabase live): migrasi SQL, RLS, alur
  login → MFA → dashboard, Pakasir, dan semua query halaman. Semua ditulis
  sesuai skema migrasi addendum v1.1.0, tapi **belum diuji terhadap database
  nyata**.
- **Pakasir**: halaman system-health hanya cek reachability HTTPS
  `app.pakasir.com` — bukan validasi kredensial. Integrasi pembayaran live
  ada di aplikasi utama, bukan di panel admin.
- **WebRTC/TURN**: “belum dikonfigurasi” — panel tidak berpura-pura sehat.
