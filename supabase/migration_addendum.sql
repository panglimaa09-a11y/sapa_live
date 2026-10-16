-- ============================================================================
-- MIGRASI ADDENDUM v1.1.0 — Sapa.live
-- Gender-Based Discovery, Female Creator, Male User, Video Call & Token Economy
-- ----------------------------------------------------------------------------
-- SIFAT: aditif & idempoten (aman dijalankan ulang).
-- Jalankan di Supabase Dashboard → SQL Editor SETELAH supabase/schema.sql.
-- TIDAK ADA data seed dummy. Semua tabel mulai kosong dan terisi dari
-- aktivitas nyata.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom baru di profiles
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'MALE'
      CHECK (role IN ('MALE','FEMALE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='verification_status') THEN
    ALTER TABLE profiles ADD COLUMN verification_status text NOT NULL DEFAULT 'UNVERIFIED'
      CHECK (verification_status IN ('UNVERIFIED','PENDING_REVIEW','VERIFIED','REJECTED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='creator_status') THEN
    ALTER TABLE profiles ADD COLUMN creator_status text NOT NULL DEFAULT 'INACTIVE'
      CHECK (creator_status IN ('INACTIVE','PENDING','ACTIVE','SUSPENDED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='account_status') THEN
    ALTER TABLE profiles ADD COLUMN account_status text NOT NULL DEFAULT 'ACTIVE'
      CHECK (account_status IN ('ACTIVE','SUSPENDED','BANNED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_available') THEN
    ALTER TABLE profiles ADD COLUMN is_available boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tabel konfigurasi billing (nilai contoh — BELUM DITENTUKAN Tuan)
-- ----------------------------------------------------------------------------
create table if not exists billing_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
COMMENT ON TABLE billing_config IS 'BELUM DITENTUKAN Tuan: komisi platform, tarif, dsb. Jangan produksi sebelum diisi.';
insert into billing_config (key, value) values
  ('platform_fee_pct', '0'),
  ('tokens_per_interval', '3'),
  ('interval_seconds', '30')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Tabel-tabel baru addendum
-- ----------------------------------------------------------------------------
create table if not exists creator_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  avatar_url text,
  bio text,
  preferred_language text not null default 'id',
  rate_tokens_per_interval int not null default 3 check (rate_tokens_per_interval > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('TOPUP','CALL_DEBIT','CALL_REFUND','ADMIN_ADJUST')),
  amount int not null,
  balance_after int,
  reference_type text,
  reference_id text,
  idempotency_key text not null unique,
  created_at timestamptz default now()
);
create index if not exists token_ledger_user_idx on token_ledger(user_id, created_at desc);

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  male_user_id uuid not null references auth.users(id) on delete cascade,
  female_creator_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED','ACCEPTED','DECLINED','ENDED','EXPIRED','CANCELLED')),
  requested_at timestamptz default now(),
  accepted_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  billable_duration_seconds int not null default 0,
  end_reason text,
  created_at timestamptz default now(),
  check (male_user_id <> female_creator_id)
);
create index if not exists calls_male_idx on calls(male_user_id, created_at desc);
create index if not exists calls_creator_idx on calls(female_creator_id, created_at desc);

create table if not exists call_billing (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  interval_number int not null,
  duration_seconds int not null,
  tokens_charged int not null,
  ledger_transaction_id uuid references token_ledger(id) on delete set null,
  created_at timestamptz default now(),
  unique (call_id, interval_number)
);

create table if not exists creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  call_id uuid not null unique references calls(id) on delete cascade,
  gross_tokens int not null,
  platform_fee_tokens int not null default 0,
  net_tokens int not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','AVAILABLE','WITHDRAWAL_REQUESTED','PAID','ON_HOLD','REVERSED')),
  created_at timestamptz default now(),
  available_at timestamptz
);
create index if not exists creator_earnings_creator_idx on creator_earnings(creator_id, status);

create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  amount_tokens int not null check (amount_tokens > 0),
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED','PROCESSING','PAID','FAILED','REJECTED')),
  payment_reference text,
  requested_at timestamptz default now(),
  processed_at timestamptz,
  failure_reason text
);
create index if not exists withdrawals_creator_idx on withdrawals(creator_id, requested_at desc);

create table if not exists verification_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'MANUAL_REVIEW',
  verification_type text not null default 'IDENTITY_FACE',
  status text not null check (status in ('PENDING','APPROVED','REJECTED')),
  provider_reference text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists verification_records_user_idx on verification_records(user_id, created_at desc);

create table if not exists topup_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  tokens int not null check (tokens > 0),
  amount_idr int not null check (amount_idr > 0),
  pakasir_txn_id text unique,
  pakasir_order_id text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING','PAID','EXPIRED','FAILED')),
  created_at timestamptz default now(),
  paid_at timestamptz
);
create index if not exists topup_orders_user_idx on topup_orders(user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Storage bucket avatars (publik, untuk foto profil kreator)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ----------------------------------------------------------------------------
-- 5. Helper functions (SECURITY DEFINER — jalan sebagai postgres, bypass RLS)
-- ----------------------------------------------------------------------------
create or replace function is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_admin = true
  );
$$;

create or replace function is_eligible_creator(uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = uid
      and role = 'FEMALE'
      and verification_status = 'VERIFIED'
      and creator_status = 'ACTIVE'
      and account_status = 'ACTIVE'
  );
$$;

-- Kredit topup atomik & idempoten dalam SATU transaksi:
-- cek idempotency dulu (tidak kredit ulang), lalu tambah saldo + tulis ledger.
create or replace function settle_topup(p_user_id uuid, p_amount int, p_idempotency_key text, p_reference_id text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_balance int;
begin
  if exists (select 1 from token_ledger where idempotency_key = p_idempotency_key) then
    select tokens into v_balance from wallets where user_id = p_user_id;
    return coalesce(v_balance, 0);
  end if;

  insert into wallets (user_id, tokens, updated_at)
  values (p_user_id, greatest(p_amount, 0), now())
  on conflict (user_id) do update
    set tokens = wallets.tokens + p_amount,
        updated_at = now()
  returning tokens into v_balance;

  insert into token_ledger (user_id, transaction_type, amount, balance_after, reference_type, reference_id, idempotency_key)
  values (p_user_id, 'TOPUP', p_amount, v_balance, 'topup_order', p_reference_id, p_idempotency_key)
  on conflict (idempotency_key) do nothing;

  return v_balance;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS: aktifkan di semua tabel baru
-- ----------------------------------------------------------------------------
alter table creator_profiles enable row level security;
alter table token_ledger enable row level security;
alter table calls enable row level security;
alter table call_billing enable row level security;
alter table creator_earnings enable row level security;
alter table withdrawals enable row level security;
alter table verification_records enable row level security;
alter table topup_orders enable row level security;
alter table billing_config enable row level security;

-- ----------------------------------------------------------------------------
-- 7. PERBAIKAN KEBOCORAN: profiles tertutup untuk publik
--    (policy lama "profiles readable" = using(true) membocorkan date_of_birth)
-- ----------------------------------------------------------------------------
drop policy if exists "profiles readable" on profiles;
drop policy if exists "profiles updatable by owner" on profiles;
drop policy if exists "profiles insertable by owner" on profiles;
drop policy if exists "profiles owner select" on profiles;
drop policy if exists "profiles owner update" on profiles;
drop policy if exists "profiles owner insert" on profiles;
drop policy if exists "profiles admin all" on profiles;

create policy "profiles owner select" on profiles
  for select using (auth.uid() = id);
create policy "profiles owner update" on profiles
  for update using (auth.uid() = id);
create policy "profiles owner insert" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles admin all" on profiles
  for all using (is_admin());

-- View publik minimal untuk nama peer (tanpa date_of_birth / data sensitif).
-- View jalan sebagai owner (postgres) sehingga bypass RLS profiles.
create or replace view public_profiles as
  select id, display_name, role, is_available from profiles;
grant select on public_profiles to authenticated;

-- ----------------------------------------------------------------------------
-- 8. RLS tabel-tabel addendum
-- ----------------------------------------------------------------------------

-- creator_profiles
drop policy if exists "creator_profiles select" on creator_profiles;
create policy "creator_profiles select" on creator_profiles
  for select using (
    auth.uid() = user_id or is_admin() or is_eligible_creator(user_id)
  );
drop policy if exists "creator_profiles owner write" on creator_profiles;
create policy "creator_profiles owner write" on creator_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- wallets: client HANYA baca miliknya. Saldo hanya diubah via service_role.
drop policy if exists "wallet owner only" on wallets;
drop policy if exists "wallets owner select" on wallets;
drop policy if exists "wallets admin select" on wallets;
create policy "wallets owner select" on wallets
  for select using (auth.uid() = user_id);
create policy "wallets admin select" on wallets
  for select using (is_admin());

-- token_ledger: append-only, client hanya baca miliknya
drop policy if exists "token_ledger owner select" on token_ledger;
create policy "token_ledger owner select" on token_ledger
  for select using (auth.uid() = user_id);
drop policy if exists "token_ledger admin select" on token_ledger;
create policy "token_ledger admin select" on token_ledger
  for select using (is_admin());

-- calls: baca oleh peserta / admin; tulis hanya via service_role
drop policy if exists "calls participant select" on calls;
create policy "calls participant select" on calls
  for select using (
    auth.uid() = male_user_id or auth.uid() = female_creator_id or is_admin()
  );

-- call_billing: baca oleh peserta call terkait / admin
drop policy if exists "call_billing participant select" on call_billing;
create policy "call_billing participant select" on call_billing
  for select using (
    is_admin() or exists (
      select 1 from calls c
      where c.id = call_billing.call_id
        and (c.male_user_id = auth.uid() or c.female_creator_id = auth.uid())
    )
  );

-- creator_earnings: kreator / admin
drop policy if exists "creator_earnings select" on creator_earnings;
create policy "creator_earnings select" on creator_earnings
  for select using (auth.uid() = creator_id or is_admin());

-- withdrawals
drop policy if exists "withdrawals select" on withdrawals;
create policy "withdrawals select" on withdrawals
  for select using (auth.uid() = creator_id or is_admin());
drop policy if exists "withdrawals creator insert" on withdrawals;
create policy "withdrawals creator insert" on withdrawals
  for insert with check (
    auth.uid() = creator_id and status = 'REQUESTED' and amount_tokens > 0
  );
drop policy if exists "withdrawals admin update" on withdrawals;
create policy "withdrawals admin update" on withdrawals
  for update using (is_admin());

-- verification_records: pemilik / admin, tulis via service_role
drop policy if exists "verification_records select" on verification_records;
create policy "verification_records select" on verification_records
  for select using (auth.uid() = user_id or is_admin());

-- topup_orders: baca pemilik / admin, tulis via service_role
drop policy if exists "topup_orders select" on topup_orders;
create policy "topup_orders select" on topup_orders
  for select using (auth.uid() = user_id or is_admin());

-- billing_config: baca authenticated (tarif tampil di UI), tulis service_role
drop policy if exists "billing_config readable" on billing_config;
create policy "billing_config readable" on billing_config
  for select using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 9. Trigger: cegah user memalsukan status verifikasi dari client
-- ----------------------------------------------------------------------------
create or replace function protect_profile_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (
    old.role is distinct from new.role
    or old.verification_status is distinct from new.verification_status
    or old.creator_status is distinct from new.creator_status
    or old.account_status is distinct from new.account_status
    or old.is_admin is distinct from new.is_admin
    or old.is_banned is distinct from new.is_banned
    or old.age_verified is distinct from new.age_verified
  )
  and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
  and current_user <> 'postgres' then
    raise exception 'profile status fields are server-managed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_status on profiles;
create trigger protect_profile_status
  before update on profiles
  for each row execute function protect_profile_status();

-- ----------------------------------------------------------------------------
-- 10. settle_call: penagihan atomik & idempoten (SECURITY DEFINER)
--     Kebijakan pembulatan eksplisit: floor ke interval penuh 30 detik.
--     Durasi yang belum terjadi TIDAK ditagih.
-- ----------------------------------------------------------------------------
create or replace function settle_call(p_call_id uuid, p_end_reason text default 'completed')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_call calls%rowtype;
  v_billable int := 0;
  v_intervals int := 0;
  v_interval_seconds int := 30;
  v_rate int := 3;
  v_fee_pct numeric := 0;
  v_tokens_due int := 0;
  v_balance int := 0;
  v_debit int := 0;
  v_ledger_id uuid;
  v_fee int := 0;
  v_key text;
  i int;
begin
  select * into v_call from calls where id = p_call_id for update;
  if not found then
    raise exception 'call not found';
  end if;

  -- Idempoten: sudah ENDED → kembalikan ringkasan tersimpan
  if v_call.status = 'ENDED' then
    select count(*) into v_intervals from call_billing where call_id = p_call_id;
    select coalesce(sum(tokens_charged), 0) into v_debit from call_billing where call_id = p_call_id;
    return jsonb_build_object(
      'call_id', v_call.id,
      'billable_seconds', v_call.billable_duration_seconds,
      'intervals', v_intervals,
      'tokens_charged', v_debit,
      'already_settled', true
    );
  end if;

  -- Konfigurasi (fallback aman bila baris config belum ada)
  select nullif(value,'')::int into v_interval_seconds from billing_config where key = 'interval_seconds';
  v_interval_seconds := coalesce(v_interval_seconds, 30);
  select nullif(value,'')::int into v_rate from billing_config where key = 'tokens_per_interval';
  v_rate := coalesce(v_rate, 3);
  select nullif(value,'')::numeric into v_fee_pct from billing_config where key = 'platform_fee_pct';
  v_fee_pct := coalesce(v_fee_pct, 0);

  -- Durasi tertagih: hanya jika koneksi WebRTC pernah terkonfirmasi
  if v_call.connected_at is not null then
    v_billable := greatest(0, floor(extract(epoch from (coalesce(v_call.ended_at, now()) - v_call.connected_at)))::int);
  else
    v_billable := 0;
  end if;
  v_intervals := v_billable / v_interval_seconds; -- floor eksplisit
  v_tokens_due := v_intervals * v_rate;

  -- Kunci dompet male user, debit maksimal sebesar saldo (tidak negatif)
  select tokens into v_balance from wallets where user_id = v_call.male_user_id for update;
  v_balance := coalesce(v_balance, 0);
  v_debit := least(v_tokens_due, v_balance);
  if v_balance > 0 and v_debit > 0 then
    update wallets set tokens = tokens - v_debit, updated_at = now()
    where user_id = v_call.male_user_id;
  end if;

  -- Ledger debit (idempoten via idempotency_key)
  v_key := 'call:' || p_call_id::text || ':debit';
  insert into token_ledger (user_id, transaction_type, amount, balance_after, reference_type, reference_id, idempotency_key)
  values (v_call.male_user_id, 'CALL_DEBIT', -v_debit, v_balance - v_debit, 'call', p_call_id::text, v_key)
  on conflict (idempotency_key) do nothing;
  select id into v_ledger_id from token_ledger where idempotency_key = v_key;

  -- Rincian per interval (idempoten via unique(call_id, interval_number))
  for i in 1..v_intervals loop
    insert into call_billing (call_id, interval_number, duration_seconds, tokens_charged, ledger_transaction_id)
    values (p_call_id, i, v_interval_seconds, v_rate, v_ledger_id)
    on conflict (call_id, interval_number) do nothing;
  end loop;

  -- Penghasilan kreator: dari debit aktual yang terbayar
  v_fee := round(v_debit * v_fee_pct / 100)::int;
  insert into creator_earnings (creator_id, call_id, gross_tokens, platform_fee_tokens, net_tokens, status)
  values (v_call.female_creator_id, p_call_id, v_debit, v_fee, v_debit - v_fee, 'PENDING')
  on conflict (call_id) do nothing;

  update calls
  set status = 'ENDED',
      ended_at = coalesce(ended_at, now()),
      billable_duration_seconds = v_billable,
      end_reason = p_end_reason
  where id = p_call_id;

  return jsonb_build_object(
    'call_id', p_call_id,
    'billable_seconds', v_billable,
    'intervals', v_intervals,
    'tokens_charged', v_debit,
    'already_settled', false
  );
end;
$$;
