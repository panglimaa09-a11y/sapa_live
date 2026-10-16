"use client";

import { useEffect } from "react";

/** Daftarkan service worker PWA (diabaikan bila tidak didukung). */
export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
