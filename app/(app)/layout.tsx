import AppNav from "../../components/AppNav";
import { SessionProvider, AuthGuard } from "../../lib/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthGuard>
        <AppNav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 sm:px-6">
          {children}
        </main>
        {/* Spacer bottom nav mobile */}
        <div className="h-20 md:hidden" aria-hidden />
      </AuthGuard>
    </SessionProvider>
  );
}
