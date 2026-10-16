// Sapa.live — konstanta ekonomi token (addendum v1.1.0).
// Tarif diambil backend dari tabel billing_config; konstanta ini hanya
// untuk tampilan/validasi awal di server. Jangan mengandalkan nilai ini
// untuk penagihan — penagihan resmi terjadi di fungsi SQL settle_call.

export const BILLING = {
  tokensPerInterval: 3,
  intervalSeconds: 30,
  // BELUM DITENTUKAN Tuan — jangan produksi sebelum diisi & disetujui.
  platformFeePct: 0,
} as const;

// HARGA RESMI — disetujui Tuan 16 Okt 2026, mengikuti paket ayar.chat.
// Jangan ubah tanpa persetujuan Tuan.
export const TOPUP_PACKAGES = [
  { id: "p160", tokens: 160, idr: 28000 },
  { id: "p240", tokens: 240, idr: 41000 },
  { id: "p530", tokens: 530, idr: 83000 },
  { id: "p880", tokens: 880, idr: 137000 },
  { id: "p1800", tokens: 1800, idr: 274000 },
  { id: "p4600", tokens: 4600, idr: 685000 },
  { id: "p10000", tokens: 10000, idr: 1370000 },
] as const;

export type TopupPackage = (typeof TOPUP_PACKAGES)[number];
