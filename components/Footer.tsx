"use client";

import Link from "next/link";
import { VideoCamera } from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";

export default function Footer() {
  const { t } = useLang();
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t("landing.feat_kicker"),
      links: [
        { label: t("landing.feat_kicker"), href: "#fitur" },
        { label: t("landing.how_kicker"), href: "#cara-kerja" },
        { label: t("landing.faq_kicker"), href: "#faq" },
      ],
    },
    {
      title: t("landing.footer_safety"),
      links: [
        { label: t("landing.footer_safety"), href: "/safety" },
        { label: t("landing.footer_privacy"), href: "/privacy" },
        { label: t("landing.footer_terms"), href: "/terms" },
      ],
    },
    {
      title: "SapaLive",
      links: [
        { label: t("nav.login"), href: "/login" },
        { label: t("nav.register"), href: "/register" },
        { label: t("nav.match"), href: "/match" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Link href="/" className="flex items-center gap-2" aria-label="SapaLive">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white">
              <VideoCamera size={22} weight="fill" aria-hidden />
            </span>
            <span className="text-2xl font-extrabold tracking-tight">
              Sapa<span className="text-accent">Live</span>
            </span>
          </Link>
          <p className="mt-4 max-w-[42ch] leading-relaxed text-ink-soft">
            {t("brand.tagline")}
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} className="lg:col-span-2" aria-label={c.title}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
              {c.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[15px] font-medium text-ink-soft transition-colors hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm font-medium text-ink-soft sm:flex-row sm:px-6">
          <p>© 2026 SapaLive. {t("landing.footer_rights")}</p>
          <p>18+</p>
        </div>
      </div>
    </footer>
  );
}
