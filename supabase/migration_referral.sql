-- SapaLive — sistem referral + admin grant token (16 Okt 2026, revisi: reward dikunci verifikasi wajah).
-- 1. Setiap user punya kode referral unik.
-- 2. Pendaftar via kode referral → tercatat di `referrals` (status pending_verification).
-- 3. Reward HANYA cair saat yang diundang lolos verifikasi wajah (verification_records APPROVED).
--    Tanpa verifikasi → tidak ada reward, tidak bisa diklaim/ditarik.
-- 4. Admin dapat kirim token gratis via email (tercatat di audit).

-- Kode referral unik per user
alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid references profiles(id) on delete set null;

-- Generate kode referral untuk user yang sudah ada (8 karakter alfanumerik)
create or replace function generate_referral_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, (random() * 31)::int + 1, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

do $$
declare r record;
begin
  for r in select id from profiles where referral_code is null loop
    update profiles set referral_code = generate_referral_code() where id = r.id;
  end loop;
end $$;

create or replace function set_referral_code() returns trigger as $$
begin
  if new.referral_code is null then
    new.referral_code := generate_referral_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_referral_code on profiles;
create trigger trg_set_referral_code
  before insert on profiles
  for each row execute function set_referral_code();

-- Tambah kind baru untuk transaksi token
alter table token_transactions drop constraint if exists token_transactions_kind_check;
alter table token_transactions add constraint token_transactions_kind_check
  check (kind in ('topup', 'match_spend', 'gift', 'refund', 'referral_reward', 'admin_grant'));

-- Besaran reward (default 17 token ≈ Rp 5.000, bisa diubah admin)
create table if not exists referral_config (
  id int primary key default 1 check (id = 1),
  reward_tokens int not null default 17,
  updated_at timestamptz not null default now()
);
insert into referral_config (id, reward_tokens) values (1, 17)
  on conflict (id) do nothing;

-- Tabel referral: lacak undangan yang menunggu verifikasi wajah
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null references profiles(id) on delete cascade unique,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'rewarded', 'expired')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
create index if not exists referrals_referrer_idx on referrals(referrer_id);

-- Saat profil baru dengan referred_by dibuat → catat referral pending
create or replace function track_referral() returns trigger as $$
begin
  if new.referred_by is not null and new.referred_by != new.id then
    insert into referrals (referrer_id, referred_id, status)
      values (new.referred_by, new.id, 'pending_verification')
      on conflict (referred_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_track_referral on profiles;
create trigger trg_track_referral
  after insert on profiles
  for each row execute function track_referral();

-- Saat verifikasi wajah APPROVED → cairkan reward ke referrer
create or replace function release_referral_reward() returns trigger as $$
declare
  ref_row referrals%rowtype;
  reward int;
begin
  -- Hanya saat status berubah menjadi APPROVED untuk verifikasi wajah
  if new.status = 'APPROVED'
     and (old.status is null or old.status != 'APPROVED')
     and new.verification_type = 'IDENTITY_FACE' then
    select * into ref_row from referrals
      where referred_id = new.user_id
        and status = 'pending_verification'
      limit 1;
    if found then
      select reward_tokens into reward from referral_config where id = 1;
      -- Kredit wallet referrer
      insert into wallets (user_id, tokens) values (ref_row.referrer_id, reward)
        on conflict (user_id) do update
        set tokens = wallets.tokens + reward, updated_at = now();
      -- Catat transaksi
      insert into token_transactions (user_id, kind, amount, meta)
        values (ref_row.referrer_id, 'referral_reward', reward,
                jsonb_build_object('referred_user_id', new.user_id,
                                   'referral_id', ref_row.id));
      -- Tandai sudah dicairkan
      update referrals set status = 'rewarded', rewarded_at = now()
        where id = ref_row.id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_release_referral_reward on verification_records;
create trigger trg_release_referral_reward
  after insert or update on verification_records
  for each row execute function release_referral_reward();

-- Audit admin grant token
create table if not exists admin_token_grants (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_email text not null,
  amount int not null check (amount > 0),
  note text default '',
  created_at timestamptz not null default now()
);
