# Decisiones de Arquitectura (ADR)

Registro de decisiones técnicas del proyecto.

**Estado de los ADR**:

| ADR | Tema |
|-----|------|
| ADR-001 | Stack tecnológico (Java 17 + Spring Boot 3.5 + React 18 + TS + PostgreSQL) |
| ADR-002 | Flyway como dueño del esquema (`ddl-auto: validate`) |
| ADR-003 | Perfil `h2` en memoria como plan B sin PostgreSQL |
| ADR-004 | Enums de dominio como `VARCHAR` + `CHECK` (portabilidad PG/H2) |
| ADR-005 | Monorepo npm + Maven wrapper, sin Docker (MVP local) |
| ADR-006 | Autenticación stateless: JWT HS256 + BCrypt |
| ADR-011 | Seed determinístico con hashes BCrypt precomputados |
| ADR-012 | Checkstyle en la fase `validate` del build (falla el build ante violación) |
| ADR-013 | Catálogo: lectura pública / gestión admin separadas, soft delete y stock absoluto |
| ADR-014 | Carrito persistente único por usuario, precio capturado al agregar y cantidad acumulada |
| ADR-015 | Checkout transaccional: bloqueos pesimistas, proveedor de pago simulado configurable y orden reintentable en `PENDING` |

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


## ADR-006 · Autenticación stateless: JWT HS256 + BCrypt

[`JwtTokenProvider.java`](../backend/src/main/java/com/ingesoft/shop/security/JwtTokenProvider.java), [`JwtAuthFilter.java`](../backend/src/main/java/com/ingesoft/shop/security/JwtAuthFilter.java), [`AppUserDetailsService.java`](../backend/src/main/java/com/ingesoft/shop/security/AppUserDetailsService.java), [`SecurityConfig.java`](../backend/src/main/java/com/ingesoft/shop/config/SecurityConfig.java), [`application.yml`](../backend/src/main/resources/application.yml) (bloque `jwt`)

**Contexto:** la API la consume un frontend distinto (React) sobre HTTP; el backend debe servir peticiones sin estado de sesión en el servidor y cumplir R1 (autenticación segura + autorización por rol `USER`/`ADMIN`). Un usuario deshabilitado o eliminado debe dejar de poder autenticarse aunque tenga un token emitido.

**Decisión:**
- Token **stateless**: JWT firmado con **HS256** (JJWT 0.12.x). El secreto se lee de `jwt.secret` (placeholder de desarrollo documentado; en entornos reales se exporta `JWT_SECRET`) y la expiración es configurable por `jwt.expiration-ms` (default **2 h**).
- El *subject* del token es el **email** del usuario (su identificador de login) y se incluye un claim `role` informativo. El rol que **autoriza** no se toma del claim, sino de la BD en cada petición (ver abajo): el token solo identifica, la BD autoriza.
- `SessionCreationPolicy.STATELESS` y CSRF deshabilitado: no hay sesión HTTP.
- [`JwtAuthFilter`](../backend/src/main/java/com/ingesoft/shop/security/JwtAuthFilter.java) (`OncePerRequestFilter`) se inserta **antes** de `UsernamePasswordAuthenticationFilter`. Por cada petición con header `Authorization: Bearer <token>`: valida firma y expiración (`JwtTokenProvider.validateToken`), recarga el usuario por email desde la BD y **rechaza la autenticación** si el usuario ya no existe o está inactivo (`active = false` → `disabled` en `UserDetails`); solo entonces puebla el `SecurityContextHolder` con las autoridades leídas de la BD.
- Contraseñas: un único Bean `PasswordEncoder` (`BCryptPasswordEncoder`, fuerza 10) que es la fuente única para hashear (registro/cambio de contraseña) y comparar (login).
- Los errores de seguridad (401/403) se responden en el formato estándar `ApiError` mediante `AuthenticationEntryPoint` y `AccessDeniedHandler` propios de `SecurityConfig`.

**Consecuencias:**
- (+) Sin sesiones en el servidor: cualquier instancia atiende cualquier petición; escalamiento horizontal gratis.
- (+) Un usuario deshabilitado o eliminado queda bloqueado **en la siguiente petición** (re-lectura por petición), lo que mitiga la debilidad clásica del "token válido hasta su expiración".
- (−) El token no puede revocarse de forma activa antes de su expiración (mitigación: re-lectura del usuario por petición).
- (−) Una consulta a BD extra por petición autenticada (aceptable en la escala del MVP).
- (−) El secreto de firma debe protegerse y rotarse: `JWT_SECRET` debe exportarse fuera de desarrollo local.

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

---

## ADR-013 · Catálogo: lectura pública / gestión admin separadas, soft delete y stock absoluto

