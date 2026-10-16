import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Domain utama sapalive.my.id — alihkan semua traffic vercel.app
      {
        source: "/:path*",
        has: [{ type: "host", value: "sapa-live.vercel.app" }],
        destination: "https://sapalive.my.id/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Kamera/mikrofon SENGAJA tidak diblokir — dipakai video call.
          { key: "Permissions-Policy", value: "geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
