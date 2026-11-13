package com.ingesoft.shop.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Datos de pago enviados por el cliente al finalizar la compra
 */
public record PaymentData(
        @NotBlank(message = "El metodo de pago es obligatorio")
        @Size(max = 30, message = "El metodo de pago no puede superar 30 caracteres")
        String method,
        @NotBlank(message = "El numero de tarjeta es obligatorio")
        @Size(max = 25, message = "El numero de tarjeta no puede superar 25 caracteres")
        String cardNumber,
        @Size(max = 100, message = "El nombre del titular no puede superar 100 caracteres")
        String cardholderName) {
}
