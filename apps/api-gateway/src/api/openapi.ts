import { z } from "zod";
import {
  authResponseSchema,
  authUserSchema,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  userRoleSchema,
} from "@marketplace/contracts/auth";
import {
  createProductRequestSchema,
  productSchema,
  updateProductRequestSchema,
} from "@marketplace/contracts/catalog";
import {
  addCartItemRequestSchema,
  cartItemSchema,
  cartSchema,
  updateCartItemRequestSchema,
} from "@marketplace/contracts/cart";
import {
  createOrderRequestSchema,
  orderItemSchema,
  orderSchema,
  orderStatusSchema,
} from "@marketplace/contracts/order";
import { notificationSchema, notificationTypeSchema } from "@marketplace/contracts/notification";

const exampleUuid = "018f3f2e-7d2f-7d5f-b1a4-5f0e8c6a2b10";
const secured = [{ bearerAuth: [] }];

const errorResponseDescriptions = {
  400: "Некорректные параметры или тело запроса",
  401: "Требуется аутентификация или передан недействительный токен",
  403: "Недостаточно прав для выполнения операции",
  404: "Ресурс не найден",
  409: "Конфликт с текущим состоянием ресурса",
  429: "Превышен лимит запросов API Gateway",
  502: "Внутренний сервис недоступен",
  503: "API Gateway или Redis временно недоступен",
} as const;

type ErrorStatus = keyof typeof errorResponseDescriptions;
type JsonSchema = Record<string, unknown>;

function jsonSchema(schema: z.ZodType, io: "input" | "output" = "input"): JsonSchema {
  const result = z.toJSONSchema(schema, { io, unrepresentable: "any" }) as JsonSchema;
  delete result.$schema;
  return result;
}

function schemaRef(name: string): { $ref: string } {
  return { $ref: `#/components/schemas/${name}` };
}

function errorRef(status: ErrorStatus): { $ref: string } {
  return { $ref: `#/components/responses/Error${status}` };
}

function errors(...statuses: ErrorStatus[]): Record<string, { $ref: string }> {
  return Object.fromEntries(statuses.map((status) => [status, errorRef(status)]));
}

function jsonResponse(description: string, schemaName: string): Record<string, unknown> {
  return {
    description,
    content: { "application/json": { schema: schemaRef(schemaName) } },
  };
}

function arrayResponse(description: string, schemaName: string): Record<string, unknown> {
  return {
    description,
    content: {
      "application/json": { schema: { type: "array", items: schemaRef(schemaName) } },
    },
  };
}

function requestBody(schemaName: string, example: unknown): Record<string, unknown> {
  return {
    required: true,
    content: { "application/json": { schema: schemaRef(schemaName), example } },
  };
}

function uuidParameter(name: string, description: string): Record<string, unknown> {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string", format: "uuid" },
  };
}

