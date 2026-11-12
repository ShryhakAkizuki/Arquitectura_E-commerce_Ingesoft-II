# E-commerce simplificado con checkout

> **Arquitectura E-commerce Ingesoft II** — Prueba técnica FullStack, Ingeniería de Software II (Ingesoft).

E-commerce de un solo dominio (productos de tecnología) con registro de usuario,
catálogo, carrito, checkout y pago **simulado**. El proyecto se desarrolla de
manera incremental: la documentación describe **solo lo implementado hasta el
último commit** y las secciones de cada módulo se añaden cuando el módulo se
implementa.

**Última actualización de la documentación:** 2026-11-12.

---

## Estado del proyecto (por módulo)

| Módulo | Notas |
|--------|-------|
| **Infraestructura** (Spring Boot, Maven, Flyway, perfiles) | Perfil `postgres` (default) y `h2` (plan B sin PostgreSQL); esquema completo versionado |
| **Esquema de BD completo** (users, products, carts, cart_items, orders, order_items, payments) | [`V1__init.sql`](backend/src/main/resources/db/migration/V1__init.sql) + seed demo en [`V2__seed.sql`](backend/src/main/resources/db/migration/V2__seed.sql) |
| **Auth** (registro, login, JWT, perfil propio) | Endpoints `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/users/me`, `PUT /api/users/me` |
| **Catálogo** (listado público, detalle, CRUD + stock admin) | Endpoints `GET /api/products`, `GET /api/products/{id}`, `GET|POST|PUT|DELETE|PATCH /api/admin/products/**` |
| **Carrito** (ver, agregar, cambiar cantidad, eliminar ítem) | Endpoints `GET /api/cart`, `POST /api/cart/items`, `PATCH|DELETE /api/cart/items/{itemId}`; validación de stock `INSUFFICIENT_STOCK` |
| **Checkout** (crear orden con pago simulado) | Endpoint `POST /api/checkout`; transaccional con bloqueos pesimistas (`SELECT ... FOR UPDATE`) contra sobreventa; pago simulado con tarjeta de rechazo configurable; la orden queda `PENDING` si el pago se rechaza |
| **Seguridad** (Spring Security, roles, filtros JWT, errores 401/403) | Política de rutas por rol en [`SecurityConfig.java`](backend/src/main/java/com/ingesoft/shop/config/SecurityConfig.java) |
| **Excepciones globales** (contrato de error `ApiError` + `ErrorCode`) | [`GlobalExceptionHandler.java`](backend/src/main/java/com/ingesoft/shop/exception/GlobalExceptionHandler.java) |
| **Documentación** (arquitectura, API, ADRs, SOLID/DRY) | Carpeta [`docs/`](docs) |

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/arquitectura.md](docs/arquitectura.md) | Visión de conjunto, capas, flujo de una petición, estado por módulo |
| [docs/api.md](docs/api.md) | Endpoints implementados (Auth, Users, Products, Carrito, Checkout), contrato de errores, credenciales demo |
| [docs/decisiones-adr.md](docs/decisiones-adr.md) | Decisiones de arquitectura registradas (ADR-001 – ADR-006, ADR-011 – ADR-015) |
| [docs/solid-dry.md](docs/solid-dry.md) | Evidencias de principios SOLID y DRY en el código implementado |

Documentación interactiva de la API (Swagger UI, disponible al ejecutar el backend):
<http://localhost:8080/swagger-ui.html>

---

## Stack tecnológico

### Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Java | 17 | Lenguaje del backend |
| Spring Boot | 3.5.x | Framework principal |
| Spring Security | 6.x (gestionado) | Autenticación JWT, roles, política de rutas |
| Spring Data JPA | 3.x (gestionado) | Persistencia (Hibernate) |
| Bean Validation | 3.x (gestionado) | Validación de entrada en DTOs (`@Valid`) |
| JJWT | 0.12.7 | Emisión y validación de tokens JWT (HS256) |
| Flyway | 10.x (gestionado) | Migraciones versionadas del esquema |
| PostgreSQL | 15+ | Base de datos local (perfil por defecto) |
| H2 | 2.x (runtime) | Base de datos embebida (perfil `h2`, plan B para máquinas sin PostgreSQL) |
| SpringDoc OpenAPI | 2.10.0 | Swagger UI / OpenAPI |
| Checkstyle | 10.26.1 | Linter, corrió en fase `validate` de Maven |
| JUnit 5 + Mockito | (test) | Pruebas unitarias |
| spring-security-test | (test) | Pruebas de contrato de API con MockMvc |

### Frontend (en desarrollo)

| Tecnología | Propósito |
|------------|-----------|
| React | UI (pendiente de inicializar en [`frontend/`](frontend)) |

### Raíz del monorepo

| Herramienta | Propósito |
|-------------|-----------|
| Node.js ≥ 18 + `concurrently` | Script `npm run dev` que levanta backend y frontend a la vez |

---

## Estructura del proyecto

