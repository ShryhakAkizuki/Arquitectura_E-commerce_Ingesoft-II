package com.ingesoft.shop.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ingesoft.shop.entity.OrderItem;

/**
 * Repositorio de items de orden (historico inmutable de la compra, R3).
 */
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    List<OrderItem> findByOrderId(UUID orderId);
}
