import { Chip } from "@mui/material";
import type { OrderStatus } from "@marketplace/contracts/order";

const labels: Record<OrderStatus, string> = {
  PENDING: "Обрабатывается",
  CONFIRMED: "Подтверждён",
  CANCELLED: "Отменён",
};

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  return (
    <Chip
      label={labels[status]}
      color={status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "error" : "warning"}
      variant={status === "PENDING" ? "outlined" : "filled"}
    />
  );
}
