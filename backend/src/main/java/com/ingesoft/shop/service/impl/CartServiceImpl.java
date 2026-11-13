package com.ingesoft.shop.service.impl;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ingesoft.shop.dto.request.AddCartItemRequest;
import com.ingesoft.shop.dto.request.UpdateCartItemRequest;
import com.ingesoft.shop.dto.response.CartResponse;
import com.ingesoft.shop.entity.Cart;
import com.ingesoft.shop.entity.CartItem;
import com.ingesoft.shop.entity.Product;
import com.ingesoft.shop.entity.User;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.CartItemRepository;
import com.ingesoft.shop.repository.CartRepository;
import com.ingesoft.shop.repository.ProductRepository;
import com.ingesoft.shop.repository.UserRepository;
import com.ingesoft.shop.service.ICartService;

/**
 * Implementación de {@link ICartService}
 */
@Service
public class CartServiceImpl implements ICartService {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;

    public CartServiceImpl(UserRepository userRepository,
            ProductRepository productRepository,
            CartRepository cartRepository,
            CartItemRepository cartItemRepository) {
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
    }

    @Override
    @Transactional
    public CartResponse get(String email) {
        Cart cart = findOrCreateCart(email);
        return CartResponse.from(cart);
    }

    @Override
    @Transactional
    public CartResponse add(String email, AddCartItemRequest request) {
        Cart cart = findOrCreateCart(email);
        Product product = findAvailableProduct(request.productId());

        CartItem existing = cart.getItems().stream()
                .filter(item -> item.getProduct().getId().equals(product.getId()))
                .findFirst()
                .orElse(null);

        int newQuantity = (existing != null ? existing.getQuantity() : 0) + request.quantity();
        assertSufficientStock(product, newQuantity);

        if (existing != null) {
            existing.setQuantity(newQuantity);
        } else {
            cart.addItem(new CartItem(cart, product, request.quantity(), product.getPrice()));
        }
        return CartResponse.from(cartRepository.save(cart));
    }

    @Override
    @Transactional
    public CartResponse updateQuantity(String email, UUID itemId, UpdateCartItemRequest request) {
        Cart cart = findOrCreateCart(email);
        CartItem item = findOwnedItem(cart, itemId);
        assertSufficientStock(item.getProduct(), request.quantity());
        item.setQuantity(request.quantity());
        return CartResponse.from(cart);
    }

    @Override
    @Transactional
    public CartResponse remove(String email, UUID itemId) {
        Cart cart = findOrCreateCart(email);
        CartItem item = findOwnedItem(cart, itemId);
        cart.removeItem(item);
        return CartResponse.from(cart);
    }

    private Cart findOrCreateCart(String email) {
        User user = findUserByEmail(email);
        return cartRepository.findByUserId(user.getId())
                .orElseGet(() -> cartRepository.save(new Cart(user)));
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "No existe un usuario con el email " + email));
    }

    private Product findAvailableProduct(UUID productId) {
        return productRepository.findById(productId)
                .filter(Product::isAvailable)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND,
                        "El producto " + productId + " no existe o no está disponible"));
    }

    private CartItem findOwnedItem(Cart cart, UUID itemId) {
        return cartItemRepository.findById(itemId)
                .filter(item -> item.getCart().getId().equals(cart.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "El ítem " + itemId + " no existe en su carrito"));
    }

    private void assertSufficientStock(Product product, int requested) {
        if (requested > product.getStock()) {
            throw new BusinessException(ErrorCode.INSUFFICIENT_STOCK, String.format(
                    "El producto '%s' no tiene suficiente stock (disponible: %d, solicitado: %d)",
                    product.getName(), product.getStock(), requested));
        }
    }
}
