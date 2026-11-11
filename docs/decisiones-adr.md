# Decisiones de Arquitectura (ADR)

Registro de decisiones técnicas del proyecto.

**Estado de los ADR:**

| ADR | Tema |
|-----|------|
| ADR-001 | Stack tecnológico (Java 17 + Spring Boot 3.5 + React 18 + TS + PostgreSQL) |
| ADR-002 | Flyway como dueño del esquema (`ddl-auto: validate`) |
| ADR-003 | Perfil `h2` en memoria como plan B sin PostgreSQL |
| ADR-004 | Enums de dominio como `VARCHAR` + `CHECK` (portabilidad PG/H2) |
| ADR-005 | Monorepo npm + Maven wrapper, sin Docker (MVP local) |
| ADR-006 | Autenticación stateless: JWT HS256 + BCrypt |
| ADR-007 | Pago simulado con sufijo de tarjeta configurable |
| ADR-008 | Órdenes como histórico inmutable (denormalización de `order_items`) |
| ADR-009 | Carrito 1-a-1 con usuario y `unit_price` capturado al agregar |
| ADR-010 | Soft delete de productos (`available = false`) |
| ADR-011 | Seed determinístico con hashes BCrypt precomputados |
| ADR-012 | Checkstyle en la fase `validate` del build (falla el build ante violación) |

---

## ADR-001 · Stack tecnológico

[`backend/pom.xml`](../backend/pom.xml), [`package.json`](../package.json)

**Contexto:** la prueba técnica exige un MVP local ejecutable, con buenas prácticas, SOLID/DRY y pruebas, en un stack moderno y reconocible para la sustentación.

**Decisión:**
- **Backend:** Java 17 + Spring Boot 3.5 (parent `spring-boot-starter-parent` 3.5.16) con `spring-boot-starter-web`, `security`, `data-jpa`, `validation`, driver PostgreSQL, Flyway, SpringDoc (Swagger) y jjwt 0.12.x.
- **Frontend:** React 18 + TypeScript + Vite + CSS Modules (sin librerías de UI), `react-router-dom` y `axios`.
- **Base de datos:** PostgreSQL 14+ local (BD `shop`), con H2 como respaldo.
- **Monorepo:** `npm` + `concurrently` en la raíz para arrancar backend y frontend a la vez.

**Consecuencias:**
- (+) Ecosistema maduro, inyección de dependencias y convenciones claras (capas, DTOs, Bean Validation) que facilitan demostrar SOLID/DRY.
- (+) SpringDoc genera la documentación interactiva de la API de forma gratuita (`/swagger-ui.html`).
- (−) El frontend debe modelar los tipos del contrato a mano (se mitiga con `src/types/` espejo de los DTOs).

---

## ADR-002 · Flyway como dueño del esquema

[`application.yml`](../backend/src/main/resources/application.yml) (`jpa.hibernate.ddl-auto: validate`), [`V1__init.sql`](../backend/src/main/resources/db/migration/V1__init.sql), [`V2__seed.sql`](../backend/src/main/resources/db/migration/V2__seed.sql)

**Contexto:** el esquema debe ser reproducible en cualquier máquina (desarrollo y sustentación) y las entidades JPA podrían derivar de la BD si Hibernate la crea.

**Decisión:** Flyway crea y migra el esquema (`V1__init.sql` + `V2__seed.sql`) con `flyway.enabled: true` y `locations: classpath:db/migration`. Hibernate queda en `ddl-auto: validate`: solo verifica que entidades y BD coincidan, nunca crea ni altera tablas.

**Consecuencias:**
- (+) Esquema versionado y auditable; el seed es parte de la historia de migraciones (reproducible).
- (+) Cualquier desincronización entidad/BD falla al arrancar (fallo rápido).
- (−) Todo cambio de esquema exige una nueva migración `Vn__*.sql` (disciplina, no inconveniente real para un MVP).

---

## ADR-003 · Perfil `h2` como plan B sin PostgreSQL

[`application.yml`](../backend/src/main/resources/application.yml) (bloque `on-profile: h2`), [`pom.xml`](../backend/pom.xml) (dependencia H2 en `runtime`)

**Contexto:** en la máquina de sustentación puede no haber PostgreSQL instalado, y el demo no puede fallar por eso.

**Decisión:** perfil Spring `h2` con H2 en memoria en `MODE=PostgreSQL` y `DATABASE_TO_LOWER=TRUE`, reutilizando **las mismas** migraciones de Flyway (V1/V2). Se activa con `--spring.profiles.active=h2`. La consola H2 (`/h2-console`) queda habilitada para inspeccionar la BD durante la demo.

**Consecuencias:**
- (+) Cero código extra: un perfil de configuración resuelve el riesgo de infraestructura.
- (+) Mismo esquema y mismo seed en ambos motores → el comportamiento de la app es idéntico.
- (−) Los datos se pierden al detener la app (aceptable: es un plan B).
- (−) Las migraciones deben escribirse en sintaxis estándar compatible con ambos motores (ver ADR-004).

---

## ADR-004 · Enums de dominio como `VARCHAR` + `CHECK`

[`V1__init.sql`](../backend/src/main/resources/db/migration/V1__init.sql) (`chk_users_role`, `chk_orders_status`, `chk_payments_status`)

**Contexto:** H2 (perfil `h2`) no soporta `CREATE TYPE ... AS ENUM` de PostgreSQL, y las mismas migraciones deben ejecutarse en ambos motores (ADR-003).

**Decisión:** modelar los dominios (`role`, `orders.status`, `payments.status`) como `VARCHAR` con restricción `CHECK (value IN (...))`. Los UUIDs se generan en la aplicación (JPA), no con `DEFAULT gen_random_uuid()`, para mantener la portabilidad.

