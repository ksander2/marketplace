import { Button, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Product } from "@marketplace/contracts/catalog";
import { addCartItem } from "../api/cart";
import { useAuth } from "../context/AuthContext";

interface AddToCartButtonProps {
  product: Product;
  fullWidth?: boolean;
}

export function AddToCartButton({ product, fullWidth = false }: AddToCartButtonProps) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => addCartItem({ productId: product.id, quantity: 1 }, accessToken ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  return (
    <>
      <Button
        variant="contained"
        fullWidth={fullWidth}
        disabled={product.stock === 0 || mutation.isPending}
        onClick={() => {
          if (!accessToken) {
            navigate("/login");
            return;
          }
          mutation.mutate();
        }}
      >
        {mutation.isPending ? "Добавляем…" : mutation.isSuccess ? "Добавить ещё" : "В корзину"}
      </Button>
      {mutation.error ? <Typography color="error" variant="caption">{mutation.error.message}</Typography> : null}
    </>
  );
}
