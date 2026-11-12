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
5. [Rutas reservadas (módulos en desarrollo)](#5-rutas-reservadas-módulos-en-desarrollo)
6. [Referencias](#6-referencias)

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
| 402 | Pago requerido (reservado) | La pasarela simulada rechazó el pago (`PAYMENT_DECLINED`) |
| 403 | No autorizado | Usuario sin el rol requerido sobre la ruta |
| 404 | No encontrado | Ruta inexistente; usuario inexistente |
| 405 | Método no permitido | Método HTTP no soportado sobre la ruta |
| 409 | Conflicto | Email ya registrado (registro o cambio de perfil) |
| 500 | Error interno | Fallo no controlado (última línea de defensa; el detalle solo va a log) |

---

## 3. Códigos de negocio

Estado actual de [`ErrorCode.java`](../backend/src/main/java/com/ingesoft/shop/exception/ErrorCode.java):

| Código | HTTP | Origen |
|--------|------|--------|
| `EMAIL_ALREADY_REGISTERED` | 409 | Registro o cambio de email con email ya existente |
| `INVALID_CREDENTIALS` | 401 | Login con email/contraseña incorrectos |
| `PRODUCT_NOT_FOUND` | 404 | Producto inexistente (para el público: igual si está desactivado) |
| `UNAUTHORIZED` | 401 | Token ausente, inválido o expirado |
| `FORBIDDEN` | 403 | Rol insuficiente para la ruta |
| `VALIDATION_ERROR` | 400 | Validación de entrada fallida (bean validation / parámetros) |
| `NOT_FOUND` | 404 | Ruta no existe o usuario inexistente |
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

## 6. Referencias

- Diseño completo y flujo de checkout: [`arquitectura.md`](arquitectura.md)
- Decisiones relacionadas (JWT, pago simulado, soft delete): [`decisiones-adr.md`](decisiones-adr.md)
- Credenciales demo del seed: [README.md](../README.md)
