package com.ingesoft.shop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

import com.ingesoft.shop.dto.request.ProductRequest;
import com.ingesoft.shop.dto.response.ProductResponse;
import com.ingesoft.shop.entity.Product;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.ProductRepository;
import com.ingesoft.shop.service.impl.ProductAdminServiceImpl;
import com.ingesoft.shop.service.impl.ProductServiceImpl;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    private ProductServiceImpl publicService;

    private ProductAdminServiceImpl adminService;

    @BeforeEach
    void setUp() {
        publicService = new ProductServiceImpl(productRepository);
        adminService = new ProductAdminServiceImpl(productRepository);
    }

    @Test
    @DisplayName("R2: crear producto con precio cero lanza 400 VALIDATION_ERROR")
    void create_precioInválido_lanzaErrorDeValidación() {
        ProductRequest request = new ProductRequest("Teclado mecánico", "Teclado 60%",
                BigDecimal.ZERO, 10, null);

        BusinessException ex = catchThrowableOfType(() -> adminService.create(request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThat(ex.getErrorCode().getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    @DisplayName("R2: crear producto con precio negativo lanza 400 VALIDATION_ERROR")
    void create_precioNegativo_lanzaErrorDeValidación() {
        ProductRequest request = new ProductRequest("Teclado mecánico", "Teclado 60%",
                new BigDecimal("-5"), 10, null);

        BusinessException ex = catchThrowableOfType(() -> adminService.create(request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    @DisplayName("R2: crear producto válido persiste la entidad y devuelve el DTO")
    void create_productoVálido_loPersisteYDevuelveRespuesta() {
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ProductRequest request = new ProductRequest("Teclado mecánico", "Teclado 60%",
                new BigDecimal("150000.00"), 10, null);

        ProductResponse response = adminService.create(request);

        verify(productRepository).save(any(Product.class));
        assertThat(response.name()).isEqualTo("Teclado mecánico");
        assertThat(response.price()).isEqualByComparingTo("150000.00");
        assertThat(response.stock()).isEqualTo(10);
        assertThat(response.available()).isTrue();
    }

    @Test
    @DisplayName("R5: el catálogo público consulta solo productos disponibles (onlyAvailable=true)")
    void list_catalogoPúblico_filtraSoloDisponibles() {
        Product disponible = new Product("Monitor", "Monitor 27\"",
                new BigDecimal("1200000.00"), 5, null);
        Page<ProductResponse> expected = new PageImpl<>(List.of(ProductResponse.from(disponible)));
        when(productRepository.findCatalogPage(anyString(), eq(true), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(disponible)));

        Page<ProductResponse> page = publicService.list(0, 20, "monitor", null);

        verify(productRepository).findCatalogPage(eq("monitor"), eq(true),
                eq(PageRequest.of(0, 20, Sort.by(Sort.Direction.ASC, "name"))));
        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).name()).isEqualTo("Monitor");
        assertThat(page.getContent().get(0).available()).isTrue();
    }

    @Test
    @DisplayName("R5: el listado admin incluye desactivados (onlyAvailable=false)")
    void listAll_listadoAdmin_incluyeDesactivados() {
        Product desactivado = new Product("Laptop", "Laptop 15\"",
                new BigDecimal("3500000.00"), 3, null);
        desactivado.setAvailable(false);
        when(productRepository.findCatalogPage(anyString(), anyBoolean(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(desactivado)));

        Page<ProductResponse> page = adminService.listAll(0, 20, null, null);

        verify(productRepository).findCatalogPage(eq(""), eq(false),
                eq(PageRequest.of(0, 20, Sort.by(Sort.Direction.ASC, "name"))));
        assertThat(page.getContent().get(0).available()).isFalse();
    }
}
