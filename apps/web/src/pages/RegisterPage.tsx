import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Paper, TextField, Typography } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { registerRequestSchema, type RegisterRequest } from "@marketplace/contracts/auth";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";

const formSchema = registerRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  });
type RegisterForm = RegisterRequest & { confirmPassword: string };

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const form = useForm<RegisterForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", name: "", password: "", confirmPassword: "" },
  });
  const mutation = useMutation({
    mutationFn: (input: RegisterForm) => register({
      email: input.email,
      name: input.name,
      password: input.password,
    }),
    onSuccess: () => navigate("/"),
  });

  return (
    <main className="auth-layout">
      <Paper className="auth-card" component="section">
        <Typography variant="overline" color="primary">MARKETPLACE</Typography>
        <Typography variant="h4" component="h1" fontWeight={700}>Создайте аккаунт</Typography>
        <Typography color="text.secondary" mt={1}>Покупки, заказы и уведомления в одном месте.</Typography>

        <form
          className="auth-form"
          onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
          noValidate
        >
          <TextField
            label="Имя"
            autoComplete="name"
            {...form.register("name")}
            error={Boolean(form.formState.errors.name)}
            helperText={form.formState.errors.name?.message}
            fullWidth
          />
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
            label="Пароль (минимум 12 символов)"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
            error={Boolean(form.formState.errors.password)}
            helperText={form.formState.errors.password?.message}
            fullWidth
          />
          <TextField
            label="Повторите пароль"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
            error={Boolean(form.formState.errors.confirmPassword)}
            helperText={form.formState.errors.confirmPassword?.message}
            fullWidth
          />
          {mutation.error ? <Alert severity="error">{mutation.error.message}</Alert> : null}
          <Button type="submit" variant="contained" size="large" disabled={mutation.isPending}>
            {mutation.isPending ? "Создаём…" : "Зарегистрироваться"}
          </Button>
        </form>

        <Typography className="auth-switch" color="text.secondary">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </Typography>
      </Paper>
    </main>
  );
}
