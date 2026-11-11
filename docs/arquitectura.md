# Arquitectura — E-commerce simplificado con checkout

**Proyecto:** Prueba técnica para la asignatura **Ingeniería de Software II (Ingesoft II)**
**Stack:** Java 17 · Spring Boot 3.5 · React 18 + TypeScript · PostgreSQL
**Alcance:** MVP local, ejecutable con scripts, listo para sustentación

## 1. Resumen

Tienda online con autenticación por roles (usuario/administrador), gestión CRUD de productos y stock, carrito de compras persistente, checkout con pago simulado y trazabilidad de órdenes. La arquitectura prioriza **capas bien separadas**, **interfaces que desacoplan módulos** y **documentación como entregable**, para cumplir los criterios de evaluación (buenas prácticas, SOLID, DRY, sustentación).

### 1.1 Trazabilidad de requerimientos

| # | Requerimiento | Módulo responsable | Evidencia |
|---|---------------|--------------------|-----------|
| R1 | Autenticación y gestión de usuarios segura | `backend: auth` (JWT + BCrypt) | Endpoints `/api/auth/*`, `/api/users/me` |
| R2 | CRUD productos, stock y órdenes para administradores | `backend: catalog` y `orders` con `@PreAuthorize("hasRole('ADMIN')")` | Endpoints `/api/admin/*` |
| R3 | Carrito y checkout fluidos | `backend: cart` + `checkout`; `frontend: cart` | Flujo documentado|
| R4 | Validaciones de stock y pagos | `CartService` y `CheckoutService` transaccional | Pruebas unitarias |
| R5 | Interfaz clara de productos y detalles | `frontend: catalog` | Páginas catálogo y detalle |

### 1.2 Criterios de evaluación → estrategia

| Criterio | Cómo se cumple |
|----------|----------------|
| Buenas prácticas | Convenciones por capas, DTOs de entrada/salida, manejo global de errores, validación con Bean Validation, Checkstyle en el build |
| SOLID | Mapa explícito + evidencias en [`solid-dry.md`](solid-dry.md) |
| DRY | Reglas de negocio únicas en servicios, capa presentacional delgada, reutilización de componentes |
| Sustentación | Arquitectura por capas, diagramas, ADRs en [`decisiones-adr.md`](decisiones-adr.md) y [`guia-sustentacion.md`](guia-sustentacion.md) |
| Pruebas unitarias | JUnit 5 + Mockito en backend, Vitest + RTL en frontend |

## 3. Visión general de la arquitectura

```mermaid
flowchart TB
    subgraph Cliente
        B[Navegador]
    end

    subgraph FrontendReactTS
        P[Paginas]
        C[Contextos Auth y Cart]
        A[Axios con interceptor de token]
    end

    subgraph BackendSpringBoot
        CTRL[Controladores REST]
        SVC[Servicios: reglas de negocio]
        REPO[Repositorios Spring Data JPA]
        SEC[Seguridad JWT]
        PAY[Proveedor de pago simulado]
    end

    DB[(PostgreSQL local)]

    B --> P
    P --> C
    P --> A
    A -- HTTP JSON + JWT --> CTRL
    CTRL --> SVC
    SVC --> REPO
    SVC --> PAY
    SEC -. valida token .-> CTRL
    REPO --> DB
```

### 3.1 Capas backend y regla de dependencias

```
Controller → Service (interface) → Repository → Database
      ↓              ↓
     DTO        Entity/DTO
```

- Los **controladores** solo traducen HTTP → DTO → servicio → HTTP. No contienen reglas de negocio.
- Los **servicios** se programan contra **interfaces** (`IProductService`, `ICartService`, `ICheckoutService`, `IPaymentProvider`); la implementación se inyecta por el contenedor.
- Los **repositorios** son la única capa que conoce a las entidades JPA. Los servicios devuelven DTOs hacia afuera (la entidad no "fuga" fuera de la capa de datos).
- **Paginación y búsqueda** vía `Pageable` de Spring Data, no en el controlador.
- **Calidad de código:** Checkstyle corre en la fase `validate` del build (severidad `warning` ya rompe el build), configuración en [`checkstyle.xml`](../backend/checkstyle.xml).

