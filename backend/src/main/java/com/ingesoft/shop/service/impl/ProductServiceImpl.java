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

import com.ingesoft.shop.dto.response.ProductResponse;
import com.ingesoft.shop.entity.Product;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.ProductRepository;
import com.ingesoft.shop.service.IProductService;

/**
 * Implementación de {@link IProductService}
 */
@Service
public class ProductServiceImpl implements IProductService {

    private static final Set<String> SORTABLE_FIELDS = Set.of("name", "price", "stock", "updatedAt");

    private static final String DEFAULT_SORT_FIELD = "name";

    private final ProductRepository productRepository;

    public ProductServiceImpl(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductResponse> list(int page, int size, String search, String sort) {
        String normalizedSearch = (search == null || search.isBlank()) ? null : search.trim();
        Pageable pageable = toPageable(page, size, sort);
        return productRepository.findCatalogPage(normalizedSearch, true, pageable)
                .map(ProductResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse getById(UUID id) {
        Product product = productRepository.findById(id)
                .filter(Product::isAvailable)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND,
                        "El producto " + id + " no existe o no está disponible"));
        return ProductResponse.from(product);
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
