# Documentación de la API

**Base URL:** `http://localhost:8080/api`
**Formato:** JSON (UTF-8) · **Autenticación:** `Authorization: Bearer <token>`
**Swagger UI (interactivo):** <http://localhost:8080/swagger-ui.html>

> **Cómo leer esta guía:** cada endpoint de [`arquitectura.md` §5](arquitectura.md) está
> documentado con su `curl` real y su respuesta de éxito. Los tres errores típicos que pide
> la prueba técnica — **409** (conflicto de stock/estado), **402** (pago rechazado) y
> **403** (rol insuficiente) — se demuestran con `curl` y cuerpo de respuesta en la
> [sección 4](#4-endpoints-documentados), y se recopilan en la
> [sección 5](#5-errores-típicos-demostrables-con-curl).

## Índice

1. [Convenciones y credenciales demo](#1-convenciones-y-credenciales-demo)
2. [Formato de respuesta de error](#2-formato-de-respuesta-de-error)
3. [Códigos de negocio](#3-códigos-de-negocio)
4. [Endpoints documentados](#4-endpoints-documentados)
   - [4.1 Auth](#41-auth)
   - [4.2 Users](#42-users)
   - [4.3 Products (catálogo público)](#43-products-catálogo-público)
   - [4.4 Products (gestión admin)](#44-products-gestión-admin)
   - [4.5 Cart (carrito de compras)](#45-cart-carrito-de-compras)
   - [4.6 Checkout (compra con pago simulado)](#46-checkout-compra-con-pago-simulado)
   - [4.7 Orders (consultas del usuario)](#47-orders-consultas-del-usuario)
   - [4.8 Orders (gestión admin)](#48-orders-gestión-admin)
   - [4.9 Swagger UI (SpringDoc)](#49-swagger-ui-springdoc)
 5. [Errores típicos demostrables con `curl`](#5-errores-típicos-demostrables-con-curl)
6. [Referencias](#6-referencias)

---

## 1. Convenciones y credenciales demo

**Credenciales del seed** ([`V2__seed.sql`](../backend/src/main/resources/db/migration/V2__seed.sql)):

| Rol | Email | Contraseña |
|-----|-------|------------|
| `ADMIN` | `admin@demo.com` | `Admin123!` |
| `USER` | `user@demo.com` | `User123!` |

**Productos del seed** (UUIDs determinísticos; el `...0105` es el de **stock bajo**,
stock = 2, pensado para demostrar `INSUFFICIENT_STOCK`):

| UUID | Nombre | Precio (COP) | Stock |
|------|--------|--------------|-------|
| `00000000-0000-0000-0000-000000000101` | Laptop ProBook 14" | 2599900.00 | 10 |
| `00000000-0000-0000-0000-000000000102` | Teclado Mecanico RGB | 189900.00 | 25 |
| `00000000-0000-0000-0000-000000000103` | Mouse Gamer 12000 DPI | 99900.00 | 40 |
| `00000000-0000-0000-0000-000000000104` | Monitor 27" 144Hz | 749900.00 | 8 |
| `00000000-0000-0000-0000-000000000105` | Cable USB-C 100W | 29900.00 | **2** |
| `00000000-0000-0000-0000-000000000106` | Audifonos Bluetooth 5.3 | 149900.00 | 15 |
| `00000000-0000-0000-0000-000000000107` | SSD NVMe 1TB | 259900.00 | 20 |
| `00000000-0000-0000-0000-000000000108` | Hub USB 3.0 4 Puertos | 49900.00 | 5 |

**Convenciones de los ejemplos:**

- Los ejemplos asumen que ya obtuviste un token. Para no repetir el login en cada bloque,
  los ejemplos usan las variables `<token-user>` (rol `USER`) y `<token-admin>` (rol
  `ADMIN`), que se obtienen así (en PowerShell o WSL; en `cmd.exe` adapta el `set`):

  ```bash
  # Token de usuario demo
  TOKEN_USER=$(curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "user@demo.com", "password": "User123!"}' \
    | python -c "import sys, json; print(json.load(sys.stdin)['token'])")

  # Token de administrador
  TOKEN_ADMIN=$(curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@demo.com", "password": "Admin123!"}' \
    | python -c "import sys, json; print(json.load(sys.stdin)['token'])")
  ```

- Los `id` de ítems de carrito (`<cartItemId>`) y de órdenes (`<orderId>`) se toman de
  las propias respuestas de `POST /api/cart/items` y `POST /api/checkout`.
- En **Windows (`cmd.exe`)**: reemplaza las comillas simples por dobles (escapando las
  internas), y usa `set TOKEN_USER=...` para las variables; el JSON debe ir en un solo
  `-d "{...}"`.

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
  "timestamp": "2026-11-22T03:00:00Z"
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
| 404 | No encontrado | Ruta inexistente; usuario inexistente; producto inexistente o desactivado; ítem de carrito ajeno; orden inexistente o ajena |
| 405 | Método no permitido | Método HTTP no soportado sobre la ruta |
| 409 | Conflicto | Email ya registrado; carrito vacío al hacer checkout; stock insuficiente; transición de estado de orden no permitida |
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
| `VALIDATION_ERROR` | 400 | Validación de entrada fallida (Bean Validation / parámetros) |
| `NOT_FOUND` | 404 | Ruta no existe, usuario inexistente, o ítem de carrito inexistente / ajeno al carrito del usuario |
| `ORDER_NOT_FOUND` | 404 | Orden inexistente, o orden ajena al usuario del token al consultar sus órdenes (se responde igual para no revelar existencias) |
| `ORDER_STATUS_INVALID` | 409 | Transición de estado de orden no permitida por la máquina de estados (ver [4.8](#48-orders-gestión-admin)) |
| `METHOD_NOT_ALLOWED` | 405 | Método HTTP no permitido sobre la ruta |
| `INTERNAL_ERROR` | 500 | Última línea de defensa para fallos no controlados |

---

## 4. Endpoints documentados

### 4.1 Auth

Controller: [`AuthController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AuthController.java)
· Servicio: [`AuthServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/AuthServiceImpl.java)

#### `POST /api/auth/register` — crear cuenta

Crea un usuario con rol `USER` (el rol nunca se acepta del cliente, R1). La
contraseña se almacena como hash BCrypt; nunca viaja ni se expone en
respuestas. **Acceso: público.**

**Body** ([`RegisterRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/RegisterRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `name` | string | requerido, máx. 100 caracteres |
| `email` | string | requerido, formato de email válido, único |
| `password` | string | requerido, 8–72 caracteres |

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ana Pérez",
    "email": "ana@correo.com",
    "password": "MiClave123!"
  }'
```

**Respuesta `201 Created`** ([`UserResponse`](../backend/src/main/java/com/ingesoft/shop/dto/response/UserResponse.java)):

```json
{
  "id": "3f2c9a1e-6b7d-4e8f-a1b2-c3d4e5f6a7b8",
  "name": "Ana Pérez",
  "email": "ana@correo.com",
  "role": "USER",
  "createdAt": "2026-11-22T03:00:00Z"
}
```

**Errores:** `400 VALIDATION_ERROR` · `409 EMAIL_ALREADY_REGISTERED`
(ejemplo real en [5.2](#52-409-email-ya-registrado)).

---

#### `POST /api/auth/login` — iniciar sesión

Verifica credenciales y emite el token JWT (HS256, expiración 2 h por
defecto). El mismo `401 INVALID_CREDENTIALS` se usa para email inexistente y
contraseña incorrecta (no se revela cuál falló). **Acceso: público.**

**Body** ([`LoginRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/LoginRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `email` | string | requerido, formato de email válido |
| `password` | string | requerido |

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@demo.com", "password": "User123!"}'
```

**Respuesta `200 OK`** ([`LoginResponse`](../backend/src/main/java/com/ingesoft/shop/dto/response/LoginResponse.java)):

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyQGRlbW8uY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3NTU3MDAwMDAsImV4cCI6MTc1NTcwNzIwMH0.firma",
  "user": {
    "id": "00000000-0000-0000-0000-000000000002",
    "name": "Usuario Demo",
    "email": "user@demo.com",
    "role": "USER",
    "createdAt": "2026-11-22T02:00:00Z"
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

```bash
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer <token-user>"
```

**Respuesta `200 OK`:** mismo `UserResponse` del registro.

```json
{
  "id": "00000000-0000-0000-0000-000000000002",
  "name": "Usuario Demo",
  "email": "user@demo.com",
  "role": "USER",
  "createdAt": "2026-11-22T02:00:00Z"
}
```

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

```bash
curl -X PUT http://localhost:8080/api/users/me \
  -H "Authorization: Bearer <token-user>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Usuario Demo",
    "email": "user@demo.com",
    "password": null
  }'
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

```bash
# Todo el catálogo, primera página
curl "http://localhost:8080/api/products?page=0&size=10"

# Buscar "cable" y ordenar por precio descendente
curl "http://localhost:8080/api/products?search=cable&sort=price,desc"
```

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
      "updatedAt": "2026-11-22T02:00:00Z"
    }
  ],
  "totalElements": 8,
  "totalPages": 1,
  "size": 10,
  "number": 0,
  "first": true,
  "last": true,
  "numberOfElements": 8,
  "empty": false
}
```

**Errores:** `400 VALIDATION_ERROR` (`page`/`size` no numéricos)

---

#### `GET /api/products/{id}` — detalle de un producto

**Parámetros de ruta:** `id` (UUID)

```bash
curl http://localhost:8080/api/products/00000000-0000-0000-0000-000000000105
```

**Respuesta `200 OK`:** `ProductResponse` (misma forma que un elemento de
`content` del listado).

```json
{
  "id": "00000000-0000-0000-0000-000000000105",
  "name": "Cable USB-C 100W",
  "description": "Cable USB-C trenzado con carga de 100W y transferencia de datos a 10 Gbps. Longitud 2 m. (STOCK BAJO: demo de INSUFFICIENT_STOCK)",
  "price": 29900.00,
  "stock": 2,
  "imageUrl": "/img/productos/cable-usbc.webp",
  "available": true,
  "updatedAt": "2026-11-22T02:00:00Z"
}
```

**Errores:** `400 VALIDATION_ERROR` (`id` no es un UUID) · `404 PRODUCT_NOT_FOUND`
(el producto no existe **o** está desactivado: para el público ambos casos se
responden igual, para no revelar la existencia de productos desactivados)

---

### 4.4 Products (gestión admin)

Controller: [`AdminProductController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AdminProductController.java)
· Servicio: [`ProductAdminServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/ProductAdminServiceImpl.java)

**Autenticación: JWT + rol `ADMIN`** (`@PreAuthorize("hasRole('ADMIN')")` a
nivel de clase). Un usuario autenticado con rol `USER` recibe
`403 FORBIDDEN`; sin token (o inválido), `401 UNAUTHORIZED`.
(Ejemplo real del `403` en [5.4](#54-403-rol-insuficiente).)

#### `GET /api/admin/products` — listado completo

Mismos parámetros de consulta que `GET /api/products` (`page`, `size`,
`search`, `sort`), con dos diferencias:

- **Incluye productos desactivados** (`available = false`): el admin ve el
  inventario completo.
- El campo de orden acepta además `available`.

```bash
# Todo el inventario (activos y desactivados)
curl "http://localhost:8080/api/admin/products?page=0&size=10" \
  -H "Authorization: Bearer <token-admin>"

# Solo los desactivados, por nombre
curl "http://localhost:8080/api/admin/products?search=webcam" \
  -H "Authorization: Bearer <token-admin>"
```

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

```bash
curl -X POST http://localhost:8080/api/admin/products \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Webcam Full HD",
    "description": "Webcam 1080p con microfono integrado y enfoque automatico.",
    "price": 189900.00,
    "stock": 15,
    "imageUrl": "/img/productos/webcam-fhd.webp"
  }'
```

**Respuesta `201 Created`:** `ProductResponse` (el producto nace con
`available = true`).

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` · `403 FORBIDDEN`

---

#### `PUT /api/admin/products/{id}` — actualizar producto

**Body:** mismo `ProductRequest` (actualización total de los campos
editables; `id` y `available` no se aceptan en el body — el cambio de
disponibilidad se hace con
[`DELETE /api/admin/products/{id}`](#delete-apiadminproductsid--desactivar-soft-delete)).

```bash
curl -X PUT http://localhost:8080/api/admin/products/00000000-0000-0000-0000-000000000105 \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cable USB-C 100W",
    "description": "Cable USB-C trenzado con carga de 100W y transferencia de datos a 10 Gbps. Longitud 2 m.",
    "price": 32900.00,
    "stock": 2,
    "imageUrl": "/img/productos/cable-usbc.webp"
  }'
```

**Respuesta `200 OK`:** `ProductResponse` actualizado.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` · `403 FORBIDDEN` ·
`404 PRODUCT_NOT_FOUND`

---

#### `DELETE /api/admin/products/{id}` — desactivar (soft delete)

**No** elimina la fila: marca `available = false` para preservar la
trazabilidad de órdenes futuras que referencian el producto
(ADR-013 en [`decisiones-adr.md`](decisiones-adr.md)).

```bash
curl -X DELETE http://localhost:8080/api/admin/products/00000000-0000-0000-0000-000000000108 \
  -H "Authorization: Bearer <token-admin>"
```

**Respuesta `200 OK`:** `ProductResponse` con `available = false`.

**Errores:** `401 UNAUTHORIZED` · `403 FORBIDDEN` · `404 PRODUCT_NOT_FOUND`

---

#### `PATCH /api/admin/products/{id}/stock` — ajustar stock

**Body** ([`AdjustStockRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/AdjustStockRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `stock` | int | requerido, ≥ 0. Es el valor **absoluto** de stock (no un delta) |

```bash
curl -X PATCH http://localhost:8080/api/admin/products/00000000-0000-0000-0000-000000000105/stock \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{ "stock": 7 }'
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
- El precio del ítem se captura del producto **en el momento de agregarlo**;
  el stock se re-valida al procesar el checkout
  ([4.6](#46-checkout-compra-con-pago-simulado)).
- **Aislamiento de ítems:** `PATCH`/`DELETE` verifican que el ítem pertenece
  al carrito del usuario del token; si no, se responde `404 NOT_FOUND` (no se
  revela la existencia de ítems ajenos).

#### `GET /api/cart` — ver el carrito

```bash
curl http://localhost:8080/api/cart \
  -H "Authorization: Bearer <token-user>"
```

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
      "unitPrice": 29900.00,
      "quantity": 2,
      "lineTotal": 59800.00
    }
  ],
  "subtotal": 59800.00
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
  -H "Authorization: Bearer <token-user>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "00000000-0000-0000-0000-000000000105", "quantity": 2}'
```

**Respuesta `200 OK`:** `CartResponse` completo con la cantidad
acumulada si el producto ya estaba en el carrito. (El controlador no declara
un estado propio; la respuesta es `200`.)

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` ·
`404 PRODUCT_NOT_FOUND` (producto inexistente **o** desactivado) ·
`409 INSUFFICIENT_STOCK` (el stock disponible del producto es menor que la
cantidad acumulada) (ejemplo real en
[5.1](#51-409-stock-insuficiente)).

---

#### `PATCH /api/cart/items/{itemId}` — cambiar la cantidad de un ítem

**Parámetros de ruta:** `itemId` (UUID)

**Body** ([`UpdateCartItemRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/UpdateCartItemRequest.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `quantity` | int | requerido, mayor que 0. Es el valor **absoluto** (no un delta) |

```bash
curl -X PATCH http://localhost:8080/api/cart/items/<cartItemId> \
  -H "Authorization: Bearer <token-user>" \
  -H "Content-Type: application/json" \
  -d '{ "quantity": 1 }'
```

**Respuesta `200 OK`:** `CartResponse` con la cantidad actualizada.

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` ·
`404 NOT_FOUND` (ítem inexistente, o de otro usuario/carrito) ·
`409 INSUFFICIENT_STOCK`

---

#### `DELETE /api/cart/items/{itemId}` — eliminar un ítem

**Parámetros de ruta:** `itemId` (UUID)

```bash
curl -X DELETE http://localhost:8080/api/cart/items/<cartItemId> \
  -H "Authorization: Bearer <token-user>"
```

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
  ante peticiones concurrentes (ADR-015).
- **Total:** `subtotal` (suma de `unitPrice × quantity`) + envío fijo
  (`checkout.shipping-fee`, por defecto `5000.00` COP) → `total`.
- **Pago simulado:** cualquier tarjeta se acepta **salvo** la cuyos dígitos
  terminen en `0002` (configurable vía `checkout.card-declined-suffix`). Un
  pago confirmado genera un `transactionId` `SIM-<uuid>`; todo intento se
  persiste en la tabla `payments` (confirmado o rechazado).
- **Rechazo del pago:** la orden se persiste con estado `PENDING`, el pago
  como `FAILED`, y la petición responde `402 PAYMENT_DECLINED` con el
  `orderNumber` en el `message`.
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
| `payment` | `PaymentData` | requerido, validado en cascada (`@Valid`) |

**`payment`** ([`PaymentData`](../backend/src/main/java/com/ingesoft/shop/dto/request/PaymentData.java)):

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `method` | string | requerido, máx. 30 caracteres (p. ej. `"card"`) |
| `cardNumber` | string | requerido, máx. 25 caracteres. En el proveedor simulado, los dígitos que terminen en `0002` se rechazan |
| `cardholderName` | string | **opcional**, máx. 100 caracteres |

**Exito** (tarjeta válida; después de haber agregado ítems al carrito):

```bash
curl -X POST http://localhost:8080/api/checkout \
  -H "Authorization: Bearer <token-user>" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": "Calle 45 # 12-30, Bogotá",
    "payment": { "method": "card", "cardNumber": "4242424242424242" }
  }'
```

**Respuesta `201 Created`** ([`OrderResponse`](../backend/src/main/java/com/ingesoft/shop/dto/response/OrderResponse.java)):

```json
{
  "id": "b7e2c4d8-9a1f-4c3e-8d2b-5f6a7c8d9e0f",
  "orderNumber": "ORD-1A2B3C4D",
  "status": "PAID",
  "subtotal": 59800.00,
  "shipping": 5000.00,
  "total": 64800.00,
  "shippingAddress": "Calle 45 # 12-30, Bogotá",
  "createdAt": "2026-11-22T03:00:00Z",
  "items": [
    {
      "productId": "00000000-0000-0000-0000-000000000105",
      "productName": "Cable USB-C 100W",
      "unitPrice": 29900.00,
      "quantity": 2,
      "lineTotal": 59800.00
    }
  ]
}
```

**Rechazo** (tarjeta cuyos dígitos terminen en `0002`):

```bash
curl -X POST http://localhost:8080/api/checkout \
  -H "Authorization: Bearer <token-user>" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": "Calle 45 # 12-30, Bogotá",
    "payment": { "method": "card", "cardNumber": "4000000000000002" }
  }'
```

**Respuesta `402 PAYMENT_DECLINED`** (la orden `PENDING` y el pago `FAILED`
quedan persistidos; el `message` incluye el `orderNumber` para el reintento):

```json
{
  "status": 402,
  "code": "PAYMENT_DECLINED",
  "message": "El pago fue rechazado. La orden ORD-1A2B3C4D quedó PENDING; reintente el pago con ese número de orden.",
  "timestamp": "2026-11-22T03:00:00Z"
}
```

**Errores:** `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` ·
`404 PRODUCT_NOT_FOUND` (un producto del carrito fue eliminado) ·
`409 CART_EMPTY` (el carrito no tiene ítems) · `409 INSUFFICIENT_STOCK`
(entró una compra concurrente y el stock ya no alcanza) ·
`402 PAYMENT_DECLINED` (la pasarela simulada rechazó la tarjeta)

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

```bash
curl "http://localhost:8080/api/orders/mine?page=0&size=10" \
  -H "Authorization: Bearer <token-user>"
```

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
      "subtotal": 59800.00,
      "shipping": 5000.00,
      "total": 64800.00,
      "shippingAddress": "Calle 45 # 12-30, Bogotá",
      "createdAt": "2026-11-22T03:00:00Z",
      "items": [
        {
          "productId": "00000000-0000-0000-0000-000000000105",
          "productName": "Cable USB-C 100W",
          "unitPrice": 29900.00,
          "quantity": 2,
          "lineTotal": 59800.00
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

```bash
curl http://localhost:8080/api/orders/mine/<orderId> \
  -H "Authorization: Bearer <token-user>"
```

**Respuesta `200 OK`:** `OrderDetailResponse`

```json
{
  "id": "b7e2c4d8-9a1f-4c3e-8d2b-5f6a7c8d9e0f",
  "orderNumber": "ORD-1A2B3C4D",
  "status": "PAID",
  "subtotal": 59800.00,
  "shipping": 5000.00,
  "total": 64800.00,
  "shippingAddress": "Calle 45 # 12-30, Bogotá",
  "createdAt": "2026-11-22T03:00:00Z",
  "items": [
    {
      "productId": "00000000-0000-0000-0000-000000000105",
      "productName": "Cable USB-C 100W",
      "unitPrice": 29900.00,
      "quantity": 2,
      "lineTotal": 59800.00
    }
  ],
  "payment": {
    "status": "CONFIRMED",
    "method": "card",
    "transactionId": "SIM-7c9e4a1d-2b3f-4e5a-9c6d-8e7f0a1b2c3d",
    "failureReason": null,
    "processedAt": "2026-11-22T03:00:00Z"
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
`403 FORBIDDEN` (ejemplo real en [5.4](#54-403-rol-insuficiente)); sin token
(o inválido), `401 UNAUTHORIZED`.

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

```bash
# Todas las órdenes
curl "http://localhost:8080/api/admin/orders?page=0&size=10" \
  -H "Authorization: Bearer <token-admin>"

# Solo las pendientes de pago
curl "http://localhost:8080/api/admin/orders?status=PENDING" \
  -H "Authorization: Bearer <token-admin>"
```

**Respuesta `200 OK`:** `Page<OrderResponse>` (misma forma que
[4.7](#47-orders-consultas-del-usuario)), ordenado por `createdAt` descendente.

**Errores:** `400 VALIDATION_ERROR` (`page`/`size` no numéricos o `status`
inválido) · `401 UNAUTHORIZED` · `403 FORBIDDEN`

---

#### `GET /api/admin/orders/{id}` — detalle de una orden

**Parámetros de ruta:** `id` (UUID de la orden)

```bash
curl http://localhost:8080/api/admin/orders/<orderId> \
  -H "Authorization: Bearer <token-admin>"
```

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

```bash
# PAID -> SHIPPED
curl -X PATCH http://localhost:8080/api/admin/orders/<orderId>/status \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "SHIPPED" }'

# SHIPPED -> DELIVERED
curl -X PATCH http://localhost:8080/api/admin/orders/<orderId>/status \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "DELIVERED" }'

# PAID -> CANCELLED (restaura el stock de cada ítem)
curl -X PATCH http://localhost:8080/api/admin/orders/<orderId>/status \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "CANCELLED" }'
```

**Respuesta `200 OK`:** `OrderDetailResponse` con el estado ya actualizado
(solo se modifica la fila de la orden — y, en su caso, el stock de los
productos — dentro de una transacción).

**Errores:** `400 VALIDATION_ERROR` (`status` ausente o valor no válido del
enum) · `401 UNAUTHORIZED` · `403 FORBIDDEN` · `404 ORDER_NOT_FOUND` ·
`409 ORDER_STATUS_INVALID` (transición no permitida; el `message` incluye el
paso intentado, p. ej. `Transición de estado no permitida: DELIVERED → SHIPPED`)

---

### 4.9 Swagger UI (SpringDoc)

**Autenticación: pública.** Documentación interactiva auto-generada de toda la
API (tags por dominio, ejemplos de request/response):

```bash
# UI interactiva (se abre en el navegador)
curl -I http://localhost:8080/swagger-ui.html

# Especificación OpenAPI en JSON (útil para importar en Postman/Insomnia)
curl http://localhost:8080/v3/api-docs
```

**Respuesta `200 OK`:** la UI en `<http://localhost:8080/swagger-ui.html>`;
`/v3/api-docs` devuelve el documento OpenAPI 3.1 completo.

> Para probar los endpoints con `Authorize` en la UI: usa el token obtenido en
> `POST /api/auth/login`.

---

## 5. Errores típicos demostrables con `curl`

Los tres errores que la prueba técnica pide demostrar, con el `curl` que los
produce y la respuesta real del backend (formato
[§2](#2-formato-de-respuesta-de-error)).

### 5.1 409: stock insuficiente

Con el seed, el **Cable USB-C 100W** (`...0105`) tiene stock **2**. Pedir 5
unidades al carrito es un `409 INSUFFICIENT_STOCK` (y el mismo error sale en
el checkout si la cantidad del carrito supera el stock):

```bash
curl -X POST http://localhost:8080/api/cart/items \
  -H "Authorization: Bearer <token-user>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "00000000-0000-0000-0000-000000000105", "quantity": 5}'
```

```json
{
  "status": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "El producto 'Cable USB-C 100W' no tiene suficiente stock (disponible: 2, solicitado: 5)",
  "timestamp": "2026-11-22T03:00:00Z"
}
```

Otras formas de provocar un `409`:

- **Checkout con carrito vacío** → `409 CART_EMPTY` (después de vaciar el
  carrito, `POST /api/checkout` responde *"El carrito está vacío; agregue
  productos antes de finalizar la compra"*).
- **Transición de estado inválida** → `409 ORDER_STATUS_INVALID`:

  ```bash
  # Sobre una orden DELIVERED, intentar volver a SHIPPED
  curl -X PATCH http://localhost:8080/api/admin/orders/<orderId>/status \
    -H "Authorization: Bearer <token-admin>" \
    -H "Content-Type: application/json" \
    -d '{ "status": "SHIPPED" }'
  ```

  ```json
  {
    "status": 409,
    "code": "ORDER_STATUS_INVALID",
    "message": "Transición de estado no permitida: DELIVERED → SHIPPED",
    "timestamp": "2026-11-22T03:00:00Z"
  }
  ```

### 5.2 409: email ya registrado

Registrar con un email del seed (o repetido):

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Replicado", "email": "user@demo.com", "password": "OtraClave123!"}'
```

```json
{
  "status": 409,
  "code": "EMAIL_ALREADY_REGISTERED",
  "message": "El email user@demo.com ya está registrado",
  "timestamp": "2026-11-22T03:00:00Z"
}
```

### 5.3 402: pago rechazado

Tarjeta cuyos dígitos terminen en `0002` (regla del proveedor simulado,
configurable en `checkout.card-declined-suffix`):

```bash
curl -X POST http://localhost:8080/api/checkout \
  -H "Authorization: Bearer <token-user>" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": "Calle 45 # 12-30, Bogotá",
    "payment": { "method": "card", "cardNumber": "4000000000000002" }
  }'
```

```json
{
  "status": 402,
  "code": "PAYMENT_DECLINED",
  "message": "El pago fue rechazado. La orden ORD-1A2B3C4D quedó PENDING; reintente el pago con ese número de orden.",
  "timestamp": "2026-11-22T03:00:00Z"
}
```

La orden `PENDING` y el pago `FAILED` quedan persistidos (verificables en
`GET /api/admin/orders?status=PENDING` y en la tabla `payments`); el stock
**no** se descuenta.

### 5.4 403: rol insuficiente

Con un token de rol `USER` sobre cualquier ruta `/api/admin/**`:

```bash
curl http://localhost:8080/api/admin/products \
  -H "Authorization: Bearer <token-user>"
```

```json
{
  "status": 403,
  "code": "FORBIDDEN",
  "message": "Acceso denegado: falta un rol requerido.",
  "timestamp": "2026-11-22T03:00:00Z"
}
```

Y sin token (o con token inválido) sobre cualquier ruta protegida (`/api/users/**`,
`/api/cart/**`, `/api/checkout`, `/api/orders/**`, `/api/admin/**`):

```bash
curl http://localhost:8080/api/cart
```

```json
{
  "status": 401,
  "code": "UNAUTHORIZED",
  "message": "No autenticado: falta el token JWT o no es valido.",
  "timestamp": "2026-11-22T03:00:00Z"
}
```

### 5.5 404: no encontrado (órdenes y productos)

```bash
# Orden inexistente o ajena al usuario (mismo mensaje para no revelar existencias)
curl http://localhost:8080/api/orders/mine/00000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer <token-user>"
```

```json
{
  "status": 404,
  "code": "ORDER_NOT_FOUND",
  "message": "La orden 00000000-0000-0000-0000-000000000001 no existe o no es tuya",
  "timestamp": "2026-11-22T03:00:00Z"
}
```

---

## 6. Referencias

- Contrato de endpoints y diseño completo: [`arquitectura.md`](arquitectura.md) §5
- Flujo transaccional del checkout: [`arquitectura.md`](arquitectura.md) §6
- Decisiones relacionadas (JWT, pago simulado, soft delete, carrito): [`decisiones-adr.md`](decisiones-adr.md)
- Documentación interactiva: Swagger UI en <http://localhost:8080/swagger-ui.html>
- Credenciales demo del seed: [`V2__seed.sql`](../backend/src/main/resources/db/migration/V2__seed.sql)
