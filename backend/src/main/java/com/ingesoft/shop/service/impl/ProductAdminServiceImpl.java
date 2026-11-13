package com.ingesoft.shop.service.impl;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ingesoft.shop.dto.request.AdjustStockRequest;
import com.ingesoft.shop.dto.request.ProductRequest;
import com.ingesoft.shop.dto.response.ProductResponse;
import com.ingesoft.shop.entity.Product;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.ProductRepository;
import com.ingesoft.shop.service.IProductAdminService;

/**
 * Implementación de {@link IProductAdminService}
 */
@Service
public class ProductAdminServiceImpl implements IProductAdminService {

    private static final Set<String> SORTABLE_FIELDS = Set.of("name", "price", "stock", "available", "updatedAt");

    private static final String DEFAULT_SORT_FIELD = "name";

    private final ProductRepository productRepository;

    public ProductAdminServiceImpl(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductResponse> listAll(int page, int size, String search, String sort) {

        String normalizedSearch = (search == null || search.isBlank()) ? "" : search.trim();
        Pageable pageable = toPageable(page, size, sort);
        return productRepository.findCatalogPage(normalizedSearch, false, pageable)
                .map(ProductResponse::from);
    }

    @Override
    @Transactional
    public ProductResponse create(ProductRequest request) {
        validate(request);
        Product product = new Product(request.name(), request.description(),
                request.price(), request.stock(), request.imageUrl());
        return ProductResponse.from(productRepository.save(product));
    }

    @Override
    @Transactional
    public ProductResponse update(UUID id, ProductRequest request) {
        validate(request);
        Product product = findProduct(id);
        product.setName(request.name());
        product.setDescription(request.description());
        product.setPrice(request.price());
        product.setStock(request.stock());
        product.setImageUrl(request.imageUrl());
        return ProductResponse.from(productRepository.save(product));
    }

    @Override
    @Transactional
    public ProductResponse deactivate(UUID id) {
        Product product = findProduct(id);
        product.setAvailable(false);
        return ProductResponse.from(productRepository.save(product));
    }

    @Override
    @Transactional
    public ProductResponse adjustStock(UUID id, AdjustStockRequest request) {
        validate(request);
        Product product = findProduct(id);
        product.setStock(request.stock());
        return ProductResponse.from(productRepository.save(product));
    }

    private void validate(ProductRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "El nombre es obligatorio");
        }
        if (request.description() == null || request.description().isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "La descripción es obligatoria");
        }
        if (request.price() == null || request.price().signum() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "El precio debe ser mayor que cero");
        }
        if (request.stock() == null || request.stock() < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "El stock no puede ser negativo");
        }
    }

    private void validate(AdjustStockRequest request) {
        if (request.stock() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "El stock es obligatorio");
        }
        if (request.stock() < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "El stock no puede ser negativo");
        }
    }

    private Product findProduct(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND,
                        "El producto " + id + " no existe"));
    }

    private Pageable toPageable(int page, int size, String sort) {
        String field = DEFAULT_SORT_FIELD;
        Sort.Direction direction = Sort.Direction.ASC;
        if (sort != null && !sort.isBlank()) {
            String[] parts = sort.trim().split(",");
            String candidate = parts[0].trim().toLowerCase(Locale.ROOT);
            if (SORTABLE_FIELDS.contains(candidate)) {
                field = candidate;
            }
            if (parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())) {
                direction = Sort.Direction.DESC;
            }
        }
        return PageRequest.of(page, size, Sort.by(direction, field));
    }
}
