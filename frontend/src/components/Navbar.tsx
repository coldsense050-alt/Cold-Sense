import { NavLink } from "react-router";
import Icon from "./ui/Icon";

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

function IconFreezerAI() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
    isActive
      ? "bg-white/10 text-white ring-1 ring-inset ring-white/10 hover:bg-white/15"
      : "text-white/70 hover:bg-white/10 hover:text-white"
  }`;

export default function Navbar() {
  return (
    <nav aria-label="Navegação principal" className="flex flex-wrap gap-1 md:flex-col">
      <NavLink to="/" end className={linkClasses}>
        <IconMain />
        Dashboard
      </NavLink>
      <NavLink to="/freezer-ai" className={linkClasses} title="Relatórios inteligentes da Freezer AI">
        <IconFreezerAI />
        Freezer AI
      </NavLink>
      <NavLink to="/prestadores" className={linkClasses}>
        <Icon name="users" />
        Prestadores
      </NavLink>
    </nav>
  );
}
