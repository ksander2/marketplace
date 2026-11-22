import { Alert, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listOrders } from "../api/orders";
import { OrderStatusChip } from "../components/OrderStatusChip";
import { formatPrice } from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";

export function OrdersPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  return (
    <>
      <Typography variant="overline" color="primary">ИСТОРИЯ ПОКУПОК</Typography>
      <Typography variant="h3" component="h1" fontWeight={800} mb={3}>Мои заказы</Typography>
      {query.isPending ? <div className="centered"><CircularProgress /></div> : null}
      {query.isError ? <Alert severity="error">{query.error.message}</Alert> : null}
      {query.data?.length === 0 ? <Alert severity="info">У вас пока нет заказов.</Alert> : null}
      <Stack spacing={2}>
        {query.data?.map((order) => (
          <Paper key={order.id} className="order-card">
            <div>
              <Typography variant="overline">Заказ {order.id.slice(0, 8)}</Typography>
              <Typography color="text.secondary">
                {new Date(order.createdAt).toLocaleString("ru-RU")}
              </Typography>
            </div>
            <OrderStatusChip status={order.status} />
            <Typography variant="h6" fontWeight={700}>{formatPrice(order.total)}</Typography>
            <Button component={Link} to={`/orders/${order.id}`}>Подробнее</Button>
          </Paper>
        ))}
      </Stack>
    </>
  );
}