**Consecuencias:**
- (+) El dominio del enum se aplica a nivel de BD en ambos motores; en Java se mapean a enums (`Role`, `OrderStatus`, `PaymentStatus`).
- (−) Menos "native" que los enums de PostgreSQL; el `CHECK` documenta el dominio igual de bien.

---

## ADR-005 · Monorepo npm + Maven wrapper, sin Docker

[`package.json`](../package.json), [`backend/mvnw`](../backend/mvnw), [`backend/mvnw.cmd`](../backend/mvnw.cmd)

**Contexto:** el alcance es un MVP local para prueba técnica y sustentación; agregar orquestación de contenedores ampliaría el alcance sin beneficio evaluado.

**Decisión:**
- Monorepo con scripts raíz (`dev`, `backend`, `frontend`) vía `concurrently`.
- Maven wrapper (`mvnw`) para fijar la versión de Maven sin requerir su instalación.
- **Sin Docker** en el MVP: PostgreSQL local o perfil `h2` (ADR-003). Docker queda documentado como mejora futura, no implementado.

**Consecuencias:**
- (+) Arranque con 2 comandos (`npm install` + `npm run dev`); la versión de Maven es consistente entre máquinas.
- (−) La BD sigue dependiendo del entorno local o del plan B `h2` (riesgo ya mitigado, §Riesgos de [`arquitectura.md`](arquitectura.md)).

---


## ADR-008 · Órdenes como histórico inmutable (denormalización de `order_items`)

[`V1__init.sql`](../backend/src/main/resources/db/migration/V1__init.sql) (tabla `order_items` con `product_name` y `unit_price`)

**Contexto:** los admins pueden cambiar el nombre o el precio de un producto después de realizada una compra; la orden ya emitida no debería modificarse.

**Decisión:** `order_items` denormaliza `product_name` y `unit_price` en el momento de la compra. La orden queda como un **histórico inmutable**: no se re-lee el producto para calcular totales ni mostrar detalles.

**Consecuencias:**
- (+) Trazabilidad contable correcta: la orden siempre refleja lo que se pagó.
- (−) Ligera redundancia de datos (nombre/precio duplicados) — costo aceptable frente a la corrección del histórico.

---

## ADR-009 · Carrito 1-a-1 con usuario y `unit_price` capturado al agregar

[`V1__init.sql`](../backend/src/main/resources/db/migration/V1__init.sql) (`carts` con `uq_carts_user_id`, `cart_items` con `unit_price`)

**Contexto:** el carrito debe persistir entre sesiones (requisito R3) y el precio puede cambiar entre el momento de agregar y el de pagar.

**Decisión:**
- `carts` tiene relación **1-a-1** con `users` (PK compuesta/FK única): cada usuario tiene exactamente un carrito, persistido en la BD (no en localStorage del navegador).
- `cart_items.unit_price` captura el precio **vigente en el momento de agregar**; en el checkout se re-valida contra el stock y el subtotal usa el precio capturado.

**Consecuencias:**
- (+) "Persistente entre sesiones" cumplido sin estado en el cliente.
- (+) Regla clara y simple para el usuario: ve el precio con el que agregó el producto.
- (−) Si el precio baja entre el agregar y el pagar, el usuario paga el precio capturado (comportamiento documentado y aceptado).

---

## ADR-011 · Seed determinístico con hashes BCrypt precomputados

[`V2__seed.sql`](../backend/src/main/resources/db/migration/V2__seed.sql)

**Contexto:** las credenciales demo deben funcionar en cualquier máquina sin depender de generar el hash al vuelo (que varía por salt), y los datos de ejemplo deben ser estables.

**Decisión:**
- Los hashes BCrypt de `Admin123!` y `User123!` se generan **una sola vez** con el mismo encoder del backend (`BCryptPasswordEncoder`, fuerza 10), se verifican con `matches()` y se insertan como **constantes** en el seed.
- UUIDs explícitos (secuenciales) para usuarios y productos → datos 100 % determinísticos y reproducible.
- 8 productos con precios/stock coherentes; uno con stock bajo (`Cable USB-C 100W`, stock 2) para demostrar `INSUFFICIENT_STOCK`.

**Consecuencias:**
- (+) Seed reproducible en cualquier máquina y motor (PG o H2).
- (+) La demo de stock insuficiente siempre está disponible (producto conocido).
- (−) Las contraseñas demo quedan visibles en el script (aceptable: son cuentas demo del enunciado).

---

## ADR-012 · Checkstyle en la fase `validate` del build

[`pom.xml`](../backend/pom.xml) (plugin `maven-checkstyle-plugin`, `failOnViolation: true`, severidad `warning`), [`checkstyle.xml`](../backend/checkstyle.xml)

**Contexto:** el criterio de "buenas prácticas" se evalúa; las reglas de estilo deben aplicarse de forma automática, no por convención.

**Decisión:** el linter Checkstyle corre en la fase `validate` (antes de compilar) con `failsOnError: true` y `failOnViolation: true` desde la severidad `warning`. Reglas: sin tabs, longitud máxima 120, indentación 4, nombres (package/clases/métodos/constantes), sin star imports, correctness (`EqualsHashCode`, `MissingSwitchDefault`, `FallThrough`, etc.). No se aplica al directorio de tests.

**Consecuencias:**
- (+) Ningún código con violaciones llega al build: la calidad es verificable con `./mvnw compile`.
- (−) El código debe respetar las reglas desde el inicio (se documenta en el README y se usa como referencia en cada paso de implementación).
