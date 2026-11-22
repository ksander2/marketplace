import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SellerRoute } from "./components/SellerRoute";
import { useAuth } from "./context/AuthContext";
import { AccountPage } from "./pages/AccountPage";
import { AdminProductsPage } from "./pages/AdminProductsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CartPage } from "./pages/CartPage";
import { LoginPage } from "./pages/LoginPage";
import { ProductPage } from "./pages/ProductPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderPage } from "./pages/OrderPage";
import { RegisterPage } from "./pages/RegisterPage";
import { NotificationsPage } from "./pages/NotificationsPage";

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/account" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/account" replace /> : <RegisterPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<CatalogPage />} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route element={<SellerRoute />}>
            <Route path="/admin/products" element={<AdminProductsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
