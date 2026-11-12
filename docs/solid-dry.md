# Evidencias SOLID y DRY

Este documento mapea cada principio a **fragmentos de código real ya implementado**
en el módulo de autenticación/usuarios (R1), en el catálogo de productos (R2/R5)
y en la infraestructura de seguridad y errores. Cada principio indica
**dónde** se aplica, **por qué** y **qué gana** el proyecto. Los elementos de
los módulos aún en desarrollo (Carrito, Checkout, Órdenes) se citan como
*pendientes* y se evidenciarán aquí cuando se implementen.

> Convención de enlaces: los archivos se enlazan con su ruta relativa al
> monorepo. Los fragmentos son extractos literales de la fuente (se recortan
> solo los `import` y los métodos no relevantes para la evidencia).

## Índice

1. [S — Single Responsibility](#s-single-responsibility)
2. [O — Open/Closed](#o--copen-closed)
3. [L — Liskov Substitution](#l--lliskov-substitution)
4. [I — Interface Segregation](#i--iinterface-segregation)
5. [D — Dependency Inversion](#d--dependency-inversion)
6. [DRY — Don't Repeat Yourself](#dry--dont-repeat-yourself)
7. [Matriz resumen](#matriz-resumen)

---

## S — Single Responsibility

Cada clase tiene **una** razón para cambiar. Se separa la traducción HTTP, la
regla de negocio, la emisión de tokens y la conversión de errores.

### 1. El controlador no contiene negocio

[`AuthController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AuthController.java)
solo traduce HTTP → DTO → servicio → HTTP. Si mañana se cambia el formato del
JSON o el verbo HTTP, **solo** se toca el controlador.

```java
@PostMapping("/register")
public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
    UserResponse created = authService.register(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
}
```

Ninguna validación de negocio, ningún acceso a BD, ninguna decisión de estado:
eso vive en el servicio.

### 2. La regla de negocio está aislada en el servicio

[`AuthServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/AuthServiceImpl.java)
concentra las reglas: "el email debe ser único", "la contraseña se almacena
hasheada", "el login no revela si fue email o contraseña la que falló".

```java
@Override
@Transactional(readOnly = true)
public LoginResponse login(LoginRequest request) {
    User user = userRepository.findByEmail(request.email())
            .filter(candidate -> passwordEncoder.matches(request.password(),
                    candidate.getPasswordHash()))
            .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS,
                    "Email o contraseña incorrectos"));
    String token = jwtTokenProvider.generateToken(user);
    return new LoginResponse(token, UserResponse.from(user));
}
```

El mismo error (`INVALID_CREDENTIALS`) se lanza para email inexistente y
contraseña incorrecta: el cliente no puede enumerar qué emails existen.

### 3. Emitir/validar JWT es responsabilidad de un solo componente

[`JwtTokenProvider.java`](../backend/src/main/java/com/ingesoft/shop/security/JwtTokenProvider.java)
es el **único** lugar que conoce el formato del token. El servicio lo usa sin
saber cómo se firma.

```java
public String generateToken(User user) {
    Date now = new Date();
    Date expiration = new Date(now.getTime() + expirationMs);
    return Jwts.builder()
            .subject(user.getEmail())
            .claim(ROLE_CLAIM, user.getRole().name())
            .issuedAt(now)
            .expiration(expiration)
            .signWith(signingKey)
            .compact();
}
```

### 4. La conversión de errores es responsabilidad de un solo componente

[`GlobalExceptionHandler.java`](../backend/src/main/java/com/ingesoft/shop/exception/GlobalExceptionHandler.java)
(`@RestControllerAdvice`) es el **único** lugar que decide qué estado HTTP y
qué `ApiError` produce cada tipo de excepción. Ningún controlador construye
respuestas de error a mano.

```java
@ExceptionHandler(BusinessException.class)
public ResponseEntity<ApiError> handleBusinessException(BusinessException ex) {
    return toResponse(ex.getErrorCode(), ex.getMessage());
}
```

### 5. El catálogo se separa por rol: un motivo de cambio por controlador

[`ProductController.java`](../backend/src/main/java/com/ingesoft/shop/controller/ProductController.java)
expone **solo** lectura pública (`list`, `getById`) y
[`AdminProductController.java`](../backend/src/main/java/com/ingesoft/shop/controller/AdminProductController.java)
expone **solo** gestión (CRUD + stock), declarando el requisito de rol a
nivel de clase. Si cambia la política de administración (por ejemplo, un rol
`MODERATOR` adicional), se toca **solo** el controlador admin: el público ni
sabe que existe el concepto de rol.

```java
@RestController
@RequestMapping("/api/admin/products")
@PreAuthorize("hasRole('ADMIN')")
public class AdminProductController {
```

La regla de negocio de escritura (validaciones, desactivación, ajuste de
stock) vive en `ProductAdminServiceImpl`; la de lectura en
`ProductServiceImpl`. Los controladores no deciden, solo traducen.

---

## O — Open/Closed

El sistema está **abierto** a extensión y **cerrado** a modificación: se agrega
comportamiento con **nuevas clases/valores**, sin editar las existentes.

### 1. Agregar un método de autenticación no rompe lo existente

[`IAuthService.java`](../backend/src/main/java/com/ingesoft/shop/service/IAuthService.java)
es la superficie de contrato. Si se agrega "recuperar contraseña por email", se
añade un método a la interfaz y a la implementación; `AuthController` y los
tests existentes no se tocan.

```java
public interface IAuthService {
    UserResponse register(RegisterRequest request);
    LoginResponse login(LoginRequest request);
    UserResponse me(String email);
    UserResponse updateProfile(String email, UpdateProfileRequest request);
}
```

### 2. Un nuevo código de error no modifica el manejador

[`ErrorCode.java`](../backend/src/main/java/com/ingesoft/shop/exception/ErrorCode.java)
ya reserva códigos para los módulos venideros. Añadir uno nuevo es añadir una
**línea** al enum; `GlobalExceptionHandler` ya sabe convertir *cualquier*
`ErrorCode` en respuesta, porque delega el estado al propio enum:

```java
PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND),         /** 404: el producto no existe o esta desactivado. */
INSUFFICIENT_STOCK(HttpStatus.CONFLICT),         /** 409: stock insuficiente al agregar al carrito o en el checkout. */
PAYMENT_DECLINED(HttpStatus.PAYMENT_REQUIRED),   /** 402: la pasarela (simulada) rechazo el pago; la orden queda PENDING. */
ORDER_STATUS_INVALID(HttpStatus.CONFLICT);       /** 409: transicion de estado de orden no permitida. */
```

### 3. Un gateway de pago real será una nueva clase

*Pendiente (módulo Checkout):* el pago se abstracte tras `IPaymentProvider`.
Conectar un gateway real es implementar esa interfaz en una **nueva** clase;
`CheckoutService` y `PaymentService` no se modifican. (Ver ADR-007.)

### 4. El listado admin reutiliza la misma consulta sin modificar la pública

[`ProductRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/ProductRepository.java)
define **una sola** consulta de catálogo parametrizada por `onlyAvailable`:
el listado público la llama con `true` y el admin con `false`. El
comportamiento "ver también los desactivados" se agregó con un parámetro, sin
duplicar la consulta ni tocar el método público.

```java
@Query("""
        SELECT p FROM Product p
        WHERE (:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')))
          AND (:onlyAvailable = FALSE OR p.available = TRUE)
        """)
Page<Product> findCatalogPage(@Param("search") String search,
                              @Param("onlyAvailable") boolean onlyAvailable,
                              Pageable pageable);
```

---

## L — Liskov Substitution

Cualquier subtipo se puede sustituir por el tipo esperado sin romper el
comportamiento del cliente.

### 1. `UserRepository` es sustituible por `JpaRepository`

[`UserRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/UserRepository.java)
extiende `JpaRepository` y agrega solo lo específico del dominio. El servicio
depende de esa interfaz; en tests puede sustituirse por un **mock** de
`UserRepository` sin alterar `AuthServiceImpl`.

```java
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

### 2. `AuthServiceImpl` respeta el contrato completo de `IAuthService`

El cliente (`AuthController`) usa `IAuthService`; no importa que la
implementación sea `AuthServiceImpl` hoy o una variante maquetada en un test:
todas las firmas, semánticas de transacción y excepciones son las mismas.

### 3. El `PasswordEncoder` es un punto de sustitución

[`SecurityConfig.java`](../backend/src/main/java/com/ingesoft/shop/config/SecurityConfig.java)
expone el codificador como Bean de tipo `PasswordEncoder` (interfaz), no de
`BCryptPasswordEncoder` (clase concreta). Cambiar el algoritmo es sustituir el
Bean; ningún servicio se recompila.

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

### 4. `ProductRepository` es sustituible por `JpaRepository` (y por mocks)

[`ProductRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/ProductRepository.java)
extiende `JpaRepository<Product, UUID>` y agrega una sola consulta de dominio.
Tanto `ProductServiceImpl` como `ProductAdminServiceImpl` dependen de esa
interfaz, de modo que en tests puede sustituirse por un **mock** sin alterar
ningún servicio del catálogo.

---

## I — Interface Segregation

Interfaces **pequeñas y específicas**: nadie está obligado a depender de métodos
que no usa.

### 1. `IAuthService` es un contrato acotado (4 métodos)

[`IAuthService.java`](../backend/src/main/java/com/ingesoft/shop/service/IAuthService.java)
exponen exactamente lo que el módulo Auth necesita. No se mezclan operaciones
de catálogo ni de órdenes en la misma interfaz.

**Ya implementado:** [`IProductService`](../backend/src/main/java/com/ingesoft/shop/service/IProductService.java)
(2 métodos: `list`, `getById`) y
[`IProductAdminService`](../backend/src/main/java/com/ingesoft/shop/service/IProductAdminService.java)
(5 métodos: `listAll`, `create`, `update`, `deactivate`, `adjustStock`) son
interfaces **separadas**. `ProductController` depende solo de la primera y
`AdminProductController` solo de la segunda: ni un controlador ni un servicio
del catálogo público conocen operaciones de administración.

### 2. `UserRepository` solo expone las consultas del dominio

[`UserRepository.java`](../backend/src/main/java/com/ingesoft/shop/repository/UserRepository.java)
declara **dos** métodos de dominio (`findByEmail`, `existsByEmail`) sobre la
base genérica. No se infla con consultas que ningún servicio usa.

---

## D — Dependency Inversion

Los módulos de alto nivel (controladores, servicios) **no** dependen de clases
concretas de bajo nivel: dependen de **abstracciones** (interfaces) que se
inyectan.

### 1. El controlador depende de `IAuthService`, no de la implementación

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final IAuthService authService;

    public AuthController(IAuthService authService) {
        this.authService = authService;
    }
    // ...
}
```

Inyección por **constructor**: la dependencia es visible, inmutable y fácil de
maquetar en tests.

### 2. El servicio depende de abstracciones, no de implementaciones

[`AuthServiceImpl.java`](../backend/src/main/java/com/ingesoft/shop/service/impl/AuthServiceImpl.java)
depende de `UserRepository` (interfaz), `PasswordEncoder` (interfaz) y
`JwtTokenProvider` (componete acoplado a una interfaz de uso):

```java
public AuthServiceImpl(UserRepository userRepository,
                        PasswordEncoder passwordEncoder,
                        JwtTokenProvider jwtTokenProvider) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtTokenProvider = jwtTokenProvider;
}
```

Ninguna `new` de dependencias dentro del cuerpo: todo proviene del contenedor.

### 3. La seguridad depende del filtro, no de su construcción interna

[`SecurityConfig.java`](../backend/src/main/java/com/ingesoft/shop/config/SecurityConfig.java)
inyecta `JwtAuthFilter` como componente y lo inserta en la cadena sin conocer
sus detalles internos:

```java
http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
```

### 4. Los controladores del catálogo dependen de interfaces de servicio

Ambos controladores reciben su dependencia **por constructor** declarada como
`IProductService` y `IProductAdminService` (interfaces), no como las clases
`*Impl`. La implementación puede maquetarse en tests sin tocar el
controlador.

```java
public ProductController(IProductService productService) {
    this.productService = productService;
}

public AdminProductController(IProductAdminService productAdminService) {
    this.productAdminService = productAdminService;
}
```

---

## DRY — Don't Repeat Yourself

Cada pieza de conocimiento vive en **un único lugar**. Se elige el punto de
definición más natural y se reutiliza.

### 1. El mapeo entidad → respuesta se define una sola vez

[`UserResponse.from(User)`](../backend/src/main/java/com/ingesoft/shop/dto/response/UserResponse.java)
es el **único** punto que convierte `User` a `UserResponse`. Se usa en
registro, login, `me` y `updateProfile`: si cambia el contrato de salida, se
edita una línea.

```java
public static UserResponse from(User user) {
    return new UserResponse(user.getId(), user.getName(), user.getEmail(),
            user.getRole(), user.getCreatedAt());
}
```

### 2. El estado HTTP de cada código se define una sola vez

El estado HTTP **no** se repite en cada manejador: vive en el enum
[`ErrorCode`](../backend/src/main/java/com/ingesoft/shop/exception/ErrorCode.java)
y se lee a través de `getStatus()`. El manejador y los handlers de seguridad
comparten esa fuente.

```java
// GlobalExceptionHandler
private ResponseEntity<ApiError> toResponse(ErrorCode errorCode, String message) {
    return ResponseEntity.status(errorCode.getStatus()).body(ApiError.of(errorCode, message));
}
```

### 3. El cuerpo de error se construye en un único método

[`ApiError.of(...)`](../backend/src/main/java/com/ingesoft/shop/exception/ApiError.java)
es la **única** forma de construir el JSON de error. Lo usan tanto el manejador
global como los `AuthenticationEntryPoint`/`AccessDeniedHandler` de seguridad,
así el formato 401/403 es idéntico al resto de errores.

```java
public static ApiError of(ErrorCode errorCode, String message) {
    return new ApiError(errorCode.getStatus().value(), errorCode.name(), message,
            Instant.now().toString());
}
```

### 4. La respuesta de seguridad reutiliza `ApiError` en un solo sitio

En [`SecurityConfig.java`](../backend/src/main/java/com/ingesoft/shop/config/SecurityConfig.java)
los dos handlers (401 y 403) delegan en **un** método privado
`writeApiError(...)`, que reutiliza `ApiError.of`. No hay dos bloques casi
idénticos serializando JSON.

```java
private static void writeApiError(HttpServletResponse response, ObjectMapper objectMapper,
        ErrorCode errorCode, String message) throws IOException {
    response.setStatus(errorCode.getStatus().value());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    objectMapper.writeValue(response.getWriter(), ApiError.of(errorCode, message));
}
```

### 5. La validación de entrada se declara una vez por campo

Las restricciones (longitud, formato de email, rango de contraseña) se
**declaran** sobre el DTO con Bean Validation; el handler global las convierte
en `VALIDATION_ERROR`. No se repiten `if` manuales en cada servicio.

```java
public record RegisterRequest(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 100, message = "El nombre no puede exceder los 100 caracteres")
        String name,
        @NotBlank(message = "El email es obligatorio")
        @Email(message = "El email no tiene un formato válido")
        String email,
        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 8, max = 72, message = "La contraseña debe tener entre 8 y 72 caracteres")
        String password) {
}
```

### 6. El codificador de contraseñas es una única fuente

El Bean `PasswordEncoder` de
[`SecurityConfig.java`](../backend/src/main/java/com/ingesoft/shop/config/SecurityConfig.java)
es la **única** instancia usada para hashear (registro, cambio de contraseña)
y comparar (login). No hay `BCryptPasswordEncoder` instanciado a mano en
varios servicios.

### 7. El mapeo del catálogo entidad → respuesta se define una sola vez

[`ProductResponse.from(Product)`](../backend/src/main/java/com/ingesoft/shop/dto/response/ProductResponse.java)
es el **único** punto que convierte `Product` a `ProductResponse`: los 7
endpoints de catálogo (públicos `list`/`getById` y admin `listAll`/`create`/
`update`/`deactivate`/`adjustStock`) pasan por él. Si cambia el contrato de
salida, se edita un método.

```java
public static ProductResponse from(Product product) {
    return new ProductResponse(product.getId(), product.getName(), product.getDescription(),
            product.getPrice(), product.getStock(), product.getImageUrl(),
            product.isAvailable(), product.getUpdatedAt());
}
```

De la misma forma, [`ProductRequest`](../backend/src/main/java/com/ingesoft/shop/dto/request/ProductRequest.java)
es el **único** DTO para creación (`POST`) y actualización (`PUT`): las
restricciones de Bean Validation se declaran **una vez** y se comparten entre
ambas operaciones.

---

## Matriz resumen

| Principio | Auth (R1) | Catálogo (R2/R5) | Pendiente |
|-----------|-----------|------------------|-----------|
| S | ✔ controlador/servicio/JWT/errores | ✔ controladores por rol, servicios de lectura/escritura | Carrito, Checkout, Órdenes |
| O | ✔ métodos nuevos en `IAuthService`, `ErrorCode` | ✔ flag `onlyAvailable` en `findCatalogPage` | Gateway `IPaymentProvider` |
| L | ✔ repositorios, `PasswordEncoder` | ✔ `ProductRepository` sustituible | — |
| I | ✔ `IAuthService` | ✔ `IProductService` / `IProductAdminService` | — |
| D | ✔ inyección por constructor | ✔ inyección por constructor | — |
| DRY | ✔ `UserResponse.from`, `ErrorCode`, `ApiError` | ✔ `ProductResponse.from`, `ProductRequest` | — |
