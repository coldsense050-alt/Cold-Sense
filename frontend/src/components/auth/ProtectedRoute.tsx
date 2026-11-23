import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import AuthLoading from "./AuthLoading";

export default function ProtectedRoute() {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;

  if (!session) {
    const from = `${location.pathname}${location.search}${location.hash}`;

    return (
      <Navigate to="/login" replace state={{ from }} />
    );
  }

  return <Outlet />;
}
