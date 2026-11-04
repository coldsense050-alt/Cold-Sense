import { Outlet } from "react-router";
import Navbar from "../components/Navbar";

export default function RootLayout() {
  return (
    <div className="app-shell min-h-screen bg-page md:flex">
      <aside className="border-b border-white/10 bg-secondary text-white md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 md:block md:px-6 md:py-6">
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
      </aside>

      <div className="app-content flex-1 md:ml-64">
        <main className="mx-auto h-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
