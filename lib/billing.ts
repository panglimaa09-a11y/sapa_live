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

// HARGA CONTOH — Tuan yang tentukan sebelum produksi.
// Jangan tampilkan ke publik sebagai harga final sebelum disetujui.
export const TOPUP_PACKAGES = [
  { id: "starter", tokens: 50, idr: 15000 },
  { id: "plus", tokens: 120, idr: 30000 },
  { id: "max", tokens: 300, idr: 75000 },
] as const;

export type TopupPackage = (typeof TOPUP_PACKAGES)[number];
