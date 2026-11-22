package com.ingesoft.shop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ingesoft.shop.dto.request.CheckoutRequest;
import com.ingesoft.shop.dto.request.PaymentData;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.entity.Cart;
import com.ingesoft.shop.entity.CartItem;
import com.ingesoft.shop.entity.Order;
import com.ingesoft.shop.entity.Product;
import com.ingesoft.shop.entity.User;
import com.ingesoft.shop.enums.OrderStatus;
import com.ingesoft.shop.enums.Role;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.CartItemRepository;
import com.ingesoft.shop.repository.CartRepository;
import com.ingesoft.shop.repository.OrderRepository;
import com.ingesoft.shop.repository.ProductRepository;
import com.ingesoft.shop.repository.UserRepository;
import com.ingesoft.shop.service.impl.CheckoutServiceImpl;
import com.ingesoft.shop.service.IPaymentService;
import com.ingesoft.shop.service.payment.PaymentResult;

@ExtendWith(MockitoExtension.class)
class CheckoutServiceTest {

    private static final String EMAIL = "user@demo.com";
    private static final BigDecimal SHIPPING_FEE = new BigDecimal("5000.00");
    private static final PaymentData PAYMENT_DATA =
            new PaymentData("tarjeta", "4242424242424242", "Ana Test");

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CartRepository cartRepository;

    @Mock
    private CartItemRepository cartItemRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private IPaymentService paymentService;

    @Mock
    private TransactionTemplate transactionTemplate;

    private User user;
    private Cart cart;
    private Product product;
    private CheckoutServiceImpl service;

    @BeforeEach
    void setUp() {
        user = new User("Ana Test", EMAIL, "hash-bcrypt-simulado", Role.USER);
        cart = new Cart(user);
        product = new Product("Cable USB-C 100W", "Cable USB-C de carga rapida",
                new BigDecimal("120.00"), 3, null);
        service = new CheckoutServiceImpl(userRepository, productRepository, cartRepository,
                cartItemRepository, orderRepository, paymentService, transactionTemplate);
        ReflectionTestUtils.setField(service, "shippingFee", SHIPPING_FEE);
    }

    private CartItem addCartItem(int quantity, BigDecimal unitPrice) {
        CartItem item = new CartItem(cart, product, quantity, unitPrice);
        cart.addItem(item);
        return item;
    }

    private void stubTransactionCallback() {
        when(transactionTemplate.execute(any(TransactionCallback.class)))
                .thenAnswer(invocation -> invocation.getArgument(0, TransactionCallback.class)
                        .doInTransaction(null));
    }