## 4. Diseño de base de datos

```mermaid
erDiagram
    USERS ||--o{ CARTS : tiene
    USERS ||--o{ ORDERS : realiza
    CARTS ||--|{ CART_ITEMS : contiene
    PRODUCTS ||--o{ CART_ITEMS : "referencia en"
    ORDERS ||--|{ ORDER_ITEMS : contiene
    PRODUCTS ||--o{ ORDER_ITEMS : "referencia en"
    ORDERS ||--|| PAYMENTS : paga_con

    USERS {
        uuid id PK
        string name
        string email UK
        string password_hash
        string role
        boolean active
        timestamptz created_at
    }
    PRODUCTS {
        uuid id PK
        string name
        string description
        numeric price
        int stock
        string image_url
        boolean available
        timestamptz updated_at
    }
    CARTS {
        uuid id PK
        uuid user_id FK,UK
    }
    CART_ITEMS {
        uuid id PK
        uuid cart_id FK
        uuid product_id FK
        int quantity
        numeric unit_price
    }
    ORDERS {
        uuid id PK
        uuid user_id FK
        string order_number UK
        string status
        numeric subtotal
        numeric shipping
        numeric total
        string shipping_address
        timestamptz created_at
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        string product_name
        numeric unit_price
        int quantity
    }
    PAYMENTS {
        uuid id PK
        uuid order_id FK
        string status
        string provider
        string method
        string transaction_id
        numeric amount
        string failure_reason
        timestamptz processed_at
    }
```

El esquema implementado en [`V1__init.sql`](../backend/src/main/resources/db/migration/V1__init.sql) coincide con este ER. **Decisiones clave** (registro completo en [`decisiones-adr.md`](decisiones-adr.md)):

| Decisión | Justificación | ADR |
|----------|---------------|-----|
| `ORDER_ITEMS` denormaliza `product_name` y `unit_price` | Una orden es un **histórico inmutable**: si el admin cambia el precio o el nombre después, la orden no se modifica | ADR-008 |
| `CART_ITEMS.unit_price` se captura al momento de agregar | El carrito refleja el precio vigente cuando el usuario agregó el producto; se re-valida en checkout | ADR-011 |
| `PAYMENTS` con `transaction_id` y `failure_reason` | Trazabilidad: se puede demostrar el flujo de pago rechazado con evidencia | ADR-007 |
| Enums de dominio como `VARCHAR` + `CHECK` | Portabilidad PostgreSQL/H2 (H2 no soporta `CREATE TYPE ... AS ENUM`) | ADR-004 |
| Índices en `orders.user_id`, `orders.status`, `products.available`, `cart_items.cart_id` | Consultas frecuentes (mis órdenes, listado admin, catálogo activo, carga de carrito) | ADR-002 |

**Migraciones con Flyway** (`V1__init.sql`, `V2__seed.sql`): esquema versionado, reproducible y dueño único del esquema (`ddl-auto: validate`). Seed determinístico: 1 admin, 1 usuario y 8 productos (uno con stock bajo para demostrar `INSUFFICIENT_STOCK`).

### 4.1 Estados

**Ciclo de vida de la orden:**

```mermaid
stateDiagram-v2
    [*] --> PENDING : checkout con pago rechazado
    [*] --> PAID : pago exitoso
    PAID --> SHIPPED : admin envia
    SHIPPED --> DELIVERED : admin confirma entrega
    PAID --> CANCELLED : admin cancela y restaura stock
    PENDING --> PAID : reintento de pago
    PENDING --> CANCELLED : admin cancela
```

**Ciclo de vida del pago:**

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> CONFIRMED : provider acepta
    PENDING --> FAILED : provider rechaza
```

## 5. Seguridad (R1)

- **JWT** HS256 con expiración de 2 h (configurable en `application.yml`). El token se emite en `/api/auth/login` y se envía en header `Authorization: Bearer <token>`.
- **BCrypt** para hashes de contraseña (nunca en texto plano; fuerza 10).
- **Roles:** `USER` y `ADMIN`. Rutas admin protegidas con `@PreAuthorize("hasRole('ADMIN')")`; `/api/users/me` solo con el propio JWT.
- **CORS** restringido al origen del frontend local (`http://localhost:5173`).
- **Validación de entrada** en registro/login (email válido, longitud de contraseña) con Bean Validation.

