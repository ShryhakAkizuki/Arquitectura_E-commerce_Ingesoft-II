package com.ingesoft.shop.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT),  /** 409: el email ya existe. */
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),   /** 401: credenciales invalidas en el login. */
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND),        /** 404: el producto no existe o esta desactivado. */
    INSUFFICIENT_STOCK(HttpStatus.CONFLICT),        /** 409: stock insuficiente (carrito o checkout). */
    CART_EMPTY(HttpStatus.CONFLICT),                /** 409: intento de checkout con el carrito vacio. */
    PAYMENT_DECLINED(HttpStatus.PAYMENT_REQUIRED),  /** 402: la pasarela rechazo el pago (orden queda PENDING). */
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND),          /** 404: la orden no existe o no es del usuario autenticado. */
    FORBIDDEN(HttpStatus.FORBIDDEN),                /** 403: el usuario autenticado no tiene el rol requerido. */
    ORDER_STATUS_INVALID(HttpStatus.CONFLICT),      /** 409: transicion de estado de orden no permitida. */
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),          /** 401: falta el token JWT o no es valido. */
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),       /** 400: validacion de entrada fallida. */
    NOT_FOUND(HttpStatus.NOT_FOUND),                /** 404: la ruta no existe. */
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED), /** 405: metodo HTTP no permitido sobre la ruta. */
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR); /** 500: fallo no controlado. */

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