    @Test
    @DisplayName("R4: stock insuficiente lanza 409 INSUFFICIENT_STOCK y nada se persiste")
    void checkout_stockInsuficiente_lanzaConflictoYNoPersiste() {
        CartItem item = addCartItem(5, new BigDecimal("120.00"));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(cartRepository.findByUserId(any())).thenReturn(Optional.of(cart));
        when(cartItemRepository.findByCartIdForUpdate(any())).thenReturn(List.of(item));
        when(productRepository.findByIdForUpdate(any())).thenReturn(product);
        stubTransactionCallback();
        CheckoutRequest request = new CheckoutRequest("Calle 1 # 2-3", PAYMENT_DATA);

        BusinessException ex = catchThrowableOfType(() -> service.checkout(EMAIL, request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INSUFFICIENT_STOCK);
        assertThat(ex.getErrorCode().getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(ex.getMessage()).contains("Cable USB-C 100W");
        verify(orderRepository, never()).save(any(Order.class));
        verify(paymentService, never()).process(any(), any(), any());
        assertThat(product.getStock()).isEqualTo(3);
        assertThat(cart.getItems()).hasSize(1);
    }

    @Test
    @DisplayName("R4: pago rechazado (tarjeta ...0002) conserva la orden PENDING, stock y carrito")
    void checkout_pagoRechazado_dejaOrdenPendingSinDescontarStock() {
        CartItem item = addCartItem(2, new BigDecimal("120.00"));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(cartRepository.findByUserId(any())).thenReturn(Optional.of(cart));
        when(cartItemRepository.findByCartIdForUpdate(any())).thenReturn(List.of(item));
        when(productRepository.findByIdForUpdate(any())).thenReturn(product);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentService.process(any(), any(), any()))
                .thenReturn(PaymentResult.failed(
                        "La pasarela rechazo el pago: tarjeta terminada en 0002"));
        stubTransactionCallback();
        CheckoutRequest request = new CheckoutRequest("Calle 1 # 2-3", PAYMENT_DATA);

        BusinessException ex = catchThrowableOfType(() -> service.checkout(EMAIL, request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_DECLINED);
        assertThat(ex.getErrorCode().getStatus()).isEqualTo(HttpStatus.PAYMENT_REQUIRED);

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(saved.getOrderNumber()).startsWith("ORD-");
        assertThat(ex.getMessage()).contains(saved.getOrderNumber());
        assertThat(saved.getTotal()).isEqualByComparingTo("5240.00");
        assertThat(product.getStock()).isEqualTo(3);
        assertThat(cart.getItems()).hasSize(1);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(paymentService).process(any(), amountCaptor.capture(), eq(PAYMENT_DATA));
        assertThat(amountCaptor.getValue()).isEqualByComparingTo("5240.00");
    }

    @Test
    @DisplayName("R4: pago exitoso descuenta el stock, pasa la orden a PAID y vacia el carrito")
    void checkout_pagoExitoso_descuentaStockPagaOrdenYVaciaCarrito() {
        CartItem item = addCartItem(2, new BigDecimal("120.00"));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(cartRepository.findByUserId(any())).thenReturn(Optional.of(cart));
        when(cartItemRepository.findByCartIdForUpdate(any())).thenReturn(List.of(item));
        when(productRepository.findByIdForUpdate(any())).thenReturn(product);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentService.process(any(), any(), any()))
                .thenReturn(PaymentResult.confirmed("SIM-9f8e7d6c"));
        stubTransactionCallback();
        CheckoutRequest request = new CheckoutRequest("Calle 1 # 2-3", PAYMENT_DATA);

        OrderResponse response = service.checkout(EMAIL, request);

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(saved.getSubtotal()).isEqualByComparingTo("240.00");
        assertThat(saved.getShipping()).isEqualByComparingTo("5000.00");
        assertThat(saved.getTotal()).isEqualByComparingTo("5240.00");
        assertThat(saved.getItems()).hasSize(1);

        assertThat(product.getStock()).isEqualTo(1);
        assertThat(cart.getItems()).isEmpty();

        assertThat(response.status()).isEqualTo(OrderStatus.PAID);
        assertThat(response.orderNumber()).startsWith("ORD-");
        assertThat(response.total()).isEqualByComparingTo("5240.00");
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).productName()).isEqualTo("Cable USB-C 100W");
        assertThat(response.items().get(0).lineTotal()).isEqualByComparingTo("240.00");
    }

    @Test
    @DisplayName("R4: carrito vacio lanza 409 CART_EMPTY sin validar stock ni procesar pagos")
    void checkout_carritoVacio_lanzaCartEmpty() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(cartRepository.findByUserId(any())).thenReturn(Optional.of(cart));
        when(cartItemRepository.findByCartIdForUpdate(any())).thenReturn(List.of());
        stubTransactionCallback();
        CheckoutRequest request = new CheckoutRequest("Calle 1 # 2-3", PAYMENT_DATA);

        BusinessException ex = catchThrowableOfType(() -> service.checkout(EMAIL, request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CART_EMPTY);
        assertThat(ex.getErrorCode().getStatus()).isEqualTo(HttpStatus.CONFLICT);
        verify(productRepository, never()).findByIdForUpdate(any());
        verify(orderRepository, never()).save(any(Order.class));
        verify(paymentService, never()).process(any(), any(), any());
    }
}
