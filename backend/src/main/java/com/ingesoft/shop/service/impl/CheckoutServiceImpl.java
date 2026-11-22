package com.ingesoft.shop.service.impl;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.ingesoft.shop.dto.request.CheckoutRequest;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.entity.Cart;
import com.ingesoft.shop.entity.CartItem;
import com.ingesoft.shop.entity.Order;
import com.ingesoft.shop.entity.OrderItem;
import com.ingesoft.shop.entity.Product;
import com.ingesoft.shop.entity.User;
import com.ingesoft.shop.enums.OrderStatus;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.CartItemRepository;
import com.ingesoft.shop.repository.CartRepository;
import com.ingesoft.shop.repository.OrderRepository;
import com.ingesoft.shop.repository.ProductRepository;
import com.ingesoft.shop.repository.UserRepository;
import com.ingesoft.shop.service.ICheckoutService;
import com.ingesoft.shop.service.IPaymentService;
import com.ingesoft.shop.service.payment.PaymentResult;

/**
 * Implementacion de {@link ICheckoutService}: el flujo completo del
 * checkout, transaccional.
 */
@Service
public class CheckoutServiceImpl implements ICheckoutService {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderRepository orderRepository;
    private final IPaymentService paymentService;
    private final TransactionTemplate transactionTemplate;

    @Value("${checkout.shipping-fee:5000.00}")
    private BigDecimal shippingFee;

    public CheckoutServiceImpl(UserRepository userRepository,
            ProductRepository productRepository,
            CartRepository cartRepository,
            CartItemRepository cartItemRepository,
            OrderRepository orderRepository,
            IPaymentService paymentService,
            TransactionTemplate transactionTemplate) {
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.orderRepository = orderRepository;
        this.paymentService = paymentService;
        this.transactionTemplate = transactionTemplate;
    }

    @Override
    public OrderResponse checkout(String email, CheckoutRequest request) {
        CheckoutOutcome outcome = transactionTemplate.execute(
                status -> performCheckout(email, request));
        if (outcome == null) {
            throw new IllegalStateException("El checkout no devolvió ningún resultado");
        }
        if (outcome.isDeclined()) {
            String message = "El pago fue rechazado. La orden " + outcome.declinedOrderNumber()
                    + " quedó PENDING; reintente el pago con ese número de orden.";
            throw new BusinessException(ErrorCode.PAYMENT_DECLINED, message);
        }
        return outcome.orderResponse();
    }

    /**
     * Ejecuta el flujo completo del §6 dentro de la transacción del
     * llamador.
     */
    private CheckoutOutcome performCheckout(String email, CheckoutRequest request) {
        User user = findUserByEmail(email);
        Cart cart = findOrCreateCart(user);

        List<CartItem> lockedItems = cartItemRepository.findByCartIdForUpdate(cart.getId());

        if (lockedItems.isEmpty()) {
            throw new BusinessException(ErrorCode.CART_EMPTY,
                    "El carrito está vacío; agregue productos antes de finalizar la compra");
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        for (CartItem item : lockedItems) {
            Product product = productRepository.findByIdForUpdate(item.getProduct().getId());
            if (product == null) {
                throw new BusinessException(ErrorCode.PRODUCT_NOT_FOUND,
                        "El producto " + item.getProduct().getId() + " ya no existe");
            }
            if (item.getQuantity() > product.getStock()) {
                throw new BusinessException(ErrorCode.INSUFFICIENT_STOCK, String.format(
                        "El producto '%s' no tiene suficiente stock (disponible: %d, solicitado: %d)",
                        product.getName(), product.getStock(), item.getQuantity()));
            }
            subtotal = subtotal.add(item.lineTotal());
        }

        BigDecimal total = subtotal.add(shippingFee);

        Order order = new Order(user, newOrderNumber(), OrderStatus.PENDING,
                subtotal, shippingFee, total, request.shippingAddress());
        for (CartItem item : lockedItems) {
            Product product = item.getProduct();
            order.addItem(new OrderItem(order, product, product.getName(),
                    item.getUnitPrice(), item.getQuantity()));
        }
        Order savedOrder = orderRepository.save(order);

        PaymentResult result = paymentService.process(savedOrder.getId(),
                savedOrder.getTotal(), request.payment());
        if (result.isConfirmed()) {
            for (CartItem item : lockedItems) {
                Product product = item.getProduct();
                product.setStock(product.getStock() - item.getQuantity());
            }
            savedOrder.changeStatus(OrderStatus.PAID);
            for (CartItem item : lockedItems) {
                cart.removeItem(item);
            }
            return CheckoutOutcome.confirmed(OrderResponse.from(savedOrder));
        }

        return CheckoutOutcome.declined(savedOrder.getOrderNumber());
    }

    private String newOrderNumber() {
        return "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "No existe un usuario con el email " + email));
    }

    private Cart findOrCreateCart(User user) {
        return cartRepository.findByUserId(user.getId())
                .orElseGet(() -> cartRepository.save(new Cart(user)));
    }

    private record CheckoutOutcome(OrderResponse orderResponse, String declinedOrderNumber) {

        static CheckoutOutcome confirmed(OrderResponse response) {
            return new CheckoutOutcome(response, null);
        }

        static CheckoutOutcome declined(String orderNumber) {
            return new CheckoutOutcome(null, orderNumber);
        }

        boolean isDeclined() {
            return declinedOrderNumber != null;
        }
    }
}
