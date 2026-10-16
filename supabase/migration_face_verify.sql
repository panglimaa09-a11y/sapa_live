-- SapaLive: face verification (live camera) — 16 Okt 2026
-- Menyimpan HASIL verifikasi wajah, BUKAN data wajah.
-- Privasi: deskriptor wajah & frame kamera tidak pernah dikirim ke server.
-- Yang disimpan hanya: skor jarak (angka), lolos liveness (boolean), waktu.

alter table verification_records
  add column if not exists face_match_score numeric,
  add column if not exists face_liveness_passed boolean default false,
  add column if not exists face_verified_at timestamptz;

-- Backfill dari provider_reference format lama "face_score=X.XXX;liveness=pass"
update verification_records
set face_match_score = (regexp_match(provider_reference, 'face_score=([0-9.]+)'))[1]::numeric,
    face_liveness_passed = provider_reference like '%liveness=pass%',
    face_verified_at = created_at
where provider = 'FACE_MATCH_LIVE' and face_match_score is null;
