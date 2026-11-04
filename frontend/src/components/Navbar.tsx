import { Link } from "react-router";

function IconMain() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav aria-label="Navegação principal">
      <Link
        to="/"
        aria-current="page"
        className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-2.5 text-xs font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15"
      >
        <IconMain />
        Dashboard
      </Link>
    </nav>
  );
}
