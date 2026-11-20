import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Paper, TextField, Typography } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { loginRequestSchema, type LoginRequest } from "@marketplace/contracts/auth";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate("/"),
  });

  return (
    <main className="auth-layout">
      <Paper className="auth-card" component="section">
        <Typography variant="overline" color="primary">MARKETPLACE</Typography>
        <Typography variant="h4" component="h1" fontWeight={700}>С возвращением</Typography>
        <Typography color="text.secondary" mt={1}>Войдите, чтобы продолжить покупки.</Typography>

        <form
          className="auth-form"
          onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
          noValidate
        >
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            {...form.register("email")}
            error={Boolean(form.formState.errors.email)}
            helperText={form.formState.errors.email?.message}
            fullWidth
          />
          <TextField
            label="Пароль"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
            error={Boolean(form.formState.errors.password)}
            helperText={form.formState.errors.password?.message}
            fullWidth
          />
          {mutation.error ? <Alert severity="error">{mutation.error.message}</Alert> : null}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Входим…" : "Войти"}
          </Button>
        </form>

        <Typography className="auth-switch" color="text.secondary">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </Typography>
      </Paper>
    </main>
  );
}
