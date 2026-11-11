# Arquitectura_E-commerce_Ingesoft-II

Prueba técnica para la asignatura de **Ingeniería de Software II (Ingesoft II)**.

E-commerce simplificado con checkout: catálogo de productos, carrito, registro/login con JWT, pasarela de pago simulada y panel de administración.

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Java 17 · Spring Boot 3.x · Spring Security + JWT · Spring Data JPA · Flyway · SpringDoc (Swagger) |
| Base de datos | PostgreSQL 14+ (con perfil alternativo `h2` en memoria) |
| Frontend | React 18 · TypeScript · Vite · CSS Modules |
| Monorepo | npm + [`concurrently`](https://www.npmjs.com/package/concurrently) (scripts raíz) |

## Requisitos previos

- **JDK 17** — el backend usa el Maven wrapper (`mvnw` / `mvnw.cmd`), no es necesario instalar Maven.
- **Node.js 18+** — y npm.
- **PostgreSQL 14+** corriendo localmente.
  - ¿No tienes PostgreSQL instalado? Usa el perfil `h2` en memoria del backend (ver [Plan B](#plan-b-sin-postgresql)).

## Estructura del proyecto

```
Arquitectura_E-commerce_Ingesoft-II/
├── package.json                  # scripts raiz (concurrently)
├── README.md                     # guia de arranque y uso
├── backend/                      # Spring Boot + Maven
│   ├── pom.xml
│   ├── mvnw, mvnw.cmd            # Maven wrapper (version consistente)
│   └── src
│       ├── main
│       │   ├── java/com/ingesoft/shop
│       │   │   ├── config/       # SecurityConfig, OpenApiConfig, CorsConfig
│       │   │   ├── controller/   # Auth, User, Product, Cart, Checkout, Order, Admin
│       │   │   ├── dto/          # request/ y response/ por dominio
│       │   │   ├── exception/    # GlobalExceptionHandler + excepciones de negocio
│       │   │   ├── security/     # JwtTokenProvider, JwtAuthFilter, UserDetailsService
│       │   │   ├── service/      # interfaces I*Service + implementaciones
│       │   │   │   └── payment/  # IPaymentProvider + SimulatedPaymentProvider
│       │   │   ├── repository/   # Spring Data JPA
│       │   │   ├── entity/       # entidades JPA
│       │   │   └── enums/        # Role, OrderStatus, PaymentStatus
│       │   └── resources
│       │       ├── application.yml
│       │       └── db/migration/ # Flyway V1__init.sql, V2__seed.sql
│       └── test                  # pruebas unitarias e integracion
├── frontend/                     # React 18 + Vite + TypeScript
│   ├── src
│   │   ├── api/                  # cliente axios + funciones por dominio
│   │   ├── components/           # UI reutilizable (ProductCard, CartItem...)
│   │   ├── context/              # AuthContext, CartContext
│   │   ├── hooks/                # useAuth, useCart
│   │   ├── pages/                # Catalog, ProductDetail, Cart, Checkout, Profile...
│   │   ├── pages/admin/          # AdminProducts, AdminOrders
│   │   └── types/                # tipos TypeScript compartidos
│   └── ...
├── scripts/                      # utilidades (seed extra, verificacion e2e)
├── docs/
│   ├── arquitectura.md           # documento de arquitectura
│   ├── decisiones-adr.md         # registros de decisiones
│   ├── solid-dry.md              # evidencias por principio
│   ├── api.md                    # guia de endpoints
│   └── guia-sustentacion.md      # guion de la defensa
└── .env/                         # enunciado (no tocar)
```

## Arranque

### 1. Base de datos

Crea la base de datos local `shop`:

```sql
CREATE DATABASE shop;
```

El esquema y los datos de ejemplo los crea **Flyway** automáticamente al arrancar el backend (`V1__init.sql` + `V2__seed.sql`); no hay que ejecutar scripts manualmente.

### 2. Instalar dependencias

```bash
# Raíz: scripts de desarrollo (concurrently)
npm install

# Backend: el Maven wrapper descarga las dependencias al compilar
cd backend && mvnw.cmd -q compile   # Linux/macOS: ./mvnw -q compile

# Frontend
cd frontend && npm install
```

### 3. Ejecutar

**Opción A — todo junto desde la raíz** (backend y frontend en paralelo):

```bash
npm run dev
```

**Opción B — en terminales separadas:**

```bash
npm run backend   # API en http://localhost:8080
npm run frontend  # SPA en  http://localhost:5173
```

| Servicio | URL |
|----------|-----|
| Frontend | <http://localhost:5173> |
| Backend (API) | <http://localhost:8080> |
| Swagger UI | <http://localhost:8080/swagger-ui.html> |

## Plan B: sin PostgreSQL

Si no hay PostgreSQL disponible (p. ej. máquina de sustentación), arranca el backend con el perfil `h2` en memoria:

```bash
cd backend
mvnw.cmd spring-boot:run -Dspring-boot.run.arguments=--spring.profiles.active=h2
```

- Flyway migra igualmente (`V1` + `V2`), así que el esquema y el seed existen igual.
- Los datos se pierden al detener la aplicación (BD en memoria).

## Credenciales demo (seed)

Usuarios insertados por `V2__seed.sql`:

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | `admin@demo.com` | `Admin123!` |
| Usuario | `user@demo.com` | `User123!` |

El seed incluye además 8 productos de ejemplo (uno con stock bajo, para demostrar `INSUFFICIENT_STOCK`).

## Pruebas

```bash
# Backend (JUnit 5 + Mockito + Testcontainers/integración)
cd backend && mvnw.cmd test

# Frontend
cd frontend && npm test
```

## Documentación y entregables

| Entregable | Ubicación |
|-----------|-----------|
| Código backend | [`backend/`](backend/) |
| Código frontend | [`frontend/`](frontend/) |
| Arquitectura | `docs/arquitectura.md` |
| Decisiones técnicas (ADR) | `docs/decisiones-adr.md` |
| Evidencias SOLID/DRY | `docs/solid-dry.md` |
| Documentación de API | `docs/api.md` + Swagger UI en `/swagger-ui.html` |
| Guía de sustentación | `docs/guia-sustentacion.md` |
| Pruebas ejecutables | `backend/src/test`, `frontend/src/**/tests` |
| README de arranque | este archivo |

> El enunciado de la prueba técnica vive en `.env/` y **no debe modificarse**.
