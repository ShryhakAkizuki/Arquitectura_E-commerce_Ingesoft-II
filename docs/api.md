# Documentación de la API

**Base URL:** `http://localhost:8080/api`
**Formato:** JSON (UTF-8) · **Autenticación:** `Authorization: Bearer <token>`

## Índice

1. [Autenticación](#1-autenticación)
2. [Formato de respuesta de error](#2-formato-de-respuesta-de-error)
3. [Códigos de negocio](#3-códigos-de-negocio)
4. [Endpoints](#4-endpoints)
   - 4.1 Auth 
   - 4.2 Users 
   - 4.3 Products 
   - 4.4 Cart 
   - 4.5 Checkout 
   - 4.6 Orders 
   - 4.7 Admin
5. [Referencias](#5-referencias)

## 1. Autenticación

| Endpoint | Método | Acceso | Descripción |
|----------|--------|--------|-------------|
| `/api/auth/login` | POST | Público | Emite el JWT (2 h de vida) + perfil del usuario |
| `/api/auth/register` | POST | Público | Crea una cuenta (rol `USER` por defecto) |

Flujo típico:

```bash
# 1) Iniciar sesión (credenciales del seed V2__seed.sql)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@demo.com", "password": "User123!"}'

# 2) Usar el token en cada peticion autenticada
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer <token>"
```

Errores de seguridad:

- Token ausente/inválido/expirado → **401** con `code: UNAUTHORIZED` (o `INVALID_CREDENTIALS` en login).
- Token válido pero sin rol → **403** con `code: FORBIDDEN`.

## 2. Formato de respuesta de error

Todo el backend responde los errores con el mismo formato:

```json
{
  "status": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "El producto 'Cable USB-C 100W' no tiene suficiente stock (disponible: 2, solicitado: 5)",
  "timestamp": "2026-11-09T23:00:00Z"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | int | Estado HTTP de la respuesta |
| `code` | string | Código de negocio (estable, para programar contra él) |
| `message` | string | Mensaje legible, listo para mostrar en la UI |
| `timestamp` | string (ISO-8601) | Momento en que se generó el error |

**Mapeo de estados HTTP:**

| HTTP | Significado | Casos típicos |
|------|-------------|----------------|
| 400 | Validación de entrada | Campos requeridos ausentes, email inválido, `MethodArgumentNotValidException` |
| 401 | No autenticado | Login con credenciales inválidas, token inválido o expirado |
| 403 | No autorizado | Usuario común sobre rutas `/admin/**` |
| 402 | Pago rechazado | Checkout con tarjeta `...0002` (`PAYMENT_DECLINED`) |
| 404 | No encontrado | Producto/orden/ítem de carrito inexistente o ajeno al usuario |
| 409 | Conflicto | Email ya registrado, stock insuficiente, transición de estado inválida |

## 3. Códigos de negocio

| Código | HTTP | Origen |
|--------|------|--------|
| `EMAIL_ALREADY_REGISTERED` | 409 | Registro o cambio de email con email ya existente |
| `INVALID_CREDENTIALS` | 401 | Login con email/contraseña incorrectos |
| `UNAUTHORIZED` | 401 | Token ausente, inválido o expirado |
| `FORBIDDEN` | 403 | Rol insuficiente para la ruta |
| `PRODUCT_NOT_FOUND` | 404 | Producto inexistente o desactivado (catálogo público) |
| `ORDER_NOT_FOUND` | 404 | Orden inexistente o ajena al usuario |
| `CART_ITEM_NOT_FOUND` | 404 | Ítem de carrito inexistente |
| `CART_EMPTY` | 409 | Checkout con carrito sin ítems |
| `INSUFFICIENT_STOCK` | 409 | Cantidad solicitada > stock disponible (carrito o checkout) |
| `PAYMENT_DECLINED` | 402 | La pasarela rechazó la tarjeta (sufijo `0002`) |
| `ORDER_STATUS_INVALID` | 409 | Transición de estado de orden no permitida |

## 4. Endpoints


## 5. Referencias

- Diseño completo y flujo de checkout: [`arquitectura.md`](arquitectura.md)
- Decisiones relacionadas (pago simulado, soft delete, denormalización): [`decisiones-adr.md`](decisiones-adr.md)
- Enunciado (fuente del contrato): [`.env/arquitectura.md`](.env/arquitectura.md)
