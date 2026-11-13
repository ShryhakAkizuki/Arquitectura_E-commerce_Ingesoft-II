package com.ingesoft.shop.service.impl;

import java.math.BigDecimal;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ingesoft.shop.dto.request.PaymentData;
import com.ingesoft.shop.entity.Payment;
import com.ingesoft.shop.repository.PaymentRepository;
import com.ingesoft.shop.service.IPaymentService;
import com.ingesoft.shop.service.payment.IPaymentProvider;
import com.ingesoft.shop.service.payment.PaymentResult;

/**
 * Implementación de {@link IPaymentService}: orquesta proveedor + persistencia
 * del pago.
 */
@Service
public class PaymentServiceImpl implements IPaymentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PaymentServiceImpl.class);

    private final IPaymentProvider paymentProvider;
    private final PaymentRepository paymentRepository;

    public PaymentServiceImpl(IPaymentProvider paymentProvider,
            PaymentRepository paymentRepository) {
        this.paymentProvider = paymentProvider;
        this.paymentRepository = paymentRepository;
    }

    @Override
    @Transactional
    public PaymentResult process(UUID orderId, BigDecimal amount, PaymentData paymentData) {
        if (orderId == null || paymentData == null) {
            throw new IllegalArgumentException("El pago requiere orderId y paymentData");
        }
        if (amount == null || amount.signum() < 0) {
            throw new IllegalArgumentException("El monto a cobrar debe ser >= 0");
        }

        PaymentResult result = paymentProvider.pay(amount, paymentData);

        Payment payment = new Payment(orderId, result.status(), providerName(),
                paymentData.method(), amount, result.transactionId(), result.failureReason());
        paymentRepository.save(payment);

        LOGGER.info("Pago de la orden {} persistido como {} (monto {})",
                orderId, result.status(), amount);
        return result;
    }

    private String providerName() {
        String simpleName = paymentProvider.getClass().getSimpleName();
        int separator = simpleName.indexOf("PaymentProvider");
        String base = separator > 0 ? simpleName.substring(0, separator) : simpleName;
        return base.toUpperCase();
    }
}
