# marketplace

Учебный маркетплейс на микросервисной архитектуре: React, Node.js, PostgreSQL, Redis и RabbitMQ. Архитектурные решения и план этапов находятся в `AGENTS.md.md`.

## Этап 1: фундамент

В репозитории настроены pnpm workspaces и TypeScript strict, добавлены:

- `packages/contracts` — версионированный конверт событий и zod-схемы;
- `packages/common` — конфигурация, ошибки и pino-логирование;
- `packages/messaging` — обёртка над amqplib с confirm-публикациями, переподключением и DLQ;
- каркасы API Gateway и пяти доменных сервисов с `/health/live`, `/health/ready` и graceful shutdown;
- Prisma для сервисов с PostgreSQL и отдельные базы для них;
- Docker Compose с PostgreSQL, Redis, RabbitMQ и Mailhog;
- unit-тесты, smoke-тест `publish → consume` и GitHub Actions CI.

## Требования

- Node.js 22.12 или новее;
- pnpm 10;
- Docker с Docker Compose.

## Запуск и проверка

```bash
pnpm install
pnpm prisma:generate
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Запустить инфраструктуру и дождаться готовности контейнеров:

```bash
pnpm infra:up
```

Проверить прохождение тестового события через RabbitMQ:

```bash
pnpm test:event
```

Остановить инфраструктуру:

```bash
pnpm infra:down
```

Локальные интерфейсы и подключения:

| Компонент | Адрес |
| --- | --- |
| RabbitMQ AMQP | `amqp://marketplace:marketplace@localhost:5673` |
| RabbitMQ Management | http://localhost:15673 (`marketplace` / `marketplace`) |
| Mailhog UI | http://localhost:8025 |
| Mailhog SMTP | `localhost:1025` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

Все учётные данные в Compose предназначены только для локальной разработки. SQL-скрипт `deploy/compose/postgres/init.sql` выполняется при создании нового PostgreSQL volume; после его изменения существующий volume нужно пересоздать осознанно, с потерей локальных данных.

## Запуск каркаса сервиса

Например:

```bash
pnpm --filter @marketplace/auth-service dev
```

Порты по умолчанию: gateway — 3000, auth — 3001, catalog — 3002, cart — 3003, order — 3004, notification — 3005.
