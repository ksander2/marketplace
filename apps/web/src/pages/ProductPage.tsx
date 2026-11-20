import { Alert, Button, Chip, CircularProgress, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getProduct } from "../api/catalog";
import { formatPrice } from "../components/ProductCard";

export function ProductPage() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: ["products", id], queryFn: () => getProduct(id) });
  const product = query.data;

  return (
    <>
      <Button component={Link} to="/" sx={{ mb: 3 }}>← Назад в каталог</Button>
      {query.isPending ? <div className="centered"><CircularProgress /></div> : null}
      {query.isError ? <Alert severity="error">{query.error.message}</Alert> : null}
      {product ? (
        <Paper className="product-details">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : null}
          <div>
            <Chip label={product.category} variant="outlined" />
            <Typography variant="h3" component="h1" fontWeight={800} mt={2}>{product.name}</Typography>
            <Typography color="text.secondary" mt={3} className="product-details-description">
              {product.description}
            </Typography>
            <Typography variant="h4" color="primary" fontWeight={700} mt={4}>
              {formatPrice(product.price)}
            </Typography>
            <Typography color="text.secondary" mt={1}>
              {product.stock > 0 ? `В наличии: ${product.stock}` : "Нет в наличии"}
            </Typography>
          </div>
        </Paper>
      ) : null}
    </>
  );
}
