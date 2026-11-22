import { Alert, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listNotifications, markNotificationRead } from "../api/notifications";
import { useAuth } from "../context/AuthContext";

export function NotificationsPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const token = accessToken ?? "";
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(token),
    enabled: Boolean(accessToken),
  });
  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <>
      <Typography variant="overline" color="primary">СОБЫТИЯ АККАУНТА</Typography>
      <Typography variant="h3" component="h1" fontWeight={800} mb={3}>Уведомления</Typography>
      {query.isPending ? <div className="centered"><CircularProgress /></div> : null}
      {query.isError ? <Alert severity="error">{query.error.message}</Alert> : null}
      {readMutation.isError ? <Alert severity="error" sx={{ mb: 2 }}>{readMutation.error.message}</Alert> : null}
      {query.data?.length === 0 ? <Alert severity="info">Уведомлений пока нет.</Alert> : null}
      <Stack spacing={2}>
        {query.data?.map((notification) => (
          <Paper key={notification.id} className={`notification-card ${notification.readAt ? "read" : ""}`}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
              <div>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Typography variant="h6" fontWeight={700}>{notification.title}</Typography>
                  {!notification.readAt ? <Chip size="small" color="primary" label="Новое" /> : null}
                </Stack>
                <Typography>{notification.message}</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  {new Date(notification.createdAt).toLocaleString("ru-RU")}
                  {notification.emailSentAt ? " · Email отправлен" : ""}
                </Typography>
              </div>
              <Stack spacing={1} alignItems="flex-end">
                {notification.orderId ? (
                  <Button component={Link} to={`/orders/${notification.orderId}`}>Открыть заказ</Button>
                ) : null}
                {!notification.readAt ? (
                  <Button
                    disabled={readMutation.isPending}
                    onClick={() => readMutation.mutate(notification.id)}
                  >
                    Прочитано
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </>
  );
}