[`ProductController.java`](../backend/src/main/java/com/ingesoft/shop/controller/ProductController.java), [`AdminProductController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AdminProductController.java), [`IProductService.java`](../backend/src/main/java/com/ingesoft/shop/service/IProductService.java), [`IProductAdminService.java`](../backend/src/main/java/com/ingesoft/shop/service/IProductAdminService.java), [`ProductRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/ProductRepository.java), [`ProductRequest.java`](../backend/src/main/java/com/ingesoft/shop/dto/request/ProductRequest.java), [`AdjustStockRequest.java`](../backend/src/main/java/com/ingesoft/shop/dto/request/AdjustStockRequest.java)

**Contexto:** el enunciado exige un catálogo de productos (R5) visible para cualquier visitante y un CRUD de productos y stock reservado a administradores (R2). Los módulos de Carrito/Checkout/Órdenes que llegarán después necesitan leer el catálogo sin depender de lógica de administración, y las órdenes futuras referenciarán productos que pueden dejar de estar a la venta.

**Decisión:**
- **Dos superficies de servicio separadas por rol:** `IProductService` (2 métodos: `list`, `getById`) para el catálogo público y `IProductAdminService` (5 métodos: `listAll`, `create`, `update`, `deactivate`, `adjustStock`) para la administración. Cada controlador depende solo de la interfaz que le corresponde (ver SOLID §I en [`solid-dry.md`](solid-dry.md)).
- **Autorización por clase, no por método:** `@PreAuthorize("hasRole('ADMIN')")` sobre `AdminProductController` cubre los 5 endpoints de un solo golpe; el controlador público no declara ninguna restricción (rutas permitidas en `SecurityConfig`).
- **Soft delete con `available = false`:** `DELETE /api/admin/products/{id}` **no** elimina la fila; marca el producto como no disponible. El listado público filtra `available = true` y el admin ve todo. Así las órdenes futuras que referencien el producto no pierden su historial, y la desactivación es reversible.
- **Detalle público no revela desactivados:** `GET /api/products/{id}` responde `404 PRODUCT_NOT_FOUND` tanto si el producto no existe como si está desactivado (el cliente no puede inferir la existencia de productos fuera de venta).
- **Una sola consulta de catálogo:** `ProductRepository.findCatalogPage(search, onlyAvailable, pageable)` es parametrizada por `onlyAvailable` para que el listado público (`true`) y el admin (`false`) reutilicen la misma consulta, evitando duplicar la lógica de búsqueda/orden/paginación (ver Open/Closed §4 en [`solid-dry.md`](solid-dry.md)).
- **Un solo DTO de entrada para POST y PUT:** `ProductRequest` con Bean Validation (`@NotBlank`, `@Size`, `@Positive`, `@PositiveOrZero`) se usa para crear y actualizar; el ajuste de stock tiene su propio `AdjustStockRequest` de un campo. El servicio además valida reglas de negocio (`BusinessException` + `VALIDATION_ERROR`/`PRODUCT_NOT_FOUND`) como segunda capa, de modo que la API es segura aunque el `@Valid` no llegue a ejecutarse.
- **Stock absoluto, no delta:** `PATCH /api/admin/products/{id}/stock` recibe el valor final (`{ "stock": 7 }`), no un incremento/decremento. Es semánticamente más simple para un admin que "pinta" el stock y evita operaciones aritméticas con estado.
- **`imageUrl` opcional:** el producto puede crearse sin imagen (el frontend mostrará un placeholder); `name`, `description`, `price` y `stock` son obligatorios.

**Consecuencias:**
- (+) El módulo Carrito/Checkout podrá depender únicamente de `IProductService` para leer precios/stock, sin acoplarse a operaciones admin.
- (+) La desactivación preserva la integridad referencial de las órdenes futuras y permite reactivar productos sin re-crearlos.
- (+) Añadir un campo o una regla al catálogo no obliga a tocar el controlador público si es una regla de admin, y viceversa.
- (−) `DELETE` no libera espacio en la tabla: los productos desactivados siguen ocupando filas (coste despreciable en la escala del MVP y necesario para el historial de órdenes).
- (−) El stock absoluto descarta ajustes concurrentes tipo "quitar 1 unidad" (lo resuelve el checkout con el decremento del stock al confirmar la orden bajo bloqueo pesimista, ADR-015).

---

## ADR-014 · Carrito persistente único por usuario, precio capturado al agregar y cantidad acumulada

