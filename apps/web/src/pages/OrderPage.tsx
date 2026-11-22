import { Alert, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getOrder } from "../api/orders";
import { OrderStatusChip } from "../components/OrderStatusChip";
import { formatPrice } from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";

export function OrderPage() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ["orders", id],
    queryFn: () => getOrder(id, accessToken ?? ""),
    enabled: Boolean(accessToken && id),
  });
  const order = query.data;

  return (
    <>
      <Button component={Link} to="/orders" sx={{ mb: 3 }}>← Мои заказы</Button>
      {query.isPending ? <div className="centered"><CircularProgress /></div> : null}
      {query.isError ? <Alert severity="error">{query.error.message}</Alert> : null}
      {order ? (
        <Paper className="order-details">
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            <div>
              <Typography variant="overline">Заказ {order.id}</Typography>
              <Typography variant="h4" component="h1" fontWeight={800}>Детали заказа</Typography>
            </div>
            <OrderStatusChip status={order.status} />
          </Stack>
          {order.status === "PENDING" ? (
            <Alert severity="info" sx={{ mt: 3 }}>Проверяем наличие товаров и резервируем остатки.</Alert>
          ) : null}
          {order.cancelReason ? <Alert severity="error" sx={{ mt: 3 }}>{order.cancelReason}</Alert> : null}
          <Stack spacing={2} mt={4}>
            {order.items.map((item) => (
              <div className="order-line" key={item.productId}>
                <div>
                  <Typography fontWeight={600}>{item.name}</Typography>
                  <Typography color="text.secondary">
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </Typography>
                </div>
                <Typography fontWeight={700}>{formatPrice(item.lineTotal)}</Typography>
              </div>
            ))}
          </Stack>
          <Typography variant="h5" fontWeight={800} mt={4} textAlign="right">
            Итого: {formatPrice(order.total)}
          </Typography>
        </Paper>
      ) : null}
    </>
  );
}
