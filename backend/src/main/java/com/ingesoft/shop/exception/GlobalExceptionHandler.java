package com.ingesoft.shop.exception;

import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

/**
 * Manejo global de errores del backend.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Mensaje por defecto cuando una validacion falla sin detalle de campo. */
    private static final String DEFAULT_VALIDATION_MESSAGE = "Datos invalidos en la peticion.";

    /**
     * Errores de negocio: el estado HTTP lo define el codigo
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiError> handleBusinessException(BusinessException ex) {
        return toResponse(ex.getErrorCode(), ex.getMessage());
    }

    /**
     * Validacion de {@code @RequestBody} fallida
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        String message = validationMessage(ex);
        return toResponse(ErrorCode.VALIDATION_ERROR,
                message.isEmpty() ? DEFAULT_VALIDATION_MESSAGE : message);
    }

    /**
     * Validacion de parametros individuales (query, path o headers) fallida
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        return toResponse(ErrorCode.VALIDATION_ERROR,
                message.isEmpty() ? DEFAULT_VALIDATION_MESSAGE : message);
    }

    /**
     * Falta un parametro de peticion requerido.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParameter(MissingServletRequestParameterException ex) {
        return toResponse(ErrorCode.VALIDATION_ERROR,
                "Falta el parametro requerido: " + ex.getParameterName());
    }

    /**
     * Un parametro no se pudo convertir al tipo esperado (p. ej. un UUID invalido
     * en {@code /api/products/{id}}).
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return toResponse(ErrorCode.VALIDATION_ERROR,
                "El parametro '" + ex.getName() + "' no tiene un valor valido: " + ex.getValue());
    }

    /**
     * Cuerpo de la peticion ilegible (JSON malformado, tipo inesperado, etc.).
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex) {
        LOGGER.debug("Cuerpo de peticion no legible: {}", ex.getMessage());
        return toResponse(ErrorCode.VALIDATION_ERROR,
                "El cuerpo de la peticion no es un JSON valido.");
    }

    /**
     * La ruta no existe (ningun handler la atiende).
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiError> handleNoHandlerFound(NoHandlerFoundException ex) {
        return toResponse(ErrorCode.NOT_FOUND,
                "Ruta no encontrada: " + ex.getHttpMethod() + " " + ex.getRequestURL());
    }

    /**
     * El metodo HTTP no esta permitido sobre la ruta.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return toResponse(ErrorCode.METHOD_NOT_ALLOWED,
                "Metodo " + ex.getMethod() + " no permitido; metodos aceptados: "
                        + String.join(", ", ex.getSupportedMethods()));
    }

    /**
     * Respaldo 403
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return toResponse(ErrorCode.FORBIDDEN, "Acceso denegado: falta un rol requerido.");
    }

    /**
     * Respaldo 401
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex) {
        return toResponse(ErrorCode.UNAUTHORIZED,
                "No autenticado: falta el token JWT o no es valido.");
    }

    /**
     * Ultima linea de defensa 500
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
        LOGGER.error("Error no controlado en {} {}: {}",
                request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);
        return toResponse(ErrorCode.INTERNAL_ERROR, "Error interno del servidor.");
    }

    /**
     * Construye la respuesta estandar
     */
    private ResponseEntity<ApiError> toResponse(ErrorCode errorCode, String message) {
        return ResponseEntity.status(errorCode.getStatus()).body(ApiError.of(errorCode, message));
    }

    /**
     * Junta los errores de campo de un {@code @Valid} en un mensaje unico,
     * ordenado alfabeticamente para que sea determinista
     */
    private String validationMessage(MethodArgumentNotValidException ex) {
        return ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
                .sorted()
                .collect(Collectors.joining("; "));
    }
}
