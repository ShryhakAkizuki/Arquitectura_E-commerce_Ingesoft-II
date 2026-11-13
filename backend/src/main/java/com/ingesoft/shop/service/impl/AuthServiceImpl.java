package com.ingesoft.shop.service.impl;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ingesoft.shop.dto.request.LoginRequest;
import com.ingesoft.shop.dto.request.RegisterRequest;
import com.ingesoft.shop.dto.request.UpdateProfileRequest;
import com.ingesoft.shop.dto.response.LoginResponse;
import com.ingesoft.shop.dto.response.UserResponse;
import com.ingesoft.shop.entity.User;
import com.ingesoft.shop.enums.Role;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.UserRepository;
import com.ingesoft.shop.security.JwtTokenProvider;
import com.ingesoft.shop.service.IAuthService;

/**
 * Implementación de {@link IAuthService}
 */
@Service
public class AuthServiceImpl implements IAuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthServiceImpl(UserRepository userRepository,
                            PasswordEncoder passwordEncoder,
                            JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_REGISTERED,
                    "El email " + request.email() + " ya está registrado");
        }
        String passwordHash = passwordEncoder.encode(request.password());
        User user = new User(request.name(), request.email(), passwordHash, Role.USER);
        return UserResponse.from(userRepository.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .filter(candidate -> passwordEncoder.matches(request.password(),
                        candidate.getPasswordHash()))
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS,
                        "Email o contraseña incorrectos"));
        String token = jwtTokenProvider.generateToken(user);
        return new LoginResponse(token, UserResponse.from(user));
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse me(String email) {
        return UserResponse.from(findUserByEmail(email));
    }

    @Override
    @Transactional
    public UserResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = findUserByEmail(email);
        if (!user.getEmail().equalsIgnoreCase(request.email())
                && userRepository.existsByEmail(request.email())) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_REGISTERED,
                    "El email " + request.email() + " ya está registrado");
        }
        user.setName(request.name());
        user.setEmail(request.email());
        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        return UserResponse.from(user);
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "No existe un usuario con el email " + email));
    }
}