[`Cart.java`](../backend/src/main/java/com/ingesoft/shop/entity/Cart.java), [`CartItem.java`](../backend/src/main/java/com/ingesoft/shop/entity/CartItem.java), [`ICartService.java`](../backend/src/main/java/com/ingesoft/shop/service/ICartService.java), [`CartServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/CartServiceImpl.java), [`CartController.java`](../backend/src/main/java/com/ingesoft/shop/controller/CartController.java), [`CartRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/CartRepository.java), [`V1__init.sql`](../backend/src/main/resources/db/migration/V1__init.sql) (`carts`, `cart_items`)

**Contexto:** R3 exige un carrito fluido y R4 validaciones de stock. El carrito debe sobrevivir recargas y reinicios (el usuario no pierde su selección), cada usuario debe tener a lo sumo **un** carrito, y el módulo de checkout debe poder re-validar precio y stock sin que el carrito haya envejecido mal (implementado en ADR-015).

**Decisión:**
- **Persistencia JPA, no sesion/cookie:** el carrito vive en `carts` (1:1 con `users`, `user_id` único) y `cart_items` (N:1 con `carts` y `products`). Se recupera por el email del token JWT, por lo que no depende de dispositivos ni de cookies.
- **Crear bajo demanda:** `GET /api/cart` crea el carrito si el usuario aún no tiene uno (`save` solo la primera vez). El cliente nunca ve un "carrito no inicializado".
- **Un solo ítem por producto (restricción única `uq_cart_items_cart_product`):** re-agregar un producto que ya está en el carrito **acumula** la cantidad en lugar de duplicar la fila; la cantidad se actualiza con `setQuantity` y la restricción de BD es la red de seguridad contra duplicados.
- **Precio capturado al momento de agregar (`unit_price`):** cada ítem conserva el `price` del producto en el instante de agregación. Si el admin cambia el precio después, el carrito no se modifica solo (coherencia con ADR-008); el checkout re-valida precio y stock antes de confirmar.
- **Subtotal derivado, nunca almacenado:** `Cart.getSubtotal()` suma `unitPrice × quantity` de los ítems en memoria; no hay columna de subtotal que mantener sincronizada.
- **Stock validado en la capa de servicio:** `CartServiceImpl` compara la cantidad solicitada contra `Product.stock` al agregar y al actualizar, y lanza `INSUFFICIENT_STOCK` (409) si no alcanza (incluida la cantidad acumulada). La entidad `CartItem` solo valida `quantity > 0`; la regla de stock **no** vive en la entidad (separación de responsabilidades, ver S en [`solid-dry.md`](solid-dry.md)).
- **Aislamiento por usuario:** cada operación resuelve el carrito por el email del token; un `itemId` ajeno al carrito del usuario responde `404 NOT_FOUND` (no `403`), para no revelar la existencia de ítems ajenos.
- **Interfaz pequeña:** `ICartService` expone 4 métodos (`get`, `add`, `updateQuantity`, `remove`), todos devuelven `CartResponse`; el controlador depende solo de esa interfaz.

**Consecuencias:**
- (+) El carrito persiste entre sesiones y dispositivos; el estado de compra no depende del cliente.
- (+) Sin columna de subtotal y sin duplicados de ítems: menos invariantes que mantener y menos superficie de bug.
- (+) El checkout (ADR-015) solo debe re-validar `unit_price`/`stock` contra el producto actual y descontar el stock de forma serializada; el carrito ya le entrega precios y cantidades consistentes.
- (+) La restricción única de BD protege la invariant de un-ítem-por-producto incluso si un cambio de código la violara.
- (−) El precio en el carrito puede quedar desfasado del precio vigente hasta que el checkout lo re-valide (comportamiento documentado, coherente con ADR-008/009).
- (−) La lectura del carrito por email exige pasar por `UserRepository` en cada operación (coste despreciable en la escala del MVP).

---

## ADR-015 · Checkout transaccional: bloqueos pesimistas, proveedor de pago simulado configurable y orden reintentable en `PENDING`

[`CheckoutServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/CheckoutServiceImpl.java), [`PaymentServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/PaymentServiceImpl.java), [`IPaymentProvider.java`](../backend/src/main/java/com/ingesoft/shop/service/payment/IPaymentProvider.java), [`SimulatedPaymentProvider.java`](../backend/src/main/java/com/ingesoft/shop/service/payment/SimulatedPaymentProvider.java), [`PaymentResult.java`](../backend/src/main/java/com/ingesoft/shop/service/payment/PaymentResult.java), [`CartItemRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/CartItemRepository.java) (`findByCartIdForUpdate`), [`ProductRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/ProductRepository.java) (`findByIdForUpdate`), [`application.yml`](../backend/src/main/resources/application.yml) (bloque `checkout`)

