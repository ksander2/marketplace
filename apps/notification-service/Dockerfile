FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://notifications:notifications@postgres:5432/notifications pnpm --filter @marketplace/notification-service prisma:generate
RUN pnpm --filter @marketplace/notification-service... build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/notification-service
EXPOSE 3005
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]
