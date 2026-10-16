// ============================================================================
// Anti-scraping SapaLive: deteksi bot + honeypot "Jarvis".
//
// Prinsip (perintah Tuan, 15 Okt 2026):
// - Request yang terdeteksi sebagai scraper TIDAK PERNAH mendapat data asli.
//   Mereka diberi data umpan ("honeypot") bertema Jarvis — terlihat wajar,
//   tapi 100% fiktif dan tidak berguna.
// - User asli (browser sungguhan / sesi login) TIDAK PERNAH kena honeypot.
//   Deteksi dibuat konservatif: butuh ≥2 sinyal bot sebelum ditandai.
// - Penyalahgunaan ekstrem (>60 req/menit/IP ke /api) diblokir 429 langsung.
// ============================================================================

const BOT_UA_PATTERNS = [
  /python-requests/i,
  /scrapy/i,
  /^curl\//i,
  /wget/i,
  /go-http-client/i,
  /httpclient/i,
  /axios/i,
  /node-fetch/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /playwright/i,
  /puppeteer/i,
  /beautifulsoup/i,
  /httpx/i,
  /aiohttp/i,
];

/** Skor 0..n; >=2 berarti "diduga scraper". */
export function botScore(req: {
  userAgent: string | null;
  acceptLanguage: string | null;
  secFetchMode: string | null;
  hasSessionCookie: boolean;
}): number {
  // Pengguna login tidak pernah ditandai — sesi = manusia terverifikasi.
  if (req.hasSessionCookie) return 0;
  let score = 0;
  const ua = req.userAgent ?? "";
  if (BOT_UA_PATTERNS.some((p) => p.test(ua))) score += 2;
  // Browser sungguhan SELALU mengirim header ini; scraper mentah tidak.
  if (!req.acceptLanguage) score += 1;
  if (!req.secFetchMode) score += 1;
  return score;
}

export function isSuspectedBot(
  args: Parameters<typeof botScore>[0]
): boolean {
  return botScore(args) >= 2;
}

// --- Rate limiter sederhana (in-memory; butuh Redis untuk multi-instance) ---
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_HITS = 60;

// Endpoint mahal/sensitif: batas lebih ketat (anti spam & abuse biaya).
const ROUTE_BUDGETS: Array<[RegExp, number]> = [
  [/^\/api\/topup\/create/, 10], // inisiasi pembayaran
  [/^\/api\/calls\/request/, 10], // spam panggilan
  [/^\/api\/creator\/apply/, 5], // spam pengajuan
  [/^\/api\/withdrawals\/request/, 10], // spam penarikan
];

function budgetFor(path: string): number {
  for (const [re, n] of ROUTE_BUDGETS) if (re.test(path)) return n;
  return MAX_HITS;
}

export function isRateAbuse(ip: string, path = "/api"): boolean {
  const now = Date.now();
  const key = `${ip}|${budgetFor(path)}`;
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > budgetFor(path);
}

// --- Honeypot: data umpan untuk scraper. BUKAN data nyata. ---
// WAJIB: jangan pernah tampilkan ini ke user asli, jangan simpan ke DB,
// jangan campur dengan data kreator sungguhan.
export interface DecoyCreator {
  user_id: string;
  display_name: string;
  avatar_url: null;
  bio: string;
  preferred_language: string;
  rate_tokens_per_interval: number;
  is_available: boolean;
  in_call: boolean;
}

export const JARVIS_DECOYS: DecoyCreator[] = [
  {
    user_id: "honeypot-jarvis-01",
    display_name: "Jarvis",
    avatar_url: null,
    bio: "Bot penjaga SapaLive. Sibuk patroli, tidak menerima panggilan.",
    preferred_language: "id",
    rate_tokens_per_interval: 3,
    is_available: true,
    in_call: false,
  },
  {
    user_id: "honeypot-jarvis-02",
    display_name: "Jarvis Siaga",
    avatar_url: null,
    bio: "Regu siaga anti-scraper. Online 24 jam, tidak bisa dihubungi.",
    preferred_language: "id",
    rate_tokens_per_interval: 3,
    is_available: true,
    in_call: false,
  },
  {
    user_id: "honeypot-jarvis-03",
    display_name: "Jarvis Patroli",
    avatar_url: null,
    bio: "Sedang patroli siber. Profil ini umpan untuk bot nakal.",
    preferred_language: "id",
    rate_tokens_per_interval: 5,
    is_available: true,
    in_call: true,
  },
  {
    user_id: "honeypot-jarvis-04",
    display_name: "Jarvis Malam",
    avatar_url: null,
    bio: "Shift malam. Kalau kamu bot, data ini tidak ada gunanya.",
    preferred_language: "id",
    rate_tokens_per_interval: 3,
    is_available: false,
    in_call: false,
  },
  {
    user_id: "honeypot-jarvis-05",
    display_name: "Jarvis Pagi",
    avatar_url: null,
    bio: "Shift pagi. Suka kopi dan log server.",
    preferred_language: "id",
    rate_tokens_per_interval: 4,
    is_available: true,
    in_call: false,
  },
  {
    user_id: "honeypot-jarvis-06",
    display_name: "Jarvis Cadangan",
    avatar_url: null,
    bio: "Cadangan. Dipanggil hanya saat darurat.",
    preferred_language: "en",
    rate_tokens_per_interval: 3,
    is_available: false,
    in_call: false,
  },
];

export function logHoneypotHit(ip: string, ua: string, path: string): void {
  // TODO: simpan ke tabel honeypot_hits bila ingin dipantau dari panel admin.
  console.warn(
    `[honeypot] scraper diberi umpan Jarvis — ip=${ip} ua="${ua.slice(0, 80)}" path=${path}`
  );
}