const correlationIdParameter = { $ref: "#/components/parameters/CorrelationId" };

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Marketplace API",
    version: "0.1.0",
    description: [
      "Внешний REST API маркетплейса. Все запросы проходят через API Gateway.",
      "Для защищённых операций войдите через `/api/auth/login`, нажмите **Authorize** и укажите только `accessToken` — префикс `Bearer` Swagger UI добавит автоматически.",
      "Создание заказа асинхронно: ответ `202` содержит заказ в статусе `PENDING`, а итог приходит через SSE или доступен при повторном GET-запросе.",
    ].join("\n\n"),
  },
  servers: [{ url: "/", description: "Текущий API Gateway" }],
  tags: [
    { name: "Auth", description: "Регистрация, вход, токены и текущий пользователь" },
    { name: "Catalog", description: "Публичный каталог и управление товарами" },
    { name: "Cart", description: "Корзина текущего пользователя" },
    { name: "Orders", description: "Создание и просмотр заказов" },
    { name: "Notifications", description: "In-app уведомления пользователя" },
    { name: "Events", description: "Server-Sent Events для статусов заказов" },
    { name: "Health", description: "Проверки работоспособности API Gateway" },
  ],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Зарегистрировать покупателя",
        parameters: [correlationIdParameter],
        requestBody: requestBody("RegisterRequest", {
          email: "buyer@example.com",
          name: "Marketplace Buyer",
          password: "very-secure-password",
        }),
        responses: {
          201: jsonResponse("Пользователь создан, выдана пара токенов", "AuthResponse"),
          ...errors(400, 409, 429, 502),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Войти по email и паролю",
        requestBody: requestBody("LoginRequest", {
          email: "seller@marketplace.local",
          password: "seller-password-123",
        }),
        responses: {
          200: jsonResponse("Вход выполнен, выдана пара токенов", "AuthResponse"),
          ...errors(400, 401, 429, 502),
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Обновить пару токенов",
        description: "Refresh-токен одноразовый: после успешного запроса прежняя пара отзывается.",
        requestBody: requestBody("RefreshRequest", {
          refreshToken: "replace-with-a-valid-refresh-token-1234567890",
        }),
        responses: {
          200: jsonResponse("Новая пара токенов", "AuthResponse"),
          ...errors(400, 401, 429, 502),
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Отозвать refresh-токен",
        requestBody: requestBody("RefreshRequest", {
          refreshToken: "replace-with-a-valid-refresh-token-1234567890",
        }),
        responses: {
          204: { description: "Выход выполнен" },
          ...errors(400, 429, 502),
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Получить текущего пользователя",
        security: secured,
        responses: {
          200: jsonResponse("Профиль текущего пользователя", "AuthUser"),
          ...errors(401, 404, 429, 502),
        },
      },
    },
    "/api/products": {
      get: {
        tags: ["Catalog"],
        summary: "Получить список товаров",
        parameters: [{
          name: "sellerId",
          in: "query",
          required: false,
          description: "Отфильтровать товары по UUID продавца",
          schema: { type: "string", format: "uuid" },
        }],
        responses: {
          200: arrayResponse("Список товаров", "Product"),
          ...errors(400, 429, 502),
        },
      },
      post: {
        tags: ["Catalog"],
        summary: "Создать товар",
        description: "Доступно ролям `seller` и `admin`.",
        security: secured,
        parameters: [correlationIdParameter],
        requestBody: requestBody("CreateProductRequest", {
          name: "Новый товар",
          description: "Подробное описание нового товара",
          category: "Электроника",
          price: 19990,
          stock: 10,
          imageUrl: "https://example.com/product.jpg",
        }),
        responses: {
          201: jsonResponse("Товар создан", "Product"),
          ...errors(400, 401, 403, 429, 502),
        },
      },
    },
    "/api/products/{id}": {
      get: {
        tags: ["Catalog"],
        summary: "Получить товар",
        parameters: [uuidParameter("id", "UUID товара")],
        responses: {
          200: jsonResponse("Данные товара", "Product"),
          ...errors(400, 404, 429, 502),
        },
      },
      put: {
        tags: ["Catalog"],
        summary: "Изменить товар",
        description: "Seller может менять только свои товары, admin — любые. Нужно передать хотя бы одно поле.",
        security: secured,
        parameters: [uuidParameter("id", "UUID товара"), correlationIdParameter],
        requestBody: requestBody("UpdateProductRequest", { price: 17990, stock: 8 }),
        responses: {
          200: jsonResponse("Товар обновлён", "Product"),
          ...errors(400, 401, 403, 404, 429, 502),
        },
      },
      delete: {
        tags: ["Catalog"],
        summary: "Удалить товар",
        description: "Seller может удалять только свои товары, admin — любые.",
        security: secured,
        parameters: [uuidParameter("id", "UUID товара"), correlationIdParameter],
        responses: {
          204: { description: "Товар удалён" },
          ...errors(400, 401, 403, 404, 429, 502),
        },
      },
    },
    "/api/cart": {
      get: {
        tags: ["Cart"],
        summary: "Получить корзину",
        security: secured,
        responses: {
          200: jsonResponse("Корзина текущего пользователя", "Cart"),
          ...errors(401, 429, 502),
        },
      },
      delete: {
        tags: ["Cart"],
        summary: "Очистить корзину",
        security: secured,
        responses: {
          204: { description: "Корзина очищена" },
          ...errors(401, 429, 502),
        },
      },
    },
    "/api/cart/items": {
      post: {
        tags: ["Cart"],
        summary: "Добавить товар в корзину",
        security: secured,
        requestBody: requestBody("AddCartItemRequest", { productId: exampleUuid, quantity: 1 }),
        responses: {
          200: jsonResponse("Обновлённая корзина", "Cart"),
          ...errors(400, 401, 404, 409, 429, 502),
        },
      },
    },
    "/api/cart/items/{productId}": {
      put: {
        tags: ["Cart"],
        summary: "Изменить количество товара",
        security: secured,
        parameters: [uuidParameter("productId", "UUID товара")],
        requestBody: requestBody("UpdateCartItemRequest", { quantity: 2 }),
        responses: {
          200: jsonResponse("Обновлённая корзина", "Cart"),
          ...errors(400, 401, 404, 409, 429, 502),
        },
      },
      delete: {
        tags: ["Cart"],
        summary: "Удалить товар из корзины",
        security: secured,
        parameters: [uuidParameter("productId", "UUID товара")],
        responses: {
          204: { description: "Товар удалён из корзины" },
          ...errors(400, 401, 429, 502),
        },
      },
    },
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "Получить свои заказы",
        security: secured,
        responses: {
          200: arrayResponse("Заказы текущего пользователя", "Order"),
          ...errors(401, 429, 502),
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Создать заказ",
        description: "Создаёт заказ `PENDING` и запускает асинхронное резервирование остатков.",
        security: secured,
        parameters: [correlationIdParameter],
        requestBody: requestBody("CreateOrderRequest", {
          items: [{ productId: exampleUuid, quantity: 1 }],
        }),
        responses: {
          202: jsonResponse("Заказ принят в обработку", "Order"),
          ...errors(400, 401, 404, 429, 502),
        },
      },
    },
    "/api/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Получить заказ",
        description: "Покупатель видит только свои заказы, admin — любые.",
        security: secured,
        parameters: [uuidParameter("id", "UUID заказа")],
        responses: {
          200: jsonResponse("Данные заказа", "Order"),
          ...errors(400, 401, 403, 404, 429, 502),
        },
      },
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Получить свои уведомления",
        security: secured,
        responses: {
          200: arrayResponse("Уведомления текущего пользователя", "Notification"),
          ...errors(401, 429, 502),
        },
      },
    },
    "/api/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Отметить уведомление прочитанным",
        security: secured,
        parameters: [uuidParameter("id", "UUID уведомления")],
        responses: {
          200: jsonResponse("Обновлённое уведомление", "Notification"),
          ...errors(400, 401, 404, 429, 502),
        },
      },
    },
    "/api/events/orders": {
      get: {
        tags: ["Events"],
        summary: "Подписаться на события своих заказов",
        description: "SSE-поток событий `order.order.created`, `confirmed` и `cancelled`. Heartbeat отправляется каждые 15 секунд, клиенту рекомендуется переподключение через 3 секунды.",
        security: secured,
        responses: {
          200: {
            description: "Поток Server-Sent Events",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
                example: `id: ${exampleUuid}\nevent: order.order.confirmed\ndata: {"eventId":"${exampleUuid}","type":"order.order.confirmed"}\n\n`,
              },
            },
          },
          ...errors(401, 429),
        },
      },
    },
    "/health/live": {
      get: {
        tags: ["Health"],
        summary: "Проверить, что процесс запущен",
        responses: { 200: jsonResponse("Процесс работает", "HealthResponse") },
      },
    },
    "/health/ready": {
      get: {
        tags: ["Health"],
        summary: "Проверить готовность API Gateway",
        responses: {
          200: jsonResponse("API Gateway готов принимать запросы", "HealthResponse"),
          503: jsonResponse("API Gateway не готов", "HealthResponse"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access JWT, выданный `/api/auth/login` или `/api/auth/register`",
      },
    },
    parameters: {
      CorrelationId: {
        name: "x-correlation-id",
        in: "header",
        required: false,
        description: "UUID для сквозной трассировки запроса и событий",
        schema: { type: "string", format: "uuid" },
      },
    },
    responses: Object.fromEntries(
      Object.entries(errorResponseDescriptions).map(([status, description]) => [
        `Error${status}`,
        jsonResponse(description, "Error"),
      ]),
    ),
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Request validation failed" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok", "unavailable"] },
          service: { type: "string", example: "api-gateway" },
        },
        required: ["status"],
      },
      UserRole: jsonSchema(userRoleSchema),
      AuthUser: jsonSchema(authUserSchema, "output"),
      RegisterRequest: jsonSchema(registerRequestSchema),
      LoginRequest: jsonSchema(loginRequestSchema),
      RefreshRequest: jsonSchema(refreshRequestSchema),
      AuthResponse: jsonSchema(authResponseSchema, "output"),
      CreateProductRequest: jsonSchema(createProductRequestSchema),
      UpdateProductRequest: {
        ...jsonSchema(updateProductRequestSchema),
        description: "Набор изменяемых полей; хотя бы одно поле обязательно",
      },
      Product: jsonSchema(productSchema, "output"),
      AddCartItemRequest: jsonSchema(addCartItemRequestSchema),
      UpdateCartItemRequest: jsonSchema(updateCartItemRequestSchema),
      CartItem: jsonSchema(cartItemSchema, "output"),
      Cart: jsonSchema(cartSchema, "output"),
      OrderStatus: jsonSchema(orderStatusSchema, "output"),
      OrderItem: jsonSchema(orderItemSchema, "output"),
      Order: jsonSchema(orderSchema, "output"),
      CreateOrderRequest: jsonSchema(createOrderRequestSchema),
      NotificationType: jsonSchema(notificationTypeSchema, "output"),
      Notification: jsonSchema(notificationSchema, "output"),
    },
  },
};
