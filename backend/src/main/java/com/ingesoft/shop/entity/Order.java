package com.ingesoft.shop.entity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.ingesoft.shop.enums.OrderStatus;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Orden de compra: historico inmutable de una transaccion
 */
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "order_number", nullable = false, unique = true, length = 40)
    private String orderNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private OrderStatus status;

    @Column(name = "subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "shipping", nullable = false, precision = 12, scale = 2)
    private BigDecimal shipping;

    @Column(name = "total", nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "shipping_address", nullable = false, length = 255)
    private String shippingAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    protected Order() {
    }

    public Order(User user, String orderNumber, OrderStatus status, BigDecimal subtotal,
                 BigDecimal shipping, BigDecimal total, String shippingAddress) {
        if (user == null || orderNumber == null || orderNumber.isBlank() || status == null
                || subtotal == null || subtotal.signum() < 0 || shipping == null
                || shipping.signum() < 0 || total == null || total.signum() < 0
                || shippingAddress == null || shippingAddress.isBlank()) {
            throw new IllegalArgumentException(
                    "La orden requiere usuario, orderNumber, status, montos >= 0 y direccion de envio");
        }
        this.user = user;
        this.orderNumber = orderNumber;
        this.status = status;
        this.subtotal = subtotal;
        this.shipping = shipping;
        this.total = total;
        this.shippingAddress = shippingAddress;
    }

    @PrePersist
    void ensureCreatedAt() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    public void changeStatus(OrderStatus newStatus) {
        if (newStatus == null) {
            throw new IllegalArgumentException("El nuevo estado de la orden no puede ser nulo");
        }
        this.status = newStatus;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getShipping() {
        return shipping;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public String getShippingAddress() {
        return shippingAddress;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public List<OrderItem> getItems() {
        return items;
    }
}
