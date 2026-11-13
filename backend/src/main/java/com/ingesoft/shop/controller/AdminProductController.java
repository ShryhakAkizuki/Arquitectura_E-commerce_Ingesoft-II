package com.ingesoft.shop.controller;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ingesoft.shop.dto.request.AdjustStockRequest;
import com.ingesoft.shop.dto.request.ProductRequest;
import com.ingesoft.shop.dto.response.ProductResponse;
import com.ingesoft.shop.service.IProductAdminService;

import jakarta.validation.Valid;

/**
 * Gestion CRUD + stock de productos para administradores
 */
@RestController
@RequestMapping("/api/admin/products")
@PreAuthorize("hasRole('ADMIN')")
public class AdminProductController {

    private final IProductAdminService productAdminService;

    public AdminProductController(IProductAdminService productAdminService) {
        this.productAdminService = productAdminService;
    }

    @GetMapping
    public Page<ProductResponse> listAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort) {
        return productAdminService.listAll(page, size, search, sort);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        ProductResponse created = productAdminService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable UUID id,
            @Valid @RequestBody ProductRequest request) {
        return productAdminService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ProductResponse deactivate(@PathVariable UUID id) {
        return productAdminService.deactivate(id);
    }

    @PatchMapping("/{id}/stock")
    public ProductResponse adjustStock(@PathVariable UUID id,
            @Valid @RequestBody AdjustStockRequest request) {
        return productAdminService.adjustStock(id, request);
    }
}
