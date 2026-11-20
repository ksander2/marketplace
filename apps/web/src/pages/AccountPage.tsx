import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { me } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export function AccountPage() {
  const { user, accessToken, logout } = useAuth();
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const currentUser = query.data ?? user;

  return (
    <main>
      <Paper className="account-card">
        <Typography variant="overline" color="primary">ЛИЧНЫЙ КАБИНЕТ</Typography>
        <Typography variant="h4" component="h1" fontWeight={700} mt={1}>
          {currentUser?.name}
        </Typography>
        <Typography color="text.secondary" mt={1}>{currentUser?.email}</Typography>
        <Stack direction="row" spacing={1} mt={2} mb={4}>
          {currentUser?.roles.map((role) => <Chip key={role} label={role} />)}
        </Stack>

        {query.isError ? <Alert severity="error">Не удалось обновить профиль.</Alert> : null}
        {query.isSuccess ? <Alert severity="success">Access-токен принят API Gateway.</Alert> : null}

        <Button variant="outlined" onClick={() => void logout()}>Выйти</Button>
      </Paper>
    </main>
  );
}