```mermaid
sequenceDiagram
    participant F as Frontend
    participant C as AuthController
    participant S as AuthService
    participant J as JwtTokenProvider

    F->>C: POST /api/auth/register
    C->>S: register(dto)
    S-->>F: 201 Created
    F->>C: POST /api/auth/login
    C->>S: login(email, password)
    S->>J: generateToken(user)
    J-->>S: jwt
    S-->>F: 200 + token + perfil
    Note over F: interceptor axios agrega el token a cada peticion
```

## 6. Contrato API

Base URL: `http://localhost:8080/api`. La referencia completa por endpoint con ejemplos `curl`, formato de error y códigos de negocio está en [`api.md`](api.md). Resumen:

| Dominio | Endpoints | Acceso |
|---------|-----------|--------|
| Auth | `POST /auth/register`, `POST /auth/login` | Público |
| Users | `GET /users/me`, `PUT /users/me` | Usuario |
| Products | `GET /products`, `GET /products/{id}` | Público |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/{itemId}`, `DELETE /cart/items/{itemId}` | Usuario |
| Checkout | `POST /checkout` | Usuario |
| Orders | `GET /orders/mine`, `GET /orders/mine/{id}` | Usuario |
| Admin | `GET/POST /admin/products`, `PUT/DELETE /admin/products/{id}`, `PATCH /admin/products/{id}/stock`, `GET /admin/orders`, `GET /admin/orders/{id}`, `PATCH /admin/orders/{id}/status` | Admin |
| Docs | `/swagger-ui.html` | Público |

**Formato de error estándar** (todo el backend responde igual):

```json
{
  "status": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "El producto 'Cable USB-C' no tiene suficiente stock (disponible: 2, solicitado: 5)",
  "timestamp": "2026-11-09T23:00:00Z"
}
```

Códigos de negocio: `EMAIL_ALREADY_REGISTERED`, `INVALID_CREDENTIALS`, `PRODUCT_NOT_FOUND`, `INSUFFICIENT_STOCK`, `CART_EMPTY`, `PAYMENT_DECLINED`, `ORDER_NOT_FOUND`, `FORBIDDEN`, `ORDER_STATUS_INVALID`.

## 7. Flujo de checkout (R3, R4)

```mermaid
sequenceDiagram
    participant UI as Pagina Checkout
    participant CS as CheckoutService
    participant PS as PaymentService
    participant PP as SimulatedPaymentProvider
    participant DB as PostgreSQL

    UI->>CS: POST /checkout (direccion, metodo, tarjeta)
    CS->>DB: BEGIN TRANSACTION
    CS->>DB: SELECT FOR UPDATE en cart_items
    CS->>CS: validar stock de cada item
    alt Stock insuficiente
        CS-->>UI: 409 INSUFFICIENT_STOCK y rollback
    end
    CS->>DB: crear Order PENDING + OrderItems
    CS->>PS: process(order, paymentData)
    PS->>PP: pay(amount, card)
    PP-->>PS: CONFIRMED o FAILED
    PS->>DB: registrar Payment
    alt Pago confirmado
        CS->>DB: descontar stock, Order a PAID, vaciar carrito
        CS->>DB: COMMIT
        CS-->>UI: 201 + orden completa
    else Pago rechazado
        CS->>DB: Payment FAILED, Order queda PENDING
        CS->>DB: COMMIT
        CS-->>UI: 402 PAYMENT_DECLINED + orderNumber
    end
