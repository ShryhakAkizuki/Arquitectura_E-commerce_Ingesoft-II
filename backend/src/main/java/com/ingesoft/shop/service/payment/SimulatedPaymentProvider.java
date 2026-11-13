package com.ingesoft.shop.service.payment;

import java.math.BigDecimal;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.ingesoft.shop.dto.request.PaymentData;

/**
 * Proveedor de pago SIMULADO
 */
@Component
public class SimulatedPaymentProvider implements IPaymentProvider {

    private static final Logger LOGGER = LoggerFactory.getLogger(SimulatedPaymentProvider.class);

    private final String declinedSuffix;

    public SimulatedPaymentProvider(@Value("${checkout.card-declined-suffix}") String declinedSuffix) {
        this.declinedSuffix = declinedSuffix;
    }

    @Override
    public PaymentResult pay(BigDecimal amount, PaymentData paymentData) {
        String cardDigits = digitsOnly(paymentData.cardNumber());
        if (cardDigits.endsWith(declinedSuffix)) {
            LOGGER.info("Pago simulado RECHAZADO: tarjeta termina en {} (monto {})", declinedSuffix, amount);
            return PaymentResult.failed("La pasarela rechazo el pago: tarjeta terminada en " + declinedSuffix);
        }
        String transactionId = "SIM-" + UUID.randomUUID();
        LOGGER.info("Pago simulado CONFIRMADO: monto {}, transactionId {}", amount, transactionId);
        return PaymentResult.confirmed(transactionId);
    }

    private String digitsOnly(String cardNumber) {
        if (cardNumber == null) {
            return "";
        }
        return cardNumber.replaceAll("\\D", "");
    }
}
