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

> Los códigos `404 PRODUCT_NOT_FOUND`, `404 ORDER_NOT_FOUND`, `409
> INSUFFICIENT_STOCK`, `409 CART_EMPTY` y `409 ORDER_STATUS_INVALID` ya están
> definidos en `ErrorCode` para los módulos en desarrollo.

---

## 3. Códigos de negocio

Estado actual de [`ErrorCode.java`](../backend/src/main/java/com/ingesoft/shop/exception/ErrorCode.java):

| Código | HTTP | Origen |
|--------|------|--------|
| `EMAIL_ALREADY_REGISTERED` | 409 | Registro o cambio de email con email ya existente |
| `INVALID_CREDENTIALS` | 401 | Login con email/contraseña incorrectos |
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

## 5. Referencias

- Diseño completo y flujo de checkout: [`arquitectura.md`](arquitectura.md)
- Decisiones relacionadas (JWT, pago simulado, soft delete): [`decisiones-adr.md`](decisiones-adr.md)
- Credenciales demo del seed: [README.md](../README.md)
