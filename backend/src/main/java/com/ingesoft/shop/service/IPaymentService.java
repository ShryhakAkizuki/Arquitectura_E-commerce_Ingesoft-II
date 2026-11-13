package com.ingesoft.shop.service;

import java.math.BigDecimal;
import java.util.UUID;

import com.ingesoft.shop.dto.request.PaymentData;
import com.ingesoft.shop.service.payment.PaymentResult;

/**
 * Orquesta el pago de una orden
 */
public interface IPaymentService {

    PaymentResult process(UUID orderId, BigDecimal amount, PaymentData paymentData);
}
