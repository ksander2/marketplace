FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://auth:auth@postgres:5432/auth pnpm --filter @marketplace/auth-service prisma:generate
RUN pnpm --filter @marketplace/auth-service... build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/auth-service
EXPOSE 3001
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]
