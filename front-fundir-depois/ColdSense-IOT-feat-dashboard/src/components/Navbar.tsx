import { Link } from "react-router";

export default function Navbar() {
  return (
    <nav>
      <Link to="/" aria-current="page">Dashboard</Link>
    </nav>
  );
}
