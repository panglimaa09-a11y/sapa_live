-- ============================================================================
-- SAPA.LIVE ADMIN CONTROL CENTER — migrasi
-- Jalankan SETELAH schema.sql dan migration_addendum.sql di Supabase SQL Editor.
-- Aditif: semua IF NOT EXISTS. Tidak menghapus data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabel admin
-- ----------------------------------------------------------------------------
create table if not exists admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('SUPER_ADMIN','ADMIN','MODERATOR','FINANCE','SUPPORT')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists admin_mfa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Format: base64(iv) || '.' || base64(ciphertext) || '.' || base64(tag),
  -- AES-256-GCM dengan ADMIN_MFA_ENCRYPTION_KEY. Jangan simpan plaintext.
  secret_encrypted text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_actor_idx on admin_audit_logs (actor_id);
create index if not exists admin_audit_logs_action_idx on admin_audit_logs (action);
create index if not exists admin_audit_logs_created_idx on admin_audit_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Helper: apakah pemanggil adalah staf admin (bypass RLS, anti-rekursi)
-- ----------------------------------------------------------------------------
create or replace function is_staff()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from admin_roles where user_id = auth.uid());
$$;

create or replace function staff_role()
returns text language sql security definer set search_path = public as $$
  select role from admin_roles where user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 3. RLS: staf boleh baca; TULIS hanya via service_role (API admin)
-- ----------------------------------------------------------------------------
alter table admin_roles enable row level security;
alter table admin_mfa enable row level security;
alter table admin_audit_logs enable row level security;

drop policy if exists "admin_roles readable by staff" on admin_roles;
create policy "admin_roles readable by staff" on admin_roles
  for select using (is_staff());

drop policy if exists "admin_mfa readable by self" on admin_mfa;
create policy "admin_mfa readable by self" on admin_mfa
  for select using (auth.uid() = user_id);

drop policy if exists "audit readable by staff" on admin_audit_logs;
create policy "audit readable by staff" on admin_audit_logs
  for select using (is_staff());

-- Sengaja TIDAK ada policy insert/update/delete untuk role authenticated:
-- semua penulisan lewat service_role dari aplikasi admin (tercatat di audit log).

-- ----------------------------------------------------------------------------
-- 4. Koreksi token atomik untuk admin (dipanggil service_role via RPC)
-- ----------------------------------------------------------------------------
create or replace function admin_adjust_tokens(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_actor_id uuid
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
  v_ledger_id uuid;
begin
  if p_delta = 0 then
    raise exception 'delta tidak boleh nol';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'alasan koreksi wajib diisi (min 5 karakter)';
  end if;

  select tokens into v_balance from wallets where user_id = p_user_id for update;
  if not found then
    insert into wallets (user_id, tokens) values (p_user_id, 0) returning tokens into v_balance;
  end if;
  if v_balance + p_delta < 0 then
    raise exception 'saldo tidak mencukupi untuk koreksi ini';
  end if;

  update wallets set tokens = v_balance + p_delta, updated_at = now()
    where user_id = p_user_id;

  insert into token_ledger (user_id, transaction_type, amount, balance_after,
    reference_type, reference_id, idempotency_key)
  values (p_user_id, 'ADMIN_ADJUST', p_delta, v_balance + p_delta,
    'admin_adjust', p_actor_id::text,
    'admin_adjust:' || p_user_id::text || ':' || extract(epoch from now())::bigint::text || ':' || substr(md5(random()::text),1,8))
  returning id into v_ledger_id;

  insert into admin_audit_logs (actor_id, action, resource_type, resource_id, meta)
  values (p_actor_id, 'wallet.adjust', 'wallets', p_user_id::text,
    jsonb_build_object('delta', p_delta, 'balance_after', v_balance + p_delta,
      'reason', p_reason, 'ledger_id', v_ledger_id));

  return json_build_object('balance_after', v_balance + p_delta, 'ledger_id', v_ledger_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Provisioning admin pertama (JALANKAN MANUAL, ganti UUID + email)
-- ----------------------------------------------------------------------------
-- Contoh (psql / SQL Editor sebagai pemilik database):
--
--   insert into admin_roles (user_id, role)
--   values ('<UUID_DARI_AUTH.USERS>', 'SUPER_ADMIN');
--
-- Dapatkan UUID: Supabase Dashboard → Authentication → Users → salin UID akun Tuan.
-- Akun admin TIDAK BISA dibuat dari halaman registrasi publik.
