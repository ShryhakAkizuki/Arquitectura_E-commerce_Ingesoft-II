package com.ingesoft.shop.repository;

import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ingesoft.shop.entity.Product;

/**
 * Repositorio de productos
 */
public interface ProductRepository extends JpaRepository<Product, UUID> {

    @Query("""
            SELECT p FROM Product p
            WHERE LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))
              AND (:onlyAvailable = FALSE OR p.available = TRUE)
            """)
    Page<Product> findCatalogPage(@Param("search") String search,
                                  @Param("onlyAvailable") boolean onlyAvailable,
                                  Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Product findByIdForUpdate(@Param("id") UUID id);
}