```
Arquitectura_E-commerce_Ingesoft-II/
├── package.json                  # Scripts del monorepo (npm run dev)
├── LICENSE
├── README.md
├── docs/                         # Documentación del proyecto
│   ├── api.md
│   ├── arquitectura.md
│   ├── decisiones-adr.md
│   └── solid-dry.md
├── scripts/
│   └── .gitkeep
├── frontend/                     # Frontend (por implementar)
│   └── .gitkeep
└── backend/
    ├── mvnw / mvnw.cmd           # Maven Wrapper
    ├── pom.xml
    ├── checkstyle.xml            # Reglas del linter
    ├── .mvn/                     # Config del Maven Wrapper
    └── src/
        ├── main/
        │   ├── java/com/ingesoft/shop/
        │   │   ├── ShopApplication.java            # Punto de entrada Spring Boot
        │   │   ├── config/
        │   │   │   ├── CorsConfig.java             # CORS para el frontend (localhost:5173)
        │   │   │   └── SecurityConfig.java         # Política de rutas y roles, BCrypt, 401/403
        │   │   ├── controller/
        │   │   │   ├── AdminProductController.java
        │   │   │   ├── AuthController.java
        │   │   │   ├── CartController.java
        │   │   │   ├── CheckoutController.java
        │   │   │   ├── ProductController.java
        │   │   │   └── UserController.java
        │   │   ├── dto/
        │   │   │   ├── request/
        │   │   │   │   ├── AddCartItemRequest.java
        │   │   │   │   ├── AdjustStockRequest.java
        │   │   │   │   ├── CheckoutRequest.java
        │   │   │   │   ├── LoginRequest.java
        │   │   │   │   ├── PaymentData.java
        │   │   │   │   ├── ProductRequest.java
        │   │   │   │   ├── RegisterRequest.java
        │   │   │   │   ├── UpdateCartItemRequest.java
        │   │   │   │   └── UpdateProfileRequest.java
        │   │   │   └── response/
        │   │   │       ├── CartItemResponse.java
        │   │   │       ├── CartResponse.java
        │   │   │       ├── LoginResponse.java
        │   │   │       ├── OrderResponse.java
        │   │   │       ├── ProductResponse.java
        │   │   │       └── UserResponse.java
        │   │   ├── entity/
        │   │   │   ├── Cart.java
        │   │   │   ├── CartItem.java
        │   │   │   ├── Order.java
        │   │   │   ├── OrderItem.java
        │   │   │   ├── Payment.java
        │   │   │   ├── Product.java
        │   │   │   └── User.java
        │   │   ├── enums/
        │   │   │   ├── OrderStatus.java
        │   │   │   ├── PaymentStatus.java
        │   │   │   └── Role.java
        │   │   ├── exception/
        │   │   │   ├── ApiError.java
        │   │   │   ├── BusinessException.java
        │   │   │   ├── ErrorCode.java
        │   │   │   └── GlobalExceptionHandler.java
        │   │   ├── repository/
        │   │   │   ├── CartItemRepository.java
        │   │   │   ├── CartRepository.java
        │   │   │   ├── OrderItemRepository.java
        │   │   │   ├── OrderRepository.java
        │   │   │   ├── PaymentRepository.java
        │   │   │   ├── ProductRepository.java
        │   │   │   └── UserRepository.java
        │   │   ├── security/
        │   │   │   ├── AppUserDetailsService.java
        │   │   │   ├── JwtAuthFilter.java
        │   │   │   └── JwtTokenProvider.java(HS256)
        │   │   └── service/
        │   │       ├── IAuthService.java
        │   │       ├── ICartService.java
        │   │       ├── ICheckoutService.java
        │   │       ├── IPaymentService.java
        │   │       ├── IProductAdminService.java
        │   │       ├── IProductService.java
        │   │       ├── impl/
        │   │       │   ├── AuthServiceImpl.java
        │   │       │   ├── CartServiceImpl.java
        │   │       │   ├── CheckoutServiceImpl.java
        │   │       │   ├── PaymentServiceImpl.java
        │   │       │   ├── ProductAdminServiceImpl.java
        │   │       │   └── ProductServiceImpl.java
        │   │       └── payment/                  # Abstracción de la pasarela de pago
        │   │           ├── IPaymentProvider.java
        │   │           ├── PaymentResult.java
        │   │           └── SimulatedPaymentProvider.java
        │   └── resources/
        │       ├── application.yml
        │       └── db/migration/
        │           ├── V1__init.sql
        │           └── V2__seed.sql
        └── test/
```

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|-------------|----------------|-------|
| JDK | 17 | Se recomienda 17 LTS o superior |
| Maven | 3.8+ | **No es necesario instalarlo**: el proyecto incluye `mvnw` / `mvnw.cmd` (Maven Wrapper) |
| Node.js | ≥ 18 | Solo para el script raíz `npm run dev` (concurrently). El frontend aún no está implementado |
| PostgreSQL | 15+ | **Requerida** para el perfil por defecto. Sin PostgreSQL use el perfil `h2` (plan B, ver [Ejecución](#ejecución)) |

### Base de datos (perfil por defecto: `postgres`)

Cree la base de datos local:

```sql
CREATE DATABASE shop;
```

Las credenciales de conexión están fijadas en
[`application.yml`](backend/src/main/resources/application.yml)
(usuario `postgres`, contraseña `admin`, host `localhost:5432`): Las cuales seran cambiadas eventualmente a variables de entorno para mayor seguridad.

El resto (tablas, índices, datos demo) lo crea **Flyway automáticamente** al
iniciar el backend: no hay scripts manuales que ejecutar.

> ¿Sin PostgreSQL? Use el perfil `h2` (base de datos embebida en memoria con
> `MODE=PostgreSQL` y las mismas migraciones):
> `mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=h2`.

### Variables de entorno

[`application.yml`](backend/src/main/resources/application.yml) expone un único
placeholder de entorno (convención `${VAR:default}`):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `JWT_SECRET` | placeholder de desarrollo (64+ chars) | Clave HMAC-SHA256 con que se firman los tokens JWT. **Debe exportarse un valor propio en cualquier entorno que no sea desarrollo local** |

El resto de la configuración (datasource, expiración del token de 2 h,
parámetros del checkout) está fijada directamente en el `application.yml`.

---

## Ejecución

### 1. Backend

```bash
cd backend
```

**Opción A — Perfil `postgres` (default, requiere PostgreSQL local):**

```bash
# Windows (cmd)
mvnw.cmd spring-boot:run
# Linux / macOS
./mvnw spring-boot:run
```

**Opción B — Perfil `h2` (plan B, sin PostgreSQL):**

```bash
# Windows (cmd)
mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=h2
# Linux / macOS
./mvnw spring-boot:run -Dspring-boot.run.profiles=h2
```

El backend queda disponible en <http://localhost:8080>.
Swagger UI: <http://localhost:8080/swagger-ui.html>.

### 2. Frontend

⏳ **Aún no implementado.** Cuando exista código en [`frontend/`](frontend),
la intención es:

```bash
cd frontend
npm install
npm run dev   # Vite → http://localhost:5173
```

### 3. Todo junto (script raíz)

```bash
npm install   # una sola vez
npm run dev   # levanta backend y frontend con concurrently
```

> Mientras `frontend/` esté vacío, `npm run dev` falla en el proceso
> `frontend` (no hay `package.json`); el backend sí arranca.

### Pruebas

```bash
cd backend
mvnw.cmd test     # Windows
./mvnw test       # Linux/macOS
```

> El linter **Checkstyle** corre automáticamente en la fase `validate` de
> Maven (ver [backend/pom.xml](backend/pom.xml)): cualquier build o test falla
> si el código viola [checkstyle.xml](backend/checkstyle.xml).

---

## Credenciales demo (seed)

El seed [`V2__seed.sql`](backend/src/main/resources/db/migration/V2__seed.sql)
inserta de forma determinista (hashes BCrypt precomputados):

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `admin@demo.com` | `Admin123!` |
| Usuario | `user@demo.com` | `User123!` |

También se insertan 8 productos demo (precios en COP; el de stock bajo,
`Cable USB-C 100W`, sirve para demostrar `409 INSUFFICIENT_STOCK` al agregarlo
al carrito o al hacer checkout).

Para el checkout simulado, cualquier tarjeta se acepta **salvo** las que tienen
sus dígitos terminados en `0002` (configurable vía `checkout.card-declined-suffix`):
sirven para demostrar `402 PAYMENT_DECLINED` (la orden queda `PENDING`).

---

## Endpoints implementados

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| `POST` | `/api/auth/register` | No | Registrar usuario (siempre rol `USER`) |
| `POST` | `/api/auth/login` | No | Iniciar sesión → devuelve token JWT + datos del usuario |
| `GET` | `/api/users/me` | JWT | Datos del usuario autenticado |
| `PUT` | `/api/users/me` | JWT | Actualizar nombre, email y/o contraseña |
| `GET` | `/api/products` | No | Catálogo público paginado (búsqueda y orden) |
| `GET` | `/api/products/{id}` | No | Detalle de un producto disponible |
| `GET` | `/api/admin/products` | JWT + `ADMIN` | Listado completo (incluye desactivados) |
| `POST` | `/api/admin/products` | JWT + `ADMIN` | Crear producto |
| `PUT` | `/api/admin/products/{id}` | JWT + `ADMIN` | Actualizar producto |
| `DELETE` | `/api/admin/products/{id}` | JWT + `ADMIN` | Desactivar producto (soft delete) |
| `PATCH` | `/api/admin/products/{id}/stock` | JWT + `ADMIN` | Ajustar stock absoluto |
| `GET` | `/api/cart` | JWT | Carrito del usuario (se crea si no existe) |
| `POST` | `/api/cart/items` | JWT | Agregar producto (acumula la cantidad si ya está en el carrito) |
| `PATCH` | `/api/cart/items/{itemId}` | JWT | Cambiar la cantidad absoluta de un ítem |
| `DELETE` | `/api/cart/items/{itemId}` | JWT | Eliminar un ítem del carrito |
| `POST` | `/api/checkout` | JWT | Crear orden con pago simulado; descuenta stock y vacía el carrito si el pago se confirma |

Detalle completo (bodies, códigos de error, ejemplos) en
[docs/api.md](docs/api.md).

---

## Licencia

Véase [LICENSE](LICENSE).
