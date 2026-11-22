import { AppBar, Badge, Button, Container, Toolbar, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "react-router-dom";
import { listNotifications } from "../api/notifications";
import { useAuth } from "../context/AuthContext";
import { useOrderEvents } from "../hooks/useOrderEvents";

export function AppLayout() {
  const { user, accessToken } = useAuth();
  useOrderEvents();
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const unreadCount = notificationsQuery.data?.filter((notification) => !notification.readAt).length ?? 0;
  const canManage = user?.roles.some((role) => role === "seller" || role === "admin");

  return (
    <>
      <AppBar position="static" color="inherit" elevation={0} className="app-header">
        <Container maxWidth="lg">
          <Toolbar disableGutters>
            <Typography
              component={Link}
              to="/"
              variant="h6"
              color="primary"
              fontWeight={800}
              className="brand"
            >
              MARKETPLACE
            </Typography>
            <nav className="main-nav" aria-label="Основная навигация">
              {user ? <Button component={Link} to="/cart">Корзина</Button> : null}
              {user ? <Button component={Link} to="/orders">Заказы</Button> : null}
              {user ? (
                <Badge badgeContent={unreadCount} color="error">
                  <Button component={Link} to="/notifications">Уведомления</Button>
                </Badge>
              ) : null}
              {canManage ? (
                <Button component={Link} to="/admin/products">Управление товарами</Button>
              ) : null}
              <Button component={Link} to={user ? "/account" : "/login"}>
                {user ? "Личный кабинет" : "Войти"}
              </Button>
            </nav>
          </Toolbar>
        </Container>
      </AppBar>
      <Container maxWidth="lg" component="main" className="page-content">
        <Outlet />
      </Container>
    </>
  );
}
