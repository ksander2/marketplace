import { AppBar, Button, Container, Toolbar, Typography } from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppLayout() {
  const { user } = useAuth();
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
