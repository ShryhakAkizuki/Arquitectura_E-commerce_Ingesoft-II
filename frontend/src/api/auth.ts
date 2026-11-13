import { client } from './client';

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UpdateProfileRequest,
  UserResponse,
} from '../types/auth';

/**
 * Crea una cuenta (público).
 * 201 → `UserResponse`; email repetido → 409 `EMAIL_ALREADY_REGISTERED`.
 */
export async function register(request: RegisterRequest): Promise<UserResponse> {
  const { data } = await client.post<UserResponse>('/auth/register', request);
  return data;
}

/**
 * Inicia sesión y devuelve el JWT + perfil (público).
 * Credenciales inválidas → 401 `INVALID_CREDENTIALS`.
 */
export async function login(request: LoginRequest): Promise<LoginResponse> {
  const { data } = await client.post<LoginResponse>('/auth/login', request);
  return data;
}

/**
 * Perfil del usuario autenticado.
 * 401 si el token es inválido o expirado (el interceptor limpia la sesión).
 */
export async function getMe(): Promise<UserResponse> {
  const { data } = await client.get<UserResponse>('/users/me');
  return data;
}

/**
 * Actualiza nombre, email y contraseña opcional (PUT /api/users/me).
 * Email duplicado → 409 `EMAIL_ALREADY_REGISTERED`.
 */
export async function updateProfile(request: UpdateProfileRequest): Promise<UserResponse> {
  const { data } = await client.put<UserResponse>('/users/me', request);
  return data;
}
