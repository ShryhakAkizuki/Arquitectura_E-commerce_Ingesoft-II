# Documentación de la API

**Base URL:** `http://localhost:8080/api`
**Formato:** JSON (UTF-8) · **Autenticación:** `Authorization: Bearer <token>`
**Swagger UI (interactivo):** <http://localhost:8080/swagger-ui.html>

## Índice

1. [Autenticación](#1-autenticación)
2. [Formato de respuesta de error](#2-formato-de-respuesta-de-error)
3. [Códigos de negocio](#3-códigos-de-negocio)
4. [Endpoints implementados](#4-endpoints-implementados)
   - [4.1 Auth](#41-auth)
   - [4.2 Users](#42-users)
   - [4.3 Products (catálogo público)](#43-products-catálogo-público)
   - [4.4 Products (gestión admin)](#44-products-gestión-admin)
   - [4.5 Cart (carrito de compras)](#45-cart-carrito-de-compras)
   - [4.6 Checkout (compra con pago simulado)](#46-checkout-compra-con-pago-simulado)
   - [4.7 Orders (consultas del usuario)](#47-orders-consultas-del-usuario)
   - [4.8 Orders (gestión admin)](#48-orders-gestión-admin)
5. [Referencias](#5-referencias)

---

## 1. Autenticación

| Endpoint | Método | Acceso | Descripción |
|----------|--------|--------|-------------|
| `POST /api/auth/register` | POST | Público | Crea una cuenta (rol `USER` siempre) |
| `POST /api/auth/login` | POST | Público | Emite el JWT (2 h de vida) + perfil del usuario |
| `GET /api/users/me` | GET | JWT | Perfil del usuario autenticado |
| `PUT /api/users/me` | PUT | JWT | Actualiza nombre, email y/o contraseña |

Flujo típico:

```bash
# 1) Iniciar sesión (credenciales del seed V2__seed.sql)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@demo.com", "password": "User123!"}'

# 2) Usar el token en cada petición autenticada
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer <token>"
```

Comportamiento del filtro JWT
([`JwtAuthFilter.java`](../backend/src/main/java/com/ingesoft/shop/security/JwtAuthFilter.java)):

- **Token ausente** → la petición continúa sin autenticar; si la ruta es
  protegida, Spring Security responde **401** `UNAUTHORIZED`.
- **Token inválido o expirado** → se omite la autenticación (log en `DEBUG`);
  misma respuesta **401** sobre ruta protegida.
- **Token válido pero usuario inactivo** (`active = false`, soft delete) →
  se rechaza la autenticación → **401** sobre ruta protegida.

Errores de seguridad:

| Situación | HTTP | `code` |
|-----------|------|--------|
| Login con email/contraseña incorrectos | 401 | `INVALID_CREDENTIALS` |
| Token ausente, inválido o expirado en ruta protegida | 401 | `UNAUTHORIZED` |
| Usuario autenticado sin el rol requerido (p. ej. `USER` sobre `/api/admin/**`) | 403 | `FORBIDDEN` |

---

## 2. Formato de respuesta de error

Todo el backend responde los errores con el mismo formato
([`ApiError.java`](../backend/src/main/java/com/ingesoft/shop/exception/ApiError.java),
generado por [`GlobalExceptionHandler.java`](../backend/src/main/java/com/ingesoft/shop/exception/GlobalExceptionHandler.java)):

```json
{
  "status": 409,
  "code": "EMAIL_ALREADY_REGISTERED",
  "message": "El email user@demo.com ya está registrado",
  "timestamp": "2026-11-12T03:00:00Z"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | int | Estado HTTP de la respuesta |
| `code` | string | Código de negocio (estable, para programar contra él) |
| `message` | string | Mensaje legible, listo para mostrar en la UI |
| `timestamp` | string (ISO-8601) | Momento en que se generó el error |

**Mapeo de estados HTTP** (definido en
[`ErrorCode.java`](../backend/src/main/java/com/ingesoft/shop/exception/ErrorCode.java)):

| HTTP | Significado | Casos típicos |
|------|-------------|----------------|
| 400 | Validación de entrada | Campos requeridos ausentes, email inválido, JSON malformado, parámetro de tipo inválido |
| 401 | No autenticado | Login con credenciales inválidas; token ausente/inválido/expirado en ruta protegida |
| 402 | Pago requerido | La pasarela simulada rechazó el pago (`PAYMENT_DECLINED`); la orden queda `PENDING` para reintentar |
| 403 | No autorizado | Usuario sin el rol requerido sobre la ruta |
| 404 | No encontrado | Ruta inexistente; usuario inexistente; producto inexistente en catálogo o en el carrito durante el checkout |
| 405 | Método no permitido | Método HTTP no soportado sobre la ruta |
| 409 | Conflicto | Email ya registrado (registro o cambio de perfil); carrito vacío al hacer checkout; stock insuficiente en carrito o checkout; transición de estado de orden no permitida |
| 500 | Error interno | Fallo no controlado (última línea de defensa; el detalle solo va a log) |

---

## 3. Códigos de negocio

Estado actual de [`ErrorCode.java`](../backend/src/main/java/com/ingesoft/shop/exception/ErrorCode.java):

| Código | HTTP | Origen |
|--------|------|--------|
| `EMAIL_ALREADY_REGISTERED` | 409 | Registro o cambio de email con email ya existente |
| `INVALID_CREDENTIALS` | 401 | Login con email/contraseña incorrectos |
| `PRODUCT_NOT_FOUND` | 404 | Producto inexistente (para el público: igual si está desactivado); al agregarlo al carrito; producto del carrito inexistente al hacer checkout |
| `INSUFFICIENT_STOCK` | 409 | Stock insuficiente al agregar o actualizar la cantidad de un ítem del carrito; o al procesar el checkout |
| `CART_EMPTY` | 409 | Intento de checkout con el carrito sin ítems |
| `PAYMENT_DECLINED` | 402 | La pasarela simulada rechazó el pago; la orden queda `PENDING` (reintentable) |
| `UNAUTHORIZED` | 401 | Token ausente, inválido o expirado |
| `FORBIDDEN` | 403 | Rol insuficiente para la ruta |
| `VALIDATION_ERROR` | 400 | Validación de entrada fallida (bean validation / parámetros) |
| `NOT_FOUND` | 404 | Ruta no existe, usuario inexistente, o ítem de carrito inexistente / ajeno al carrito del usuario |
| `ORDER_NOT_FOUND` | 404 | Orden inexistente, o orden ajena al usuario del token al consultar sus órdenes (se responde igual para no revelar existencias) |
| `ORDER_STATUS_INVALID` | 409 | Transición de estado de orden no permitida por la máquina de estados (ver [4.8](#48-orders-gestión-admin)) |
| `METHOD_NOT_ALLOWED` | 405 | Método HTTP no permitido sobre la ruta |
| `INTERNAL_ERROR` | 500 | Última línea de defensa para fallos no controlados |

---

## 4. Endpoints implementados

### 4.1 Auth

Controller: [`AuthController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AuthController.java)
· Servicio: [`AuthServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/AuthServiceImpl.java)

#### `POST /api/auth/register` — crear cuenta

Crea un usuario con rol `USER` (el rol nunca se acepta del cliente, R1). La
contraseña se almacena como hash BCrypt; nunca viaja ni se expone en
respuestas.

**Body** ([`RegisterRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/RegisterRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `name` | string | requerido, máx. 100 caracteres |
| `email` | string | requerido, formato de email válido, único |
| `password` | string | requerido, 8–72 caracteres |

```json
{
  "name": "Ana Pérez",
  "email": "ana@correo.com",
  "password": "MiClave123!"
}
```

**Respuesta `201 Created`** ([`UserResponse`](../backend/src/main/java/com/ingesoft/shop/dto/response/UserResponse.java)):

```json
{
  "id": "3f2c9a1e-6b7d-4e8f-a1b2-c3d4e5f6a7b8",
  "name": "Ana Pérez",
  "email": "ana@correo.com",
  "role": "USER",
  "createdAt": "2026-11-12T03:00:00Z"
}
```

**Errores:** `400 VALIDATION_ERROR` · `409 EMAIL_ALREADY_REGISTERED`

---

#### `POST /api/auth/login` — iniciar sesión

Verifica credenciales y emite el token JWT (HS256, expiración 2 h por
defecto). El mismo `401 INVALID_CREDENTIALS` se usa para email inexistente y
contraseña incorrecta (no se revela cuál falló).

**Body** ([`LoginRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/LoginRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `email` | string | requerido, formato de email válido |
| `password` | string | requerido |

```json
{
  "email": "user@demo.com",
  "password": "User123!"
}
```

**Respuesta `200 OK`** ([`LoginResponse`](../backend/src/main/java/com/ingesoft/shop/dto/response/LoginResponse.java)):

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyQGRlbW8uY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NTc2ODAwMDAsImV4cCI6MTc1NzY4NzIwMH0.firma",
  "user": {
    "id": "00000000-0000-0000-0000-000000000002",
    "name": "Usuario Demo",
    "email": "user@demo.com",
    "role": "USER",
    "createdAt": "2026-11-12T02:00:00Z"
  }
}
```

**Errores:** `400 VALIDATION_ERROR` · `401 INVALID_CREDENTIALS`

---

### 4.2 Users

Controller: [`UserController.java`](../backend/src/main/java/com/ingesoft/shop/controller/UserController.java).
El identificador del usuario **no** se toma de la URL ni del body: se deriva
del email contenido en el token JWT (`Authentication.getName()`).

#### `GET /api/users/me` — perfil propio

**Autenticación:** JWT · **Body:** —

**Respuesta `200 OK`:** mismo `UserResponse` del registro.

**Errores:** `401 UNAUTHORIZED` (sin token o inválido) · `404 NOT_FOUND`
(token válido pero el usuario ya no existe)

---

#### `PUT /api/users/me` — actualizar perfil

**Autenticación:** JWT

**Body** ([`UpdateProfileRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/UpdateProfileRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `name` | string | requerido, máx. 100 caracteres |
| `email` | string | requerido, formato válido, único entre usuarios |
| `password` | string | **opcional** (si se envía, 8–72 caracteres). `null` o en blanco = no se cambia la contraseña |

```json
{
  "name": "Ana Pérez Roldán",
  "email": "ana.perez@correo.com",
  "password": null
}
```

**Respuesta `200 OK`:** `UserResponse` con los datos actualizados.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` ·
`404 NOT_FOUND` · `409 EMAIL_ALREADY_REGISTERED` (el nuevo email ya lo usa
otro usuario; cambiar al mismo email propio está permitido)

---

### 4.3 Products (catálogo público)

Controller: [`ProductController.java`](../backend/src/main/java/com/ingesoft/shop/controller/ProductController.java)
· Servicio: [`ProductServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/ProductServiceImpl.java)

**Autenticación: pública** (no requiere token). Solo expone productos con
`available = true`: los desactivados quedan invisibles para el público.

#### `GET /api/products` — listado paginado

**Parámetros de consulta:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | int | `0` | Índice de página (0-based) |
| `size` | int | `10` | Elementos por página |
| `search` | string | — | Búsqueda parcial en `name` (insensible a mayúsculas/minúsculas) |
| `sort` | string | `name` | Formato `campo` o `campo,desc`. Campos válidos: `name`, `price`, `stock`, `updatedAt` |

**Respuesta `200 OK`:** `Page<ProductResponse>` (formato de paginación
estándar de Spring Data):

```json
{
  "content": [
    {
      "id": "00000000-0000-0000-0000-000000000101",
      "name": "Laptop ProBook 14\"",
      "description": "Laptop ProBook 14\" con 16 GB de RAM, SSD de 512 GB y procesador de 13a generacion. Ideal para trabajo y estudio.",
      "price": 2599900.00,
      "stock": 10,
      "imageUrl": "/img/productos/laptop-probook.webp",
      "available": true,
      "updatedAt": "2026-11-12T02:00:00Z"
    }
  ],
  "totalElements": 8,
  "totalPages": 1,
  "size": 10,
  "number": 0,
  "first": true,
  "last": true,
  "numberOfElements": 1,
  "empty": false
}
```

**Errores:** `400 VALIDATION_ERROR` (`page`/`size` no numéricos)

---

#### `GET /api/products/{id}` — detalle de un producto

**Parámetros de ruta:** `id` (UUID)

**Respuesta `200 OK`:** `ProductResponse` (misma forma que un elemento de
`content` del listado).

**Errores:** `404 PRODUCT_NOT_FOUND` (el producto no existe **o** está
desactivado: para el público ambos casos se responden igual, para no revelar
la existencia de productos desactivados)

---

### 4.4 Products (gestión admin)

Controller: [`AdminProductController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AdminProductController.java)
· Servicio: [`ProductAdminServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/ProductAdminServiceImpl.java)

**Autenticación: JWT + rol `ADMIN`** (`@PreAuthorize("hasRole('ADMIN')")` a
nivel de clase). Un usuario autenticado con rol `USER` recibe
`403 FORBIDDEN`; sin token (o inválido), `401 UNAUTHORIZED`.

#### `GET /api/admin/products` — listado completo

Mismos parámetros de consulta que `GET /api/products` (`page`, `size`,
`search`, `sort`), con dos diferencias:

- **Incluye productos desactivados** (`available = false`): el admin ve el
  inventario completo.
- El campo de orden acepta además `available`.

**Respuesta `200 OK`:** `Page<ProductResponse>`.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` · `403 FORBIDDEN`

---

#### `POST /api/admin/products` — crear producto

**Body** ([`ProductRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/ProductRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `name` | string | requerido, máx. 150 caracteres |
| `description` | string | requerido, máx. 2000 caracteres |
| `price` | number | requerido, mayor que 0 |
| `stock` | int | requerido, ≥ 0 |
| `imageUrl` | string | **opcional**, máx. 500 caracteres |

```json
{
  "name": "Webcam Full HD",
  "description": "Webcam 1080p con microfono integrado y enfoque automatico.",
  "price": 189900.00,
  "stock": 15,
  "imageUrl": "/img/productos/webcam-fhd.webp"
}
```

**Respuesta `201 Created`:** `ProductResponse` (el producto nace con
`available = true`).

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` · `403 FORBIDDEN`

---

#### `PUT /api/admin/products/{id}` — actualizar producto

**Body:** mismo `ProductRequest` (actualización total de los campos
editables; `id` y `available` no se aceptan en el body — ver
[`DELETE /api/admin/products/{id}`](#delete-apiprodproductsid--desactivar-soft-delete)).

**Respuesta `200 OK`:** `ProductResponse` actualizado.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` · `403 FORBIDDEN` ·
`404 PRODUCT_NOT_FOUND`

---

#### `DELETE /api/admin/products/{id}` — desactivar (soft delete)

**No** elimina la fila: marca `available = false` para preservar la
trazabilidad de órdenes futuras que referencian el producto (ver ADR-008).

**Respuesta `200 OK`:** `ProductResponse` con `available = false`.

**Errores:** `401 UNAUTHORIZED` · `403 FORBIDDEN` · `404 PRODUCT_NOT_FOUND`

---

#### `PATCH /api/admin/products/{id}/stock` — ajustar stock

**Body** ([`AdjustStockRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/AdjustStockRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `stock` | int | requerido, ≥ 0. Es el valor **absoluto** de stock (no un delta) |

```json
{ "stock": 7 }
```

**Respuesta `200 OK`:** `ProductResponse` con el stock actualizado.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` · `403 FORBIDDEN` ·
`404 PRODUCT_NOT_FOUND`

---

### 4.5 Cart (carrito de compras)

Controller: [`CartController.java`](../backend/src/main/java/com/ingesoft/shop/controller/CartController.java)
· Servicio: [`CartServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/CartServiceImpl.java)

**Autenticación: JWT (cualquier rol)** — el carrito opera siempre sobre el
usuario del token.

**Comportamiento general:**

- El carrito es **persistente** (tablas `carts` / `cart_items`) y **único por
  usuario** (`OneToOne` con restricción única sobre `user_id`).
- `GET /api/cart` **crea el carrito si no existe**: el usuario siempre tiene
  un carrito disponible.
- El **subtotal no se almacena**: se calcula en memoria como la suma de
  `unitPrice × quantity` de los ítems.
- La **cantidad se acumula**: agregar un producto que ya está en el carrito
  suma las cantidades en lugar de duplicar el ítem (restricción única
  `cart_id + product_id`).
- El precio del ítem se captura del producto **en el momento de agregarlo**
  (ADR-009); el stock se re-valida al procesar el checkout
  ([4.6](#46-checkout-compra-con-pago-simulado)).
- **Aislamiento de ítems:** `PATCH`/`DELETE` verifican que el ítem pertenece
  al carrito del usuario del token; si no, se responde `404 NOT_FOUND` (no se
  revela la existencia de ítems ajenos).

#### `GET /api/cart` — ver el carrito

**Respuesta `200 OK`:** `CartResponse`

```json
{
  "id": "9d4e7f3a-5b2c-4a1e-8f0d-1a2b3c4d5e6f",
  "items": [
    {
      "id": "c8a1b2d3-0f9e-4c7d-a6b5-4e3d2c1b0a9f",
      "productId": "00000000-0000-0000-0000-000000000105",
      "productName": "Cable USB-C 100W",
      "imageUrl": "/img/productos/cable-usbc.webp",
      "unitPrice": 129900.00,
      "quantity": 2,
      "lineTotal": 259800.00
    }
  ],
  "subtotal": 259800.00
}
```

**Errores:** `401 UNAUTHORIZED`

---

#### `POST /api/cart/items` — agregar producto al carrito

**Body** ([`AddCartItemRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/AddCartItemRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `productId` | UUID | requerido, debe existir y estar disponible |
| `quantity` | int | requerido, mayor que 0 |

```bash
curl -X POST http://localhost:8080/api/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "00000000-0000-0000-0000-000000000105", "quantity": 2}'
```

**Respuesta `201 Created`:** `CartResponse` completo con la cantidad
acumulada si el producto ya estaba en el carrito.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` ·
`404 PRODUCT_NOT_FOUND` (producto inexistente **o** desactivado) ·
`409 INSUFFICIENT_STOCK` (el stock disponible del producto es menor que la
cantidad solicitada, o no alcanza para la cantidad acumulada)

---

#### `PATCH /api/cart/items/{itemId}` — cambiar la cantidad de un ítem

**Parámetros de ruta:** `itemId` (UUID)

**Body** ([`UpdateCartItemRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/UpdateCartItemRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `quantity` | int | requerido, mayor que 0. Es el valor **absoluto** (no un delta) |

**Respuesta `200 OK`:** `CartResponse` con la cantidad actualizada.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` ·
`404 NOT_FOUND` (ítem inexistente, o de otro usuario/carrito) ·
`409 INSUFFICIENT_STOCK`

---

#### `DELETE /api/cart/items/{itemId}` — eliminar un ítem

**Parámetros de ruta:** `itemId` (UUID)

**Respuesta `200 OK`:** `CartResponse` con el ítem eliminado.

**Errores:** `401 UNAUTHORIZED` · `404 NOT_FOUND` (ítem inexistente,
o de otro usuario/carrito)

---

### 4.6 Checkout (compra con pago simulado)

Controller: [`CheckoutController.java`](../backend/src/main/java/com/ingesoft/shop/controller/CheckoutController.java)
· Servicios: [`CheckoutServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/CheckoutServiceImpl.java) (flujo transaccional)
y [`PaymentServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/PaymentServiceImpl.java) (persistencia del pago)
· Proveedor: [`SimulatedPaymentProvider.java`](../backend/src/main/java/com/ingesoft/shop/service/payment/SimulatedPaymentProvider.java)
(implementación de [`IPaymentProvider`](../backend/src/main/java/com/ingesoft/shop/service/payment/IPaymentProvider.java))

**Autenticación: JWT (cualquier rol)** — la orden se crea siempre para el
usuario del token (el email viaja por el `Authentication`, nunca por el body).

**Comportamiento general:**

- Un único endpoint ejecuta la compra completa: validar carrito → bloquear
  ítems y productos → crear la orden → procesar el pago → (si se confirma)
  descontar stock y vaciar el carrito.
- **Transacción:** todo el flujo corre dentro de una sola transacción
  (`TransactionTemplate`). Cualquier error de negocio la aborta y no se
  persiste nada.
- **Bloqueo pesimista:** los ítems del carrito y cada producto se bloquean
  con `SELECT ... FOR UPDATE` (`PESSIMISTIC_WRITE`) para impedir la sobreventa
  ante peticiones concurrentes (ver ADR-015).
- **Total:** `subtotal` (suma de `unitPrice × quantity`) + envío fijo
  (`checkout.shipping-fee`, por defecto `5000.00` COP) → `total`.
- **Pago simulado:** cualquier tarjeta se acepta **salvo** la cuyos dígitos
  terminen en `0002` (configurable vía `checkout.card-declined-suffix`). Un
  pago confirmado genera un `transactionId` `SIM-<uuid>`; todo intento se
  persiste en la tabla `payments` (confirmado o rechazado).
- **Rechazo del pago:** la orden se persiste con estado `PENDING`, el pago
  como `FAILED`, y la petición responde `402 PAYMENT_DECLINED`. La orden
  `PENDING` puede reintentarse más adelante con su `orderNumber` (el módulo
  de reintentos aún no está implementado).
- **Confirmación:** se descuenta el stock de cada producto, la orden pasa a
  `PAID` y el carrito se vacía. Los ítems de la orden son una copia
  **desnormalizada** (`productName` y `unitPrice` inmutables en
  `order_items`), de modo que el histórico de la orden no se altera si el
  producto cambia o se desactiva (ADR-008).

#### `POST /api/checkout` — crear orden con pago

**Body** ([`CheckoutRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/CheckoutRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `shippingAddress` | string | requerido, máx. 255 caracteres |
| `payment` | [`PaymentData`](#paymentdata) | requerido, validado en cascada (`@Valid`) |

**`payment`** ([`PaymentData`](../backend/src/main/java/com/ingesoft/shop/dto/request/PaymentData.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `method` | string | requerido, máx. 30 caracteres (p. ej. `"card"`) |
| `cardNumber` | string | requerido, máx. 25 caracteres. En el proveedor simulado, los dígitos que terminen en `0002` se rechazan |
| `cardholderName` | string | **opcional**, máx. 100 caracteres |

```json
{
  "shippingAddress": "Calle 45 # 12-30, Bogotá",
  "payment": {
    "method": "card",
    "cardNumber": "4242 4242 4242 4242",
    "cardholderName": "Usuario Demo"
  }
}
```

**Respuesta `201 Created`** ([`OrderResponse`](../backend/src/main/java/com/ingesoft/shop/dto/response/OrderResponse.java)):

```json
{
  "id": "b7e2c4d8-9a1f-4c3e-8d2b-5f6a7c8d9e0f",
  "orderNumber": "ORD-1A2B3C4D",
  "status": "PAID",
  "subtotal": 259800.00,
  "shipping": 5000.00,
  "total": 264800.00,
  "shippingAddress": "Calle 45 # 12-30, Bogotá",
  "createdAt": "2026-11-12T03:00:00Z",
  "items": [
    {
      "productId": "00000000-0000-0000-0000-000000000105",
      "productName": "Cable USB-C 100W",
      "unitPrice": 129900.00,
      "quantity": 2,
      "lineTotal": 259800.00
    }
  ]
}
```

Ejemplo (después de agregar ítems al carrito con `POST /api/cart/items`):

```bash
curl -X POST http://localhost:8080/api/checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": "Calle 45 # 12-30, Bogotá",
    "payment": { "method": "card", "cardNumber": "4242 4242 4242 4242" }
  }'
```

Simulación de rechazo (tarjeta cuyos dígitos terminen en `0002`):

```bash
curl -X POST http://localhost:8080/api/checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": "Calle 45 # 12-30, Bogotá",
    "payment": { "method": "card", "cardNumber": "4000 0000 0000 0002" }
  }'
```

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` ·
`404 PRODUCT_NOT_FOUND` (un producto del carrito fue eliminado) ·
`409 CART_EMPTY` (el carrito no tiene ítems) · `409 INSUFFICIENT_STOCK`
(entró una compra concurrente y el stock ya no alcanza) ·
`402 PAYMENT_DECLINED` (la pasarela simulada rechazó la tarjeta; la orden
queda `PENDING` y su `orderNumber` viene en el `message` del error)

---

### 4.7 Orders (consultas del usuario)

Controller: [`OrderController.java`](../backend/src/main/java/com/ingesoft/shop/controller/OrderController.java)
· Servicio: [`OrderServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/OrderServiceImpl.java)

**Autenticación: JWT (cualquier rol)** — el usuario se deriva del email del
token (`Authentication.getName()`); el `id` del usuario **nunca** viaja por la
URL ni por el body.

**Comportamiento general:**

- Solo expone las órdenes del propio usuario: la consulta
  `findByUserIdAndId` combina ambos criterios, de modo que una orden inexistente
  y una orden ajena se responden igual (`404 ORDER_NOT_FOUND`, sin revelar
  existencias ajenas).
- El listado siempre va ordenado por `createdAt` descendente (la más reciente
  primero).
- El detalle incluye el pago asociado cuando existe (`payment: null` si la
  orden aún no tiene registro de pago).

#### `GET /api/orders/mine` — mis órdenes

**Parámetros de consulta:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | int | `0` | Índice de página (0-based) |
| `size` | int | `10` | Elementos por página |

**Respuesta `200 OK`:** `Page<OrderResponse>` (misma forma que
[`OrderResponse`](../backend/src/main/java/com/ingesoft/shop/dto/response/OrderResponse.java)
del checkout; sin el campo `payment`):

```json
{
  "content": [
    {
      "id": "b7e2c4d8-9a1f-4c3e-8d2b-5f6a7c8d9e0f",
      "orderNumber": "ORD-1A2B3C4D",
      "status": "PAID",
      "subtotal": 259800.00,
      "shipping": 5000.00,
      "total": 264800.00,
      "shippingAddress": "Calle 45 # 12-30, Bogotá",
      "createdAt": "2026-11-12T03:00:00Z",
      "items": [
        {
          "productId": "00000000-0000-0000-0000-000000000105",
          "productName": "Cable USB-C 100W",
          "unitPrice": 129900.00,
          "quantity": 2,
          "lineTotal": 259800.00
        }
      ]
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "size": 10,
  "number": 0,
  "first": true,
  "last": true,
  "numberOfElements": 1,
  "empty": false
}
```

**Errores:** `400 VALIDATION_ERROR` (`page`/`size` no numéricos) ·
`401 UNAUTHORIZED` · `404 NOT_FOUND` (token válido pero el usuario ya no existe)

---

#### `GET /api/orders/mine/{id}` — detalle de una orden propia

**Parámetros de ruta:** `id` (UUID de la orden)

**Respuesta `200 OK`:** `OrderDetailResponse`

```json
{
  "id": "b7e2c4d8-9a1f-4c3e-8d2b-5f6a7c8d9e0f",
  "orderNumber": "ORD-1A2B3C4D",
  "status": "PAID",
  "subtotal": 259800.00,
  "shipping": 5000.00,
  "total": 264800.00,
  "shippingAddress": "Calle 45 # 12-30, Bogotá",
  "createdAt": "2026-11-12T03:00:00Z",
  "items": [
    {
      "productId": "00000000-0000-0000-0000-000000000105",
      "productName": "Cable USB-C 100W",
      "unitPrice": 129900.00,
      "quantity": 2,
      "lineTotal": 259800.00
    }
  ],
  "payment": {
    "status": "CONFIRMED",
    "method": "card",
    "transactionId": "SIM-7c9e4a1d-2b3f-4e5a-9c6d-8e7f0a1b2c3d",
    "failureReason": null,
    "processedAt": "2026-11-12T03:00:00Z"
  }
}
```

**Errores:** `401 UNAUTHORIZED` · `404 NOT_FOUND` (token válido pero el usuario
ya no existe) · `404 ORDER_NOT_FOUND` (orden inexistente **o** ajena al usuario
del token)

---

### 4.8 Orders (gestión admin)

Controller: [`AdminOrderController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AdminOrderController.java)
· Servicio: [`OrderAdminServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/OrderAdminServiceImpl.java)

**Autenticación: JWT + rol `ADMIN`** (`@PreAuthorize("hasRole('ADMIN')")` a
nivel de clase). Un usuario autenticado con rol `USER` recibe
`403 FORBIDDEN`; sin token (o inválido), `401 UNAUTHORIZED`.

**Comportamiento general:**

- El listado y el detalle son **read-only**; el único cambio de estado se hace
  con `PATCH /{id}/status`.
- **Máquina de estados** (validada en
  [`OrderAdminServiceImpl.validateTransition`](../backend/src/main/java/com/ingesoft/shop/service/impl/OrderAdminServiceImpl.java)):

  | Desde | Transiciones permitidas |
  |-------|-------------------------|
  | `PENDING` | `CANCELLED` |
  | `PAID` | `SHIPPED`, `CANCELLED` |
  | `SHIPPED` | `DELIVERED` |
  | `DELIVERED` / `CANCELLED` | ninguna (estados terminales) |

  Cualquier otra combinación responde `409 ORDER_STATUS_INVALID` (p. ej.
  `DELIVERED → SHIPPED` o `PENDING → PAID`: el paso a `PAID` solo ocurre vía
  checkout al confirmar el pago).
- **Restitución de stock:** al cancelar desde `PAID` (`PAID → CANCELLED`), la
  cantidad de cada ítem se suma de nuevo al stock de su producto
  (`stock += quantity`). Cancelar desde `PENDING` **no** toca el stock (nunca
  se descontó).

#### `GET /api/admin/orders` — listado de órdenes

**Parámetros de consulta:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | int | `0` | Índice de página (0-based) |
| `size` | int | `10` | Elementos por página |
| `status` | enum | — | Filtro opcional por [`OrderStatus`](../backend/src/main/java/com/ingesoft/shop/enums/OrderStatus.java): `PENDING`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`. Sin el parámetro devuelve todas |

**Respuesta `200 OK`:** `Page<OrderResponse>` (misma forma que
[4.7](#47-orders-consultas-del-usuario)), ordenado por `createdAt` descendente.

**Errores:** `400 VALIDATION_ERROR` (`page`/`size` no numéricos o `status`
inválido) · `401 UNAUTHORIZED` · `403 FORBIDDEN`

---

#### `GET /api/admin/orders/{id}` — detalle de una orden

**Parámetros de ruta:** `id` (UUID de la orden)

**Respuesta `200 OK`:** `OrderDetailResponse` (misma forma que
[4.7](#get-apiordersmineid--detalle-de-una-orden-propia)).

**Errores:** `401 UNAUTHORIZED` · `403 FORBIDDEN` · `404 ORDER_NOT_FOUND`

---

#### `PATCH /api/admin/orders/{id}/status` — cambiar el estado

**Parámetros de ruta:** `id` (UUID de la orden)

**Body** ([`UpdateOrderStatusRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/UpdateOrderStatusRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `status` | enum | requerido (`@NotNull`), uno de los valores de `OrderStatus` |

```json
{ "status": "SHIPPED" }
```

```bash
curl -X PATCH http://localhost:8080/api/admin/orders/<orderId> \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "SHIPPED" }'
```

**Respuesta `200 OK`:** `OrderDetailResponse` con el estado ya actualizado
(solo se modifica la fila de la orden — y, en su caso, el stock de los
productos — dentro de una transacción).

**Errores:** `400 VALIDATION_ERROR` (`status` ausente o valor no válido del
enum) · `401 UNAUTHORIZED` · `403 FORBIDDEN` · `404 ORDER_NOT_FOUND` ·
`409 ORDER_STATUS_INVALID` (transición no permitida; el `message` incluye el
paso intentado, p. ej. `Transición de estado no permitida: DELIVERED → SHIPPED`)

---

## 5. Referencias

- Diseño completo y flujo de checkout: [`arquitectura.md`](arquitectura.md)
- Decisiones relacionadas (JWT, pago simulado, soft delete): [`decisiones-adr.md`](decisiones-adr.md)
- Credenciales demo del seed: [README.md](../README.md)
