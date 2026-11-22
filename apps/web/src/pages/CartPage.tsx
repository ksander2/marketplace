import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { clearCart, getCart, removeCartItem, setCartItemQuantity } from "../api/cart";
import { createOrder } from "../api/orders";
import { formatPrice } from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";

export function CartPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = accessToken ?? "";
  const query = useQuery({
    queryKey: ["cart"],
    queryFn: () => getCart(token),
    enabled: Boolean(accessToken),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
  };
  const updateMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      setCartItemQuantity(productId, { quantity }, token),
    onSuccess: (cart) => queryClient.setQueryData(["cart"], cart),
  });
  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeCartItem(productId, token),
    onSuccess: refresh,
  });
  const clearMutation = useMutation({ mutationFn: () => clearCart(token), onSuccess: refresh });
  const checkoutMutation = useMutation({
    mutationFn: () => createOrder({
      items: cart?.items.map((item) => ({ productId: item.product.id, quantity: item.quantity })) ?? [],
    }, token),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      navigate(`/orders/${order.id}`);
    },
  });
  const error = updateMutation.error ?? removeMutation.error ?? clearMutation.error ?? checkoutMutation.error;
  const cart = query.data;

  return (
    <>
      <Typography variant="overline" color="primary">ВАШИ ПОКУПКИ</Typography>
      <Typography variant="h3" component="h1" fontWeight={800} mb={3}>Корзина</Typography>
      {query.isPending ? <div className="centered"><CircularProgress /></div> : null}
      {query.isError ? <Alert severity="error">{query.error.message}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert> : null}
      {cart?.items.length === 0 ? <Alert severity="info">Корзина пока пуста.</Alert> : null}
      {cart && cart.items.length > 0 ? (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Товар</TableCell>
                  <TableCell>Цена</TableCell>
                  <TableCell>Количество</TableCell>
                  <TableCell>Сумма</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.items.map((item) => (
                  <TableRow key={item.product.id}>
                    <TableCell>
                      <Link to={`/products/${item.product.id}`}>{item.product.name}</Link>
                    </TableCell>
                    <TableCell>{formatPrice(item.product.price)}</TableCell>
                    <TableCell>
                      <div className="quantity-control">
                        <Button
                          size="small"
                          variant="outlined"
                          aria-label={`Уменьшить количество ${item.product.name}`}
                          disabled={item.quantity <= 1 || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({
                            productId: item.product.id,
                            quantity: item.quantity - 1,
                          })}
                        >
                          −
                        </Button>
                        <Typography minWidth={28} textAlign="center">{item.quantity}</Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          aria-label={`Увеличить количество ${item.product.name}`}
                          disabled={item.quantity >= item.product.stock || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({
                            productId: item.product.id,
                            quantity: item.quantity + 1,
                          })}
                        >
                          +
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{formatPrice(item.lineTotal)}</TableCell>
                    <TableCell align="right">
                      <Button
                        color="error"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(item.product.id)}
                      >
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <div className="cart-summary">
            <Button
              color="error"
              disabled={clearMutation.isPending}
              onClick={() => clearMutation.mutate()}
            >
              Очистить корзину
            </Button>
            <Typography variant="h5" fontWeight={700}>Итого: {formatPrice(cart.total)}</Typography>
            <Button
              variant="contained"
              size="large"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
            >
              {checkoutMutation.isPending ? "Оформляем…" : "Оформить заказ"}
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
