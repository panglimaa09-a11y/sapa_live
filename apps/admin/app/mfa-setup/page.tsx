import { MfaSetupClient } from "./client";

export default function MfaSetupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Aktifkan authenticator
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            MFA wajib untuk administrator. Pindai QR dengan aplikasi
            authenticator (Google Authenticator, Authy, 1Password), lalu
            masukkan kode 6 digit.
          </p>
        </div>
        <MfaSetupClient />
      </div>
    </main>
  );
}
