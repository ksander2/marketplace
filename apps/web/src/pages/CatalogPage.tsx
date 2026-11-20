import { Alert, CircularProgress, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "../api/catalog";
import { ProductCard } from "../components/ProductCard";

export function CatalogPage() {
  const query = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  return (
    <>
      <Typography variant="overline" color="primary">ВСЁ ДЛЯ ВАШИХ ПОКУПОК</Typography>
      <Typography variant="h3" component="h1" fontWeight={800} mt={1}>Каталог товаров</Typography>
      <Typography color="text.secondary" mt={1} mb={4}>
        Выбирайте товары и узнавайте актуальные цены и остатки.
      </Typography>

      {query.isPending ? <div className="centered"><CircularProgress /></div> : null}
      {query.isError ? <Alert severity="error">{query.error.message}</Alert> : null}
      {query.isSuccess && query.data.length === 0 ? (
        <Alert severity="info">Товары пока не добавлены.</Alert>
      ) : null}
      <div className="product-grid">
        {query.data?.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </>
  );
}
