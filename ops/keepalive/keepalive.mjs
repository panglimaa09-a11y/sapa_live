// ============================================================================
// Agen Keepalive Supabase SapaLive.
// Tugas: login lalu logout via Supabase Auth, agar project tidak dianggap
// tidak aktif (Supabase free tier mem-pause project yang 7 hari tanpa aktivitas).
//
// Kredensial dibaca dari ~/.config/sapalive/keepalive.env (0600):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_ANON_KEY=xxxx
//   KEEPALIVE_EMAIL=keepalive@sapalive.my.id
//   KEEPALIVE_PASSWORD=xxxx
// JANGAN taruh kredensial di repo / di file ini.
// ============================================================================
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ENV_PATH = join(homedir(), ".config", "sapalive", "keepalive.env");

function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    console.log("NOT_CONFIGURED: file kredensial belum ada di " + ENV_PATH);
    process.exit(2);
  }
  const env = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
  }
  for (const k of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "KEEPALIVE_EMAIL", "KEEPALIVE_PASSWORD"]) {
    if (!env[k]) {
      console.log(`NOT_CONFIGURED: ${k} kosong di ${ENV_PATH}`);
      process.exit(2);
    }
  }
  return env;
}

const env = loadEnv();
const base = env.SUPABASE_URL.replace(/\/$/, "");

try {
  // 1. LOGIN
  const loginRes = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: env.KEEPALIVE_EMAIL,
      password: env.KEEPALIVE_PASSWORD,
    }),
  });
  if (!loginRes.ok) {
    console.log(`LOGIN_FAILED: http ${loginRes.status}`);
    process.exit(1);
  }
  const session = await loginRes.json();
  const token = session.access_token;
  if (!token) {
    console.log("LOGIN_FAILED: tidak ada access_token");
    process.exit(1);
  }
  console.log(`LOGIN_OK: ${env.KEEPALIVE_EMAIL}`);

  // 2. Sentuh satu endpoint ringan (bukti aktivitas DB) — tabel config publik.
  //    Gagal di sini tidak fatal; login/logout sudah cukup sebagai aktivitas.
  try {
    const ping = await fetch(`${base}/rest/v1/billing_config?select=key&limit=1`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(`DB_PING: http ${ping.status}`);
  } catch {
    console.log("DB_PING: gagal (diabaikan)");
  }

  // 3. LOGOUT
  const logoutRes = await fetch(`${base}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(logoutRes.ok ? "LOGOUT_OK" : `LOGOUT_WARN: http ${logoutRes.status}`);
  console.log("KEEPALIVE_DONE");
} catch (e) {
  console.log(`ERROR: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
