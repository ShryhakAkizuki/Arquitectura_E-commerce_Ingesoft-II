package com.ingesoft.shop.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.ingesoft.shop.entity.Product;

/**
 * Vista de producto para el catálogo público
 */
public record ProductResponse(
        UUID id,
        String name,
        String description,
        BigDecimal price,
        int stock,
        String imageUrl,
        boolean available,
        OffsetDateTime updatedAt) {

    public static ProductResponse from(Product product) {
        return new ProductResponse(product.getId(), product.getName(), product.getDescription(),
                product.getPrice(), product.getStock(), product.getImageUrl(),
                product.isAvailable(), product.getUpdatedAt());
    }
}
