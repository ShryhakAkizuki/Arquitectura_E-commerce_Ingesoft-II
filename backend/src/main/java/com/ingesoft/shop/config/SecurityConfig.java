package com.ingesoft.shop.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ingesoft.shop.exception.ApiError;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.security.JwtAuthFilter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Politica de seguridad del backend
 * 
 * <p>El filtro {@link JwtAuthFilter} se inserta antes del
 * {@link UsernamePasswordAuthenticationFilter} para autenticar cada peticion
 * a partir del token Bearer. 
 *
 * <p>El {@code PasswordEncoder} es BCrypt (§4): nunca se almacena ni compara
 * una contrasena en texto plano.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    /** Rutas públicas de SpringDoc / Swagger UI (sin autenticacion, §5). */
    private static final String[] SWAGGER_PUBLIC_PATHS = {
            "/swagger-ui.html",
            "/swagger-ui/**",
            "/swagger-ui-init",
            "/v3/api-docs/**",
            "/swagger-resources/**",
            "/webjars/**",
            "/api-docs/**"
    };

    /** Rutas que exigen un usuario autenticado, con cualquier rol (§5). */
    private static final String[] AUTHENTICATED_PATHS = {
            "/api/users/**",
            "/api/cart/**",
            "/api/checkout",
            "/api/orders/**"
    };

    private final JwtAuthFilter jwtAuthFilter;

    private final ObjectMapper objectMapper;

    /**
     * @param jwtAuthFilter filtro que autentica cada peticion con el token Bearer
     * @param objectMapper  serializa las respuestas de error en formato ApiError
     */
    public SecurityConfig(JwtAuthFilter jwtAuthFilter, ObjectMapper objectMapper) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.objectMapper = objectMapper;
    }

    /**
     * Cadena de filtros de seguridad de la aplicacion.
     *
     * @param http builder de seguridad de Spring Security
     * @return la cadena de filtros construida
     * @throws Exception si la configuracion no es valida
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        disableCsrfAndEnableCors(http);
        configureStatelessSessions(http);
        configureAccessByRole(http);
        configureErrorResponses(http);
        http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * API REST stateless
     */
    private void disableCsrfAndEnableCors(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults());
    }

    /**
     * Sin gestion de sesion: cada peticion se autentica con su propio token JWT.
     */
    private void configureStatelessSessions(HttpSecurity http) throws Exception {
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
    }

    /**
     * Politica de acceso por ruta y rol.
     */
    private void configureAccessByRole(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                .requestMatchers(SWAGGER_PUBLIC_PATHS).permitAll()
                .requestMatchers(AUTHENTICATED_PATHS).authenticated()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().denyAll());
    }

    /**
     * Respuestas de seguridad en el formato estandar de error del backend
     */
    private void configureErrorResponses(HttpSecurity http) throws Exception {
        http.exceptionHandling(ex -> ex
                .authenticationEntryPoint(new ApiErrorAuthenticationEntryPoint(objectMapper))
                .accessDeniedHandler(new ApiErrorAccessDeniedHandler(objectMapper)));
    }

    /**
     * Codificador de contrasenas BCrypt. Fuente unica para hashear y
     * comparar contrasenas en todo el backend.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Responde {@code 401 UNAUTHORIZED} en formato {@code ApiError} cuando
     * una ruta protegida se pide sin un token JWT valido.
     */
    private static final class ApiErrorAuthenticationEntryPoint implements AuthenticationEntryPoint {

        private final ObjectMapper objectMapper;

        private ApiErrorAuthenticationEntryPoint(ObjectMapper objectMapper) {
            this.objectMapper = objectMapper;
        }

        @Override
        public void commence(HttpServletRequest request, HttpServletResponse response,
                AuthenticationException authException) throws IOException {
            writeApiError(response, objectMapper, ErrorCode.UNAUTHORIZED,
                    "No autenticado: falta el token JWT o no es valido.");
        }
    }

    /**
     * Responde {@code 403 FORBIDDEN} en formato {@code ApiError} cuando el
     * usuario autenticado no tiene el rol requerido (p. ej. un {@code USER}
     * sobre {@code /api/admin/**}).
     */
    private static final class ApiErrorAccessDeniedHandler implements AccessDeniedHandler {

        private final ObjectMapper objectMapper;

        private ApiErrorAccessDeniedHandler(ObjectMapper objectMapper) {
            this.objectMapper = objectMapper;
        }

        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response,
                AccessDeniedException accessDeniedException) throws IOException {
            writeApiError(response, objectMapper, ErrorCode.FORBIDDEN,
                    "Acceso denegado: falta un rol requerido.");
        }
    }

    /**
     * Escribe la respuesta de error estandar del backend reutilizando
     * {@link ApiError} de {@code exception/}: el estado HTTP y el cuerpo
     * toman el mismo {@link ErrorCode}, en un unico lugar.
     */
    private static void writeApiError(HttpServletResponse response, ObjectMapper objectMapper,
            ErrorCode errorCode, String message) throws IOException {
        response.setStatus(errorCode.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ApiError.of(errorCode, message));
    }
}
