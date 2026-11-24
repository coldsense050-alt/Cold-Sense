import { useState } from "react";
import { Outlet } from "react-router";
import Navbar from "../components/Navbar";
import AlertasFlutuantes from "../components/alertas/AlertasFlutuantes";
import { useAuth } from "../hooks/useAuth";

export default function RootLayout() {
  const { session, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
    } catch {
      setSignOutError("Não foi possível sair. Tente novamente.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="app-shell min-h-screen bg-page md:flex">
      <aside className="border-b border-white/10 bg-secondary text-white md:fixed md:inset-y-0 md:left-0 md:flex md:w-52 md:flex-col md:border-r md:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:block md:px-4 md:py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-base text-white ring-1 ring-inset ring-white/15"
              aria-hidden="true"
            >
              ❄
            </div>
            <h1 className="text-lg font-bold text-white">ColdSense</h1>
          </div>
          <div className="md:mt-8">
            <Navbar />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 md:mt-auto md:block md:py-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/65">Conectado como</p>
            <p className="mt-1 truncate text-sm font-medium" title={session?.user.email}>
              {session?.user.email ?? "Usuário"}
            </p>
          </div>
          <button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60 md:mt-4 md:w-full">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" /></svg>
            {isSigningOut ? "Saindo..." : "Sair"}
          </button>
          {signOutError && <p className="mt-2 w-full text-sm text-red-200" role="alert">{signOutError}</p>}
        </div>
      </aside>

      <div className="app-content flex-1 md:ml-52">
        <main className="mx-auto h-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <AlertasFlutuantes />
    </div>
  );
}
