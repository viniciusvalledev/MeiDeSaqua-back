// src/interfaces/requests.ts

/**
 * Define o formato esperado para a atualização de perfil do utilizador.
 * Equivalente a UpdateProfileRequest.java
 */
export interface IUpdateProfileRequest {
    nomeCompleto?: string; // O '?' torna o campo opcional
    username?: string;
    email?: string;
}

/**
 * Define o formato esperado para a atualização de senha do utilizador.
 * Equivalente a UpdatePasswordRequest.java
 */
export interface IUpdatePasswordRequest {
    currentPassword: string;
    newPassword: string;
}