import { Button, Card, CardActions, CardContent, CardMedia, Chip, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import type { Product } from "@marketplace/contracts/catalog";
import { AddToCartButton } from "./AddToCartButton";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="product-card">
      {product.imageUrl ? (
        <CardMedia component="img" height="190" image={product.imageUrl} alt={product.name} />
      ) : (
        <div className="product-placeholder" aria-hidden="true">{product.name.slice(0, 1)}</div>
      )}
      <CardContent className="product-card-content">
        <Chip label={product.category} size="small" variant="outlined" />
        <Typography variant="h6" component="h2" mt={2}>{product.name}</Typography>
        <Typography color="text.secondary" className="product-description">
          {product.description}
        </Typography>
        <Typography variant="h6" color="primary" fontWeight={700} mt={2}>
          {formatPrice(product.price)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {product.stock > 0 ? `В наличии: ${product.stock}` : "Нет в наличии"}
        </Typography>
      </CardContent>
      <CardActions>
        <Button component={Link} to={`/products/${product.id}`}>Подробнее</Button>
        <AddToCartButton product={product} />
      </CardActions>
    </Card>
  );
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(price);
}
