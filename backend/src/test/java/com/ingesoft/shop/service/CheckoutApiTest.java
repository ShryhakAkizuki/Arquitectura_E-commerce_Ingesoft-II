package com.ingesoft.shop.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class CheckoutApiTest {

    private static final String CABLE_USB_C = "00000000-0000-0000-0000-000000000105";
    private static final String TECLADO = "00000000-0000-0000-0000-000000000102";
    private static final String LAPTOP = "00000000-0000-0000-0000-000000000101";
    private static final String CARD_DECLINED = "4000000000000002";
    private static final String CARD_APPROVED = "4242424242424242";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("R4: POST /api/checkout con stock insuficiente responde 409 INSUFFICIENT_STOCK")
    void checkout_stockInsuficiente_responde409() throws Exception {
        String token = registerAndLogin("Comprador Stock", nuevoEmail());
        addToCart(token, CABLE_USB_C, 2);
        String adminToken = login("admin@demo.com", "Admin123!");
        mockMvc.perform(patch("/api/admin/products/" + CABLE_USB_C + "/stock")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stock\":1}"))
            .andExpect(status().isOk());

        checkout(token, CARD_APPROVED)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409))
            .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"))
            .andExpect(jsonPath("$.message").isNotEmpty());
        assertThat(myOrders(token).get("content")).isEmpty();

        mockMvc.perform(patch("/api/admin/products/" + CABLE_USB_C + "/stock")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stock\":2}"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("R4: POST /api/checkout con tarjeta ...0002 responde 402 y conserva la orden PENDING")
    void checkout_pagoRechazado_responde402YOrdenPendiente() throws Exception {
        String token = registerAndLogin("Comprador Rechazo", nuevoEmail());
        addToCart(token, TECLADO, 1);

        ResultActions result = checkout(token, CARD_DECLINED);
        result.andExpect(status().isPaymentRequired())
            .andExpect(jsonPath("$.status").value(402))
            .andExpect(jsonPath("$.code").value("PAYMENT_DECLINED"))
            .andExpect(jsonPath("$.message",
                    matchesPattern("El pago fue rechazado. La orden ORD-[A-F0-9]{8} quedó PENDING.*")));

        JsonNode orders = myOrders(token);
        assertThat(orders.get("totalElements").asInt()).isEqualTo(1);
        JsonNode order = orders.get("content").get(0);
        assertThat(order.get("status").asText()).isEqualTo("PENDING");
        assertThat(order.get("orderNumber").asText()).startsWith("ORD-");

        JsonNode detail = myOrderDetail(token, order.get("id").asText());
        assertThat(detail.get("payment").get("status").asText()).isEqualTo("FAILED");
        assertThat(detail.get("payment").get("failureReason").asText()).isNotEmpty();

        JsonNode product = getProduct(TECLADO);
        assertThat(product.get("stock").asInt()).isEqualTo(25);
    }

    @Test
    @DisplayName("R3: POST /api/checkout exitoso responde 201 con orden PAID, stock descontado y carrito vacio")
    void checkout_pagoExitoso_responde201OrdenPaid() throws Exception {
        String token = registerAndLogin("Comprador Exito", nuevoEmail());
        addToCart(token, LAPTOP, 2);

        String body = checkout(token, CARD_APPROVED)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.orderNumber").isNotEmpty())
            .andExpect(jsonPath("$.status").value("PAID"))
            .andExpect(jsonPath("$.items[0].quantity").value(2))
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode order = objectMapper.readTree(body);
        assertThat(order.get("subtotal").decimalValue())
                .isEqualByComparingTo(new BigDecimal("5199800.00"));
        assertThat(order.get("shipping").decimalValue())
                .isEqualByComparingTo(new BigDecimal("5000.00"));
        assertThat(order.get("total").decimalValue())
                .isEqualByComparingTo(new BigDecimal("5204800.00"));

        JsonNode product = getProduct(LAPTOP);
        assertThat(product.get("stock").asInt()).isEqualTo(8);

        JsonNode cart = getCart(token);
        assertThat(cart.get("items")).isEmpty();
    }

    private String nuevoEmail() {
        return "comprador-" + UUID.randomUUID() + "@demo.com";
    }

    private String login(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body).get("token").asText();
    }

    private String registerAndLogin(String name, String email) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"%s\",\"email\":\"%s\",\"password\":\"Contraseña123\"}"
                        .formatted(name, email)))
            .andExpect(status().isCreated());
        return login(email, "Contraseña123");
    }

    private void addToCart(String token, String productId, int quantity) throws Exception {
        mockMvc.perform(post("/api/cart/items")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"productId\":\"%s\",\"quantity\":%d}".formatted(productId, quantity)))
            .andExpect(status().isOk());
    }

    private ResultActions checkout(String token, String cardNumber) throws Exception {
        return mockMvc.perform(post("/api/checkout")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"shippingAddress":"Calle 123 #45-67",
                         "payment":{"method":"TARJETA","cardNumber":"%s","cardholderName":"Comprador Demo"}}"""
                        .formatted(cardNumber)));
    }

    private JsonNode myOrders(String token) throws Exception {
        String body = mockMvc.perform(get("/api/orders/mine")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }

    private JsonNode myOrderDetail(String token, String orderId) throws Exception {
        String body = mockMvc.perform(get("/api/orders/mine/" + orderId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }

    private JsonNode getProduct(String productId) throws Exception {
        String body = mockMvc.perform(get("/api/products/" + productId))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }

    private JsonNode getCart(String token) throws Exception {
        String body = mockMvc.perform(get("/api/cart")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body);
    }
}
