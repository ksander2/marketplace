import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function SellerRoute() {
  const { user } = useAuth();
  const allowed = user?.roles.some((role) => role === "seller" || role === "admin");
  return allowed ? <Outlet /> : <Navigate to="/" replace />;
}
