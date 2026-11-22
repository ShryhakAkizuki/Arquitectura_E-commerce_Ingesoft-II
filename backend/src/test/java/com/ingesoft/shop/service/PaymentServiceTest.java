package com.ingesoft.shop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ingesoft.shop.dto.request.PaymentData;
import com.ingesoft.shop.entity.Payment;
import com.ingesoft.shop.enums.PaymentStatus;
import com.ingesoft.shop.repository.PaymentRepository;
import com.ingesoft.shop.service.impl.PaymentServiceImpl;
import com.ingesoft.shop.service.payment.PaymentResult;
import com.ingesoft.shop.service.payment.SimulatedPaymentProvider;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    private static final UUID ORDER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock
    private PaymentRepository paymentRepository;

    private SimulatedPaymentProvider provider;
    private PaymentServiceImpl service;

    @BeforeEach
    void setUp() {
        provider = new SimulatedPaymentProvider("0002");
        service = new PaymentServiceImpl(provider, paymentRepository);
    }

    @Test
    @DisplayName("R4: pago confirmado persiste el Payment CONFIRMED con su transactionId")
    void process_pagoConfirmado_persistePagoConfirmado() {
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        PaymentData data = new PaymentData("tarjeta", "4242424242424242", "Ana Test");
        BigDecimal amount = new BigDecimal("5240.00");

        PaymentResult result = service.process(ORDER_ID, amount, data);

        assertThat(result.isConfirmed()).isTrue();
        assertThat(result.status()).isEqualTo(PaymentStatus.CONFIRMED);
        assertThat(result.transactionId()).startsWith("SIM-");
        assertThat(result.failureReason()).isNull();

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        Payment saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(PaymentStatus.CONFIRMED);
        assertThat(saved.getOrderId()).isEqualTo(ORDER_ID);
        assertThat(saved.getTransactionId()).isEqualTo(result.transactionId());
        assertThat(saved.getFailureReason()).isNull();
        assertThat(saved.getProvider()).isEqualTo("SIMULATED");
        assertThat(saved.getMethod()).isEqualTo("tarjeta");
        assertThat(saved.getAmount()).isEqualByComparingTo("5240.00");
    }

    @Test
    @DisplayName("R4: tarjeta ...0002 => Payment persistido FAILED con su failureReason")
    void process_pagoRechazado_persistePagoFallido() {
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        PaymentData data = new PaymentData("tarjeta", "42424242420002", "Ana Test");
        BigDecimal amount = new BigDecimal("5240.00");

        PaymentResult result = service.process(ORDER_ID, amount, data);

        assertThat(result.isConfirmed()).isFalse();
        assertThat(result.status()).isEqualTo(PaymentStatus.FAILED);
        assertThat(result.transactionId()).isNull();
        assertThat(result.failureReason()).contains("0002");

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        Payment saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(saved.getFailureReason()).isEqualTo(result.failureReason());
        assertThat(saved.getTransactionId()).isNull();
        assertThat(saved.getProvider()).isEqualTo("SIMULATED");
        assertThat(saved.getOrderId()).isEqualTo(ORDER_ID);
    }

    @Test
    @DisplayName("R4: sin orderId no se procesa ni persiste nada")
    void process_sinOrderId_lanzaIllegalArgumentException() {
        PaymentData data = new PaymentData("tarjeta", "4242424242424242", "Ana Test");

        IllegalArgumentException ex = catchThrowableOfType(
                () -> service.process(null, new BigDecimal("10.00"), data),
                IllegalArgumentException.class);

        assertThat(ex).isNotNull();
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("R4: monto negativo no se procesa ni persiste nada")
    void process_montoNegativo_lanzaIllegalArgumentException() {
        PaymentData data = new PaymentData("tarjeta", "4242424242424242", "Ana Test");

        IllegalArgumentException ex = catchThrowableOfType(
                () -> service.process(ORDER_ID, new BigDecimal("-1"), data),
                IllegalArgumentException.class);

        assertThat(ex).isNotNull();
        verify(paymentRepository, never()).save(any(Payment.class));
    }
}