**Contexto:** R3 (checkout fluido) y R4 (validaciones de stock y pagos) quedaban pendientes tras el carrito (ADR-014), que ya entrega precios y cantidades consistentes. Tres problemas concretos: (1) dos compras concurrentes del mismo producto podrían **sobreventa** si el chequeo de stock y el descuento no son atómicos (riesgo §10 de [`arquitectura.md`](arquitectura.md)); (2) la prueba técnica no puede depender de una pasarela real, pero debe poder demostrar **ambos** resultados de pago (confirmado y rechazado) de forma reproducible; (3) un pago rechazado no puede borrar la compra: la orden debe quedar en un estado reintentable.

**Decisión:**
- **Un único endpoint orquesta la compra completa:** `POST /api/checkout` (`CheckoutServiceImpl`) ejecuta: usuario por email del token → carrito (se crea si no existe) → **bloqueo pesimista de los ítems del carrito** → **bloqueo pesimista de cada producto** con validación de stock → creación de la `Order` (estado `PENDING`, `orderNumber = "ORD-" + 8 caracteres de un UUID` en mayúsculas, total = subtotal + envío fijo `checkout.shipping-fee`, default `5000.00`) → `IPaymentService.process(orderId, total, paymentData)` → si el pago se **confirma**: descuento de stock de cada producto, transición `PAID` y vaciado del carrito → `201` con `OrderResponse`.
- **Bloqueo pesimista `SELECT ... FOR UPDATE`:** `CartItemRepository.findByCartIdForUpdate` y `ProductRepository.findByIdForUpdate` declaran `@Lock(LockModeType.PESSIMISTIC_WRITE)`. La verificación de stock ocurre **dentro** del bloqueo, de modo que las compras concurrentes del mismo producto se serializan y ninguna descuenta stock inexistente (mitigación directa del riesgo de sobreventa).
- **`TransactionTemplate` en lugar de `@Transactional` declarativo:** el programa "todo-o-nada" (`performCheckout`) corre dentro de `transactionTemplate.execute(...)`; ante cualquier error de negocio la transacción hace rollback y no se persiste nada. En el caso de **pago rechazado** el `402 PAYMENT_DECLINED` se lanza **después** de que la transacción ya comprometió la orden `PENDING` y el pago `FAILED`: el cliente recibe el `orderNumber` para reintentar, y los datos de la tentativa quedan auditables.
- **Abstracción de la pasarela (`IPaymentProvider`):** el flujo no conoce a la pasarela concreta. `SimulatedPaymentProvider` (`@Component`) confirma todo pago **salvo** las tarjetas cuyos dígitos terminen en `checkout.card-declined-suffix` (default `"0002"`); los pagos confirmados devuelven `transactionId = "SIM-<uuid>"` y los rechazados, un `failureReason`. `PaymentResult` (record) transporta estado, transacción y motivo de fallo.
- **Todo intento de pago se persiste:** `PaymentServiceImpl` (`@Transactional`) guarda una fila en `payments` por cada intento — `CONFIRMED` con `transaction_id` o `FAILED` con `failure_reason` — con `provider` derivado de la clase de la implementación (`SIMULATED`). La trazabilidad del flujo rechazado queda en la BD (coherente con ADR-007).
- **Validaciones de negocio en el checkout:** carrito sin ítems → `409 CART_EMPTY`; producto del carrito inexistente → `404 PRODUCT_NOT_FOUND`; cantidad > stock disponible (tras el bloqueo) → `409 INSUFFICIENT_STOCK`; tarjeta rechazada → `402 PAYMENT_DECLINED`.

**Consecuencias:**
- (+) La sobreventa por compras concurrentes queda mitigada a nivel de base de datos (bloqueo + verificación + descuento serializados dentro de la misma transacción).
- (+) El rechazo de pago es un **estado recuperable**: orden `PENDING` + pago `FAILED` persistidos, y el `402` expone el `orderNumber` para el reintento futuro.
- (+) Cambiar de pasarela (otra simulada o una real) es añadir una implementación de `IPaymentProvider` sin tocar `PaymentServiceImpl` ni el flujo de checkout (Open/Closed).
- (+) Cada tentativa de pago es auditable en `payments`: la demo del flujo rechazado tiene evidencia en la BD y en el log.
- (−) Los bloqueos pesimistas se sostienen durante la transacción completa del checkout: ante alta concurrencia sobre el mismo producto el throughput baja (aceptable en la escala del MVP; la alternativa, decremento atómico con `UPDATE ... WHERE stock >= n`, se documenta como mejora).
- (−) El reintento de una orden `PENDING` (nuevo cargo sobre el mismo `orderNumber`) no está implementado: falta el endpoint del módulo de órdenes; por ahora el `orderNumber` se entrega al cliente y el estado `PENDING` queda documentado.
- (−) El envío es fijo e independiente del contenido del carrito (simplificación documentada; un cálculo por peso/valor sería una extensión del flujo existente).
