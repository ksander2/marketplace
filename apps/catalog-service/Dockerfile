FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://catalog:catalog@postgres:5432/catalog pnpm --filter @marketplace/catalog-service prisma:generate
RUN pnpm --filter @marketplace/catalog-service... build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/catalog-service
EXPOSE 3002
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]
