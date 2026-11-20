# marketplace

Учебный маркетплейс на микросервисной архитектуре: React, Node.js, PostgreSQL, Redis и RabbitMQ. Архитектурные решения и план этапов находятся в `AGENTS.md`.

## Реализовано

### Этап 1: фундамент

- pnpm workspaces, TypeScript strict, ESLint и Vitest;
- пакеты `contracts`, `common` и `messaging`;
- обёртка RabbitMQ с confirm-публикациями, переподключением и DLQ;
- каркасы backend-сервисов, Prisma и Docker Compose;
- unit-тесты, smoke-тесты и GitHub Actions CI.

### Этап 2: Auth + Gateway

- регистрация и вход по email/паролю с хэшированием паролей bcrypt;
- Ed25519 access JWT на 15 минут и одноразовые refresh-токены на 30 дней;
- SHA-256-хэши refresh-токенов в PostgreSQL, ротация, отзыв и защита от повторного использования;
- локальная проверка JWT в API Gateway, проброс `x-user-id` и `x-user-roles`;
- Redis rate limiting, CORS и проксирование `/api/auth/*`;
- React + TypeScript + Vite, React Router, TanStack Query, React Hook Form и MUI;
- страницы регистрации, входа и профиля, восстановление сессии и выход;
- миграции Prisma и многостадийные Dockerfiles для auth, gateway и web.

### Этап 3: Catalog

- CRUD товаров в catalog-service с Prisma и отдельной PostgreSQL-базой;
- публикация `catalog.product.created`, `updated` и `deleted` в RabbitMQ;
- публичные GET-запросы каталога и защищённые изменения через API Gateway;
- владелец-seller управляет своими товарами, admin — любыми;
- публичные страницы каталога и карточки товара, CRUD-админка для seller/admin;
- демонстрационный seller создаётся идемпотентно при запуске auth-service.

## Требования

- Node.js 22.12 или новее;
- pnpm 10;
- Docker с Docker Compose.

## Проверки

```bash
pnpm install
pnpm prisma:generate
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Запуск в Docker Compose

Команда собирает приложения, применяет миграции и дожидается готовности контейнеров:

```bash
pnpm infra:up
```

Откройте http://localhost:8080. Каталог и карточки товаров доступны без входа. Для управления товарами войдите под демонстрационным продавцом `seller@marketplace.local` / `seller-password-123` и откройте «Управление товарами». Публичная регистрация по-прежнему создаёт только покупателей.

Smoke-проверки:

```bash
pnpm test:event    # RabbitMQ publish → consume
pnpm test:auth     # без токена 401 → регистрация → вход → me → refresh → logout
pnpm test:catalog  # buyer 403 → CRUD seller → публичный каталог → события RabbitMQ
```

Остановить контейнеры с сохранением volumes:

```bash
pnpm infra:down
```

## Локальные интерфейсы

| Компонент | Адрес |
| --- | --- |
| Web | http://localhost:8080 |
| API Gateway | http://localhost:3000 |
| RabbitMQ AMQP | `amqp://marketplace:marketplace@localhost:5673` |
| RabbitMQ Management | http://localhost:15673 (`marketplace` / `marketplace`) |
| Mailhog UI | http://localhost:8025 |
| Mailhog SMTP | `localhost:1025` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

Auth-service и catalog-service не публикуют порты наружу в Compose: браузер и внешние клиенты обращаются только к gateway. Все ключи и учётные данные в репозитории предназначены только для локальной разработки; в другом окружении их необходимо заменить через env.

SQL-скрипт `deploy/compose/postgres/init.sql` выполняется при создании нового PostgreSQL volume. После его изменения существующий volume нужно пересоздать осознанно, с потерей локальных данных.

## Разработка без Docker для Node.js-сервисов

Запустите инфраструктуру, примените миграции Auth и Catalog, затем запустите нужные процессы:

```bash
docker compose -f deploy/compose/docker-compose.yml up -d --wait postgres redis rabbitmq
pnpm exec cross-env DATABASE_URL=postgresql://auth:auth@localhost:5432/auth pnpm --filter @marketplace/auth-service prisma:migrate
pnpm exec cross-env DATABASE_URL=postgresql://catalog:catalog@localhost:5432/catalog pnpm --filter @marketplace/catalog-service prisma:migrate
pnpm exec cross-env SEED_SELLER_EMAIL=seller@marketplace.local SEED_SELLER_PASSWORD=seller-password-123 pnpm --filter @marketplace/auth-service dev
pnpm --filter @marketplace/catalog-service dev
pnpm --filter @marketplace/api-gateway dev
pnpm --filter @marketplace/web dev
```

Vite доступен на http://localhost:5173 и проксирует `/api` на gateway. Порты остальных backend-каркасов: catalog — 3002, cart — 3003, order — 3004, notification — 3005.