```

**Reglas de negocio (únicas, en la capa de servicio — DRY):**

1. El carrito debe tener al menos un ítem (`CART_EMPTY`).
2. Stock validado bajo **bloqueo de fila** (`SELECT ... FOR UPDATE`): dos checkouts concurrentes del mismo producto no pueden sobrevender.
3. Subtotal = Σ(cantidad × precio unitario capturado en el carrito). Envío fijo configurado (`checkout.shipping-fee: 5000.00`).
4. El proveedor de pago decide; el servicio de checkout **no conoce** cómo se procesa.
5. Pago fallido → la orden se conserva en `PENDING` para permitir reintento; no se descuenta stock.
6. Cancelación admin de orden `PAID` → el stock se restaura transaccionalmente.
7. **Regla del proveedor simulado:** la tarjeta terminada en `0002` (sufijo configurable: `checkout.card-declined-suffix`) simula rechazo de la pasarela — determinístico, ideal para demostrar el flujo de error en la sustentación.

## 8. Mapa SOLID → código

| Principio | Ejemplo en el proyecto | Elemento |
|-----------|------------------------|----------|
| **S**ingle Responsibility | `CheckoutService` orquesta; la validación de stock, el pago y el descuento de stock son responsabilidades de servicios propios | `CheckoutService`, `PaymentService`, `StockService` |
| **O**pen/Closed | Nuevo gateway = nueva clase `IPaymentProvider` sin tocar `PaymentService` ni `CheckoutService` | `SimulatedPaymentProvider` → gateway real futuro |
| **L**iskov Substitution | Cualquier implementación de `IPaymentProvider` respeta el contrato completo (mismo estado, misma semántica) y es intercambiable en tests | `IPaymentProvider` |
| **I**nterface Segregation | Interfaces pequeñas y específicas: `IProductService` (público) ≠ `IProductAdminService` (admin); `IPaymentProvider` tiene un solo método | `service/` |
| **D**ependency Inversion | Controladores y servicios dependen de interfaces, no de implementaciones; inyección vía constructor | Todo el backend |

**DRY:** una regla de negocio vive en un único servicio (p. ej. "validar stock" solo en `StockService`, y la usan carrito, checkout y cancelación); el frontend no duplica reglas de negocio (validaciones de stock/precio viven en el backend); los tipos TypeScript y los DTOs Java modelan el mismo contrato; componente `ProductCard` único entre catálogo y detalle.

> Evidencias con fragmentos de código real: [`solid-dry.md`](solid-dry.md) *(se completa conforme se implementa cada capa)*.

## 9. Manejo de errores y calidad

- **Backend:** `@ControllerAdvice` global → excepciones de negocio (`BusinessException` con código) mapeadas al formato; `400` para validación, `401/403` para seguridad, `404` para no encontrado, `409` para conflictos de stock/estado, `402` para pago rechazado.
- **Transaccionalidad:** `@Transactional` en operaciones que tocan stock+orden+pago; rollback automático ante cualquier excepción.
- **Frontend:** interceptores centralizados de Axios, estados de carga/error/vacío en cada página de listado, mensajes de error del backend mostrados textualmente.
- **Linters:** Checkstyle (backend, **ya activo** en la fase `validate` del build) + ESLint + Prettier.

## 10. Estrategia de pruebas

| Capa | Herramienta | Casos prioritarios |
|------|-------------|--------------------|
| Servicios backend | JUnit 5 + Mockito | `CheckoutService`: stock insuficiente, pago rechazado (se conserva `PENDING`), éxito (stock descontado y carrito vacío); `PaymentService`: mapeo de estados; `ProductService`: validaciones de creación/actualización; `AuthService`: hash de contraseña y emisión de token |
| API backend | Spring Boot Test + MockMvc | Contrato de `/auth/register`, `/checkout` (409/402/201), permisos admin (403 a usuario común) |
| Componentes frontend | Vitest + React Testing Library | `ProductCard` (agregar al carrito), ítem de carrito (cambiar cantidad), `CheckoutPage` (formulario inválido, resultado de error) |

Cada test documenta **arrangement–action–assertion** y el requerimiento que cubre (comentario `// R4:`) → evidencia directa para la sustentación.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| PostgreSQL no instalado en la máquina de sustentación | Perfil `h2` en memoria (`--spring.profiles.active=h2`), **ya configurado** en `application.yml` y con H2 en `pom.xml` |
| Sobreventa por compras concurrentes | `SELECT ... FOR UPDATE` en checkout + test de concurrencia |
| Alcance que crece en la sustentación | El MVP está acotado a §1.1; mejoras (gateway real, Docker, despliegue) se documentan como roadmap en los ADR, no se implementan |
| Diferencia de versiones JDK/Node | Maven wrapper en backend + `engines` en `package.json` + requisitos en README |
