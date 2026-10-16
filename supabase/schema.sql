-- Skema database SapaLive (Supabase / PostgreSQL)
-- Database produksi: sapa_live
-- Jalankan di SQL Editor Supabase setelah project dibuat.
-- Tidak ada data dummy: tabel hanya diisi oleh aktivitas pengguna nyata.

-- Profil publik pengguna
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  birth_date date not null,
  country text default 'Indonesia',
  interests text[] default '{}',
  avatar_url text,
  language text not null default 'id' check (language in ('id', 'en')),
  show_online boolean not null default true,
  allow_random boolean not null default true,
  age_verified boolean not null default false,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  is_online boolean default false,
  last_seen timestamptz default now(),
  created_at timestamptz default now(),
  constraint adult_only check (birth_date <= current_date - interval '18 years')
);

-- Dompet token
create table if not exists wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens integer not null default 0,
  free_used integer not null default 0,
  free_date date not null default current_date,
  updated_at timestamptz default now()
);

-- Riwayat transaksi token
create table if not exists token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('topup', 'match_spend', 'gift', 'refund')),
  amount integer not null,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

-- Sesi match / panggilan
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  room_id text unique not null,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_sec integer,
  skipped boolean default false
);

-- Pesan teks antar pengguna yang pernah match
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz default now()
);

-- Notifikasi
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  meta jsonb default '{}',
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Blokir pengguna
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint no_self_block check (blocker_id != blocked_id),
  constraint unique_block unique (blocker_id, blocked_id)
);

-- Laporan moderasi
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  reason text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table wallets enable row level security;
alter table token_transactions enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;

-- Profil: semua orang bisa baca; pemilik bisa insert/ubah miliknya
create policy "profiles readable" on profiles
  for select using (true);
create policy "profiles updatable by owner" on profiles
  for update using (auth.uid() = id);
create policy "profiles insertable by owner" on profiles
  for insert with check (auth.uid() = id);

-- Wallet: hanya pemilik
create policy "wallet owner only" on wallets
  for all using (auth.uid() = user_id);

-- Transaksi: hanya pemilik (baca)
create policy "transactions readable by owner" on token_transactions
  for select using (auth.uid() = user_id);

-- Match: hanya peserta
create policy "matches visible to participants" on matches
  for select using (auth.uid() in (user_a, user_b));
create policy "matches insertable by participant" on matches
  for insert with check (auth.uid() in (user_a, user_b));
create policy "matches updatable by participant" on matches
  for update using (auth.uid() in (user_a, user_b));

-- Messages: hanya peserta match terkait
create policy "messages visible to participants" on messages
  for select using (
    exists (
      select 1 from matches m
      where m.id = messages.match_id and auth.uid() in (m.user_a, m.user_b)
    )
  );
create policy "messages insertable by participant" on messages
  for insert with check (
    auth.uid() = sender_id and exists (
      select 1 from matches m
      where m.id = messages.match_id and auth.uid() in (m.user_a, m.user_b)
    )
  );

-- Notifications: pemilik kelola miliknya; user terautentikasi bisa insert
-- (untuk notifikasi match/pesan ke lawan bicara)
create policy "notifications owner read/update/delete" on notifications
  for select using (auth.uid() = user_id);
create policy "notifications owner update" on notifications
  for update using (auth.uid() = user_id);
create policy "notifications owner delete" on notifications
  for delete using (auth.uid() = user_id);
create policy "notifications insertable by authenticated" on notifications
  for insert to authenticated with check (true);

-- Blocks: blocker bisa kelola miliknya; dibaca untuk filter matchmaking
create policy "blocks manageable by blocker" on blocks
  for all using (auth.uid() = blocker_id);
create policy "blocks readable" on blocks
  for select using (true);

-- Reports: pelapor bisa insert; admin bisa baca & ubah status
create policy "reports insertable" on reports
  for insert with check (auth.uid() = reporter_id);
create policy "reports readable by admin" on reports
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin)
  );
create policy "reports updatable by admin" on reports
  for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin)
  );

-- Realtime untuk signaling: aktifkan broadcast di channel room-*
-- (Di Dashboard: Database → Replication → aktifkan untuk tabel yang dibutuhkan,
--  atau gunakan channel broadcast tanpa tabel via supabase.channel("room-xxx"))
-- Untuk messages realtime: aktifkan replication pada tabel messages.
