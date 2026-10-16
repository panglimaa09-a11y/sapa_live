"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";

export default function Faq() {
  const { t } = useLang();
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    { q: t("landing.faq_1q"), a: t("landing.faq_1a") },
    { q: t("landing.faq_2q"), a: t("landing.faq_2a") },
    { q: t("landing.faq_3q"), a: t("landing.faq_3a") },
    { q: t("landing.faq_4q"), a: t("landing.faq_4a") },
  ];

  return (
    <section id="faq" className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 lg:py-28">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-accent2">
        {t("landing.faq_kicker")}
      </p>
      <h2 className="text-4xl font-extrabold tracking-tighter sm:text-5xl">
        {t("landing.faq_title")}
      </h2>

      <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-lg font-bold tracking-tight">{f.q}</span>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                    isOpen ? "bg-accent text-white" : "bg-white/5 text-ink"
                  }`}
                >
                  <Plus
                    size={18}
                    weight="bold"
                    aria-hidden
                    className={`transition-transform ${isOpen ? "rotate-45" : ""}`}
                  />
                </span>
              </button>
              {isOpen && (
                <p className="max-w-[62ch] pb-6 leading-relaxed text-ink-soft">
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
