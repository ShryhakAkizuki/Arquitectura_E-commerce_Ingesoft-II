package com.ingesoft.shop.service.payment;

import com.ingesoft.shop.enums.PaymentStatus;

/**
 * Resultado de un intento de pago devuelto por el proveedor.
 */
public record PaymentResult(
        PaymentStatus status,
        String transactionId,
        String failureReason) {

    public static PaymentResult confirmed(String transactionId) {
        return new PaymentResult(PaymentStatus.CONFIRMED, transactionId, null);
    }

    public static PaymentResult failed(String failureReason) {
        return new PaymentResult(PaymentStatus.FAILED, null, failureReason);
    }

    public boolean isConfirmed() {
        return status == PaymentStatus.CONFIRMED;
    }
}
