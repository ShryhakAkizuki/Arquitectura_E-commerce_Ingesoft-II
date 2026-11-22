package com.ingesoft.shop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.ingesoft.shop.dto.request.LoginRequest;
import com.ingesoft.shop.dto.request.RegisterRequest;
import com.ingesoft.shop.dto.response.LoginResponse;
import com.ingesoft.shop.dto.response.UserResponse;
import com.ingesoft.shop.entity.User;
import com.ingesoft.shop.enums.Role;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.UserRepository;
import com.ingesoft.shop.security.JwtTokenProvider;
import com.ingesoft.shop.service.impl.AuthServiceImpl;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String EMAIL = "ana@demo.com";
    private static final String PASSWORD = "Contraseña123";
    private static final String BCRYPT_HASH = "$2a$10$hashSimuladoParaTest";

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AuthServiceImpl(userRepository, passwordEncoder, jwtTokenProvider);
    }

    @Test
    @DisplayName("R1: registrar con email ya existente lanza 409 EMAIL_ALREADY_REGISTERED")
    void register_emailRepetido_lanzaConflicto() {
        // Arrangement: el email ya está registrado en la base de datos
        when(userRepository.existsByEmail(EMAIL)).thenReturn(true);
        RegisterRequest request = new RegisterRequest("Ana", EMAIL, PASSWORD);

        // Action
        BusinessException ex = catchThrowableOfType(() -> service.register(request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.EMAIL_ALREADY_REGISTERED);
        assertThat(ex.getErrorCode().getStatus()).isEqualTo(HttpStatus.CONFLICT);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("R1: registrar hashea la contraseña y asigna rol USER por defecto")
    void register_contradenaCorrecta_hashLaContraseñaYRolaUsuarioPorDefecto() {
        when(userRepository.existsByEmail("nuevo@demo.com")).thenReturn(false);
        when(passwordEncoder.encode(PASSWORD)).thenReturn(BCRYPT_HASH);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        RegisterRequest request = new RegisterRequest("Nuevo Usuario", "nuevo@demo.com", PASSWORD);

        UserResponse response = service.register(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPasswordHash()).isEqualTo(BCRYPT_HASH);
        assertThat(captor.getValue().getRole()).isEqualTo(Role.USER);
        assertThat(response.email()).isEqualTo("nuevo@demo.com");
        assertThat(response.role()).isEqualTo(Role.USER);
    }

    @Test
    @DisplayName("R1: login con contraseña incorrecta lanza 401 INVALID_CREDENTIALS")
    void login_contraseñaIncorrecta_lanzaCredencialesInválidas() {
        User user = new User("Ana", EMAIL, BCRYPT_HASH, Role.USER);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Password123", BCRYPT_HASH)).thenReturn(false);
        LoginRequest request = new LoginRequest(EMAIL, "Password123");

        BusinessException ex = catchThrowableOfType(() -> service.login(request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS);
        assertThat(ex.getErrorCode().getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(jwtTokenProvider, never()).generateToken(any(User.class));
    }

    @Test
    @DisplayName("R1: login con email inexistente lanza 401 INVALID_CREDENTIALS")
    void login_emailInexistente_lanzaCredencialesInválidas() {
        when(userRepository.findByEmail("nadie@demo.com")).thenReturn(Optional.empty());
        LoginRequest request = new LoginRequest("nadie@demo.com", PASSWORD);

        BusinessException ex = catchThrowableOfType(() -> service.login(request),
                BusinessException.class);

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS);
        assertThat(ex.getErrorCode().getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(jwtTokenProvider, never()).generateToken(any(User.class));
    }

    @Test
    @DisplayName("R1: login correcto emite el JWT y el perfil del usuario")
    void login_correcto_emiteTokenYPerfil() {
        User user = new User("Ana", EMAIL, BCRYPT_HASH, Role.USER);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(PASSWORD, BCRYPT_HASH)).thenReturn(true);
        when(jwtTokenProvider.generateToken(user)).thenReturn("token-jwt-demo");
        LoginRequest request = new LoginRequest(EMAIL, PASSWORD);

        LoginResponse response = service.login(request);

        assertThat(response.token()).isEqualTo("token-jwt-demo");
        assertThat(response.user().email()).isEqualTo(EMAIL);
        assertThat(response.user().name()).isEqualTo("Ana");
        assertThat(response.user().role()).isEqualTo(Role.USER);
    }
}
