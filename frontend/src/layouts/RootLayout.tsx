import { Outlet } from "react-router";
import Navbar from "../components/Navbar";

export default function RootLayout() {
  return (
    <div>
      <header>
        <h1>ColdSense</h1>
        <Navbar />
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
