/** Roles de acceso de la plataforma (enums/Role.java). */
export type Role = 'USER' | 'ADMIN';

/** Perfil del usuario autenticado (dto/response/UserResponse.java). */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** Crear cuenta (POST /api/auth/register). */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

/** Iniciar sesión (POST /api/auth/login). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta del login: JWT + perfil (dto/response/LoginResponse.java). */
export interface LoginResponse {
  token: string;
  user: UserResponse;
}

/** Actualizar perfil (PUT /api/users/me). */
export interface UpdateProfileRequest {
  name: string;
  email: string;
  password?: string | null;
}
