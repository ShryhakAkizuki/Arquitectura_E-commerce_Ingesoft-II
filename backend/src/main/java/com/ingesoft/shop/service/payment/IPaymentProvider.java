package com.ingesoft.shop.service.payment;

import java.math.BigDecimal;

import com.ingesoft.shop.dto.request.PaymentData;

/**
 * Abstraccion del proveedor de pago
 */
public interface IPaymentProvider {

    PaymentResult pay(BigDecimal amount, PaymentData paymentData);
}
