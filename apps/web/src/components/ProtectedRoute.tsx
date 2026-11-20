import { CircularProgress } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <main className="centered">
        <CircularProgress aria-label="Восстановление сессии" />
      </main>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
