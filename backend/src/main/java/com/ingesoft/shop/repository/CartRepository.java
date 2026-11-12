package com.ingesoft.shop.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ingesoft.shop.entity.Cart;

/**
 * Repositorio de carritos
 */
public interface CartRepository extends JpaRepository<Cart, UUID> {

    Optional<Cart> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);
}
