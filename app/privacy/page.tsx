"use client";

import { useLang, usePageTitle } from "../../lib/i18n";

const body: Record<string, string[]> = {
  id: [
    "Kebijakan Privasi SapaLive — terakhir diperbarui 15 Oktober 2026.",
    "1. Data yang kami kumpulkan: nama tampilan, email, tanggal lahir (untuk verifikasi 18+), serta data teknis yang diperlukan agar layanan berjalan (mis. log koneksi).",
    "2. Video call bersifat peer-to-peer (WebRTC) langsung antar perangkat dan TIDAK direkam atau disimpan oleh kami.",
    "3. Pesan teks disimpan agar kamu bisa melanjutkan percakapan, dan bisa dihapus dengan menghapus akun.",
    "4. Kami tidak menjual data pribadimu kepada pihak ketiga.",
    "5. Kamu bisa mengunduh atau menghapus datamu kapan saja lewat Pengaturan → Hapus akun, atau hubungi kami.",
    "6. Pengguna yang diblokir tidak akan dicocokkan lagi denganmu; daftar blokir hanya terlihat olehmu.",
  ],
  en: [
    "SapaLive Privacy Policy — last updated October 15, 2026.",
    "1. Data we collect: display name, email, date of birth (for 18+ verification), and technical data needed to run the service (e.g. connection logs).",
    "2. Video calls are peer-to-peer (WebRTC) directly between devices and are NOT recorded or stored by us.",
    "3. Text messages are stored so you can continue conversations, and are deleted when you delete your account.",
    "4. We do not sell your personal data to third parties.",
    "5. You can download or delete your data anytime via Settings → Delete account, or contact us.",
    "6. Blocked users will never be matched with you again; your block list is only visible to you.",
  ],
};

export default function PrivacyPage() {
  const { lang } = useLang();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {lang === "id" ? "Kebijakan Privasi" : "Privacy Policy"}
      </h1>
      <div className="mt-6 space-y-4 rounded-[28px] border border-white/10 bg-surface p-6 sm:p-8">
        {body[lang].map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-ink-soft">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
