export interface IUpdateProfileRequest {
    nomeCompleto?: string; 
    username?: string;
    email?: string;
}


export interface IUpdatePasswordRequest {
    currentPassword: string;
    newPassword: string;
}