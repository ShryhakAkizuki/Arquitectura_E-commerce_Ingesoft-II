package com.ingesoft.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada del backend del e-commerce (Ingesoft II).
 *
 * Regla de dependencias por capas:
 * Controller → Service (interface) → Repository → Database.
 */
@SpringBootApplication
public class ShopApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShopApplication.class, args);
    }
}
