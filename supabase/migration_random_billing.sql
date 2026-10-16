-- SapaLive: billing untuk matchmaking acak — 16 Okt 2026
-- Match acak juga memotong token dari caller. Karena lawan bicara belum tentu
-- kreator, platform memegang 100% (tidak ada creator_earnings untuk match acak).

alter table calls add column if not exists is_random_match boolean not null default false;
alter table calls add column if not exists room_id text;

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

  -- Penghasilan kreator: HANYA untuk panggilan kreator (bukan match acak).
  -- Match acak: platform pegang 100%.
  if not coalesce(v_call.is_random_match, false) then
    v_fee := round(v_debit * v_fee_pct / 100)::int;
    insert into creator_earnings (creator_id, call_id, gross_tokens, platform_fee_tokens, net_tokens, status)
    values (v_call.female_creator_id, p_call_id, v_debit, v_fee, v_debit - v_fee, 'PENDING')
    on conflict (call_id) do nothing;
  end if;

  update calls
  set status = 'ENDED',
      ended_at = coalesce(ended_at, now()),
      billable_duration_seconds = v_billable,
      end_reason = p_end_reason
  where id = p_call_id;

  return jsonb_build_object(
    'call_id', v_call.id,
    'billable_seconds', v_billable,
    'intervals', v_intervals,
    'tokens_charged', v_debit,
    'already_settled', false
  );
end;
$$;
