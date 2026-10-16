"use client";

import { useLang } from "../../../lib/i18n";

const body: Record<string, string[]> = {
  id: [
    "Ketentuan Layanan SapaLive — terakhir diperbarui 15 Oktober 2026.",
    "1. SapaLive hanya untuk pengguna berusia 18 tahun ke atas. Dengan mendaftar, kamu menyatakan usiamu memenuhi syarat.",
    "2. Dilarang: konten seksual eksplisit, pelecehan, ujaran kebencian, spam/penipuan, dan membagikan data pribadi orang lain.",
    "3. Pelanggaran dapat mengakibatkan peringatan, pembatasan, atau penutupan akun permanen.",
    "4. Kamu bertanggung jawab atas perilakumu selama panggilan. Laporkan pelanggaran lewat tombol Laporkan.",
    "5. Layanan disediakan apa adanya; kami berupaya menjaga ketersediaan namun tidak menjamin tanpa gangguan.",
    "6. Token yang dibeli bersifat digital dan tidak dapat diuangkan kembali, kecuali diwajibkan hukum.",
  ],
  en: [
    "SapaLive Terms of Service — last updated October 15, 2026.",
    "1. SapaLive is for users aged 18 and over only. By signing up, you confirm you meet this requirement.",
    "2. Prohibited: explicit sexual content, harassment, hate speech, spam/scams, and sharing others' personal data.",
    "3. Violations may result in warnings, restrictions, or permanent account closure.",
    "4. You are responsible for your behavior during calls. Report violations via the Report button.",
    "5. The service is provided as-is; we strive for availability but do not guarantee uninterrupted service.",
    "6. Purchased tokens are digital goods and non-refundable, except as required by law.",
  ],
};

export default function TermsPage() {
  const { lang } = useLang();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {lang === "id" ? "Ketentuan Layanan" : "Terms of Service"}
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
