import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createProductRequestSchema,
  type CreateProductRequest,
  type Product,
} from "@marketplace/contracts/catalog";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../api/catalog";
import { useAuth } from "../context/AuthContext";
import { formatPrice } from "../components/ProductCard";

const productFormSchema = createProductRequestSchema.extend({
  imageUrl: z.string().max(2048).optional().refine(
    (value) => !value || z.url().safeParse(value).success,
    { message: "Invalid URL" },
  ),
});

export function AdminProductsPage() {
  const { user, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const isAdmin = user?.roles.includes("admin") ?? false;
  const sellerId = isAdmin ? undefined : user?.id;
  const query = useQuery({
    queryKey: ["products", "manage", sellerId],
    queryFn: () => listProducts(sellerId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["cart"] }),
    ]);
  };
  const createMutation = useMutation({
    mutationFn: (input: CreateProductRequest) => createProduct(input, accessToken ?? ""),
    onSuccess: async () => {
      setIsCreating(false);
      await refresh();
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: CreateProductRequest) => {
      if (!edited) throw new Error("Товар не выбран");
      return updateProduct(edited.id, input, accessToken ?? "");
    },
    onSuccess: async () => {
      setEdited(null);
      await refresh();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id, accessToken ?? ""),
    onSuccess: refresh,
  });
  const error = createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  return (
    <>
      <div className="admin-heading">
        <div>
          <Typography variant="overline" color="primary">ПАНЕЛЬ ПРОДАВЦА</Typography>
          <Typography variant="h3" component="h1" fontWeight={800}>Товары</Typography>
        </div>
        <Button variant="contained" onClick={() => setIsCreating(true)}>Добавить товар</Button>
      </div>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert> : null}
      {query.isError ? <Alert severity="error">{query.error.message}</Alert> : null}
      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Категория</TableCell>
              <TableCell>Цена</TableCell>
              <TableCell>Остаток</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.data?.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>{formatPrice(product.price)}</TableCell>
                <TableCell>{product.stock}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEdited(product)}>Изменить</Button>
                  <Button
                    size="small"
                    color="error"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Удалить «${product.name}»?`)) {
                        deleteMutation.mutate(product.id);
                      }
                    }}
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {query.isSuccess && query.data.length === 0 ? (
          <Typography color="text.secondary" p={3}>У вас пока нет товаров.</Typography>
        ) : null}
      </TableContainer>

      <ProductDialog
        open={isCreating}
        title="Новый товар"
        isPending={createMutation.isPending}
        onClose={() => setIsCreating(false)}
        onSubmit={(input) => createMutation.mutate(input)}
      />
      <ProductDialog
        key={edited?.id ?? "closed"}
        open={Boolean(edited)}
        product={edited}
        title="Изменение товара"
        isPending={updateMutation.isPending}
        onClose={() => setEdited(null)}
        onSubmit={(input) => updateMutation.mutate(input)}
      />
    </>
  );
}

interface ProductDialogProps {
  open: boolean;
  product?: Product | null;
  title: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: CreateProductRequest) => void;
}

function ProductDialog({ open, product, title, isPending, onClose, onSubmit }: ProductDialogProps) {
  const form = useForm<CreateProductRequest>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      category: product?.category ?? "",
      price: product?.price ?? 0,
      stock: product?.stock ?? 0,
      imageUrl: product?.imageUrl ?? "",
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box
        component="form"
        onSubmit={form.handleSubmit(({ imageUrl, ...input }) => onSubmit({
          ...input,
          ...(imageUrl ? { imageUrl } : {}),
        }))}
        noValidate
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <div className="product-form">
            <Field form={form} name="name" label="Название" />
            <Field form={form} name="category" label="Категория" />
            <Field form={form} name="description" label="Описание" multiline rows={4} />
            <Field form={form} name="price" label="Цена, ₽" type="number" />
            <Field form={form} name="stock" label="Количество" type="number" />
            <Field form={form} name="imageUrl" label="Ссылка на изображение (необязательно)" type="url" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="contained" disabled={isPending}>
            {isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

interface FieldProps {
  form: ReturnType<typeof useForm<CreateProductRequest>>;
  name: keyof CreateProductRequest;
  label: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
}

function Field({ form, name, label, type = "text", multiline, rows }: FieldProps) {
  return (
    <TextField
      label={label}
      type={type}
      multiline={multiline}
      rows={rows}
      {...form.register(name, {
        valueAsNumber: name === "price" || name === "stock",
      })}
      error={Boolean(form.formState.errors[name])}
      helperText={form.formState.errors[name]?.message}
      fullWidth
    />
  );
}
