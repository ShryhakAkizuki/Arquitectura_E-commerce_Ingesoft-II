package com.ingesoft.shop.entity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.ingesoft.shop.enums.PaymentStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Registro de pago asociado a una orden
 */
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "order_id", nullable = false, updatable = false)
    private UUID orderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PaymentStatus status;

    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "method", nullable = false, length = 50)
    private String method;

    @Column(name = "transaction_id", length = 64)
    private String transactionId;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    protected Payment() {
    }

    public Payment(UUID orderId, PaymentStatus status, String provider, String method,
                   BigDecimal amount, String transactionId, String failureReason) {
        if (orderId == null || status == null || provider == null || provider.isBlank()
                || method == null || method.isBlank() || amount == null || amount.signum() < 0) {
            throw new IllegalArgumentException(
                    "El pago requiere orderId, status, provider, method y un amount >= 0");
        }
        this.orderId = orderId;
        this.status = status;
        this.provider = provider;
        this.method = method;
        this.amount = amount;
        this.transactionId = transactionId;
        this.failureReason = failureReason;
        this.processedAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public PaymentStatus getStatus() {
        return status;
    }

    public String getProvider() {
        return provider;
    }

    public String getMethod() {
        return method;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public OffsetDateTime getProcessedAt() {
        return processedAt;
    }

    public boolean isConfirmed() {
        return status == PaymentStatus.CONFIRMED;
    }
}
