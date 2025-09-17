// src/controllers/AuthController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AuthService from '../services/AuthService';
import { Usuario } from '../entities';

class AuthController {
    public async cadastrar(req: Request, res: Response): Promise<Response> {
        try {
            await AuthService.cadastrarUsuario(req.body);
            return res.status(201).json({ 
                message: "Cadastro realizado com sucesso! Por favor, verifique seu e-mail para ativar sua conta." 
            });
        } catch (error: any) {
            if (error.message.includes("já cadastrado")) {
                return res.status(409).json({ message: error.message });
            }
            return res.status(400).json({ message: error.message });
        }
    }

    public async login(req: Request, res: Response): Promise<Response> {
        try {
            const { username, password } = req.body;
            const user = await Usuario.findOne({ where: { username } });

            if (!user) {
                return res.status(401).json({ message: "Utilizador ou senha inválidos." });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Utilizador ou senha inválidos." });
            }

            if (!user.enabled) {
                return res.status(403).json({ message: "Conta não ativada. Por favor, verifique seu e-mail de confirmação." });
            }

            const token = jwt.sign(
                { id: user.usuarioId, username: user.username },
                process.env.JWT_SECRET as string,
                { expiresIn: '24h' }
            );
            
            // Remove a senha do objeto antes de enviar a resposta
            const { password: _, ...userDTO } = user.get({ plain: true });

            return res.json({ token, user: userDTO });

        } catch (error: any) {
            console.error(error);
            return res.status(500).json({ message: "Ocorreu um erro inesperado." });
        }
    }

    public async confirmAccount(req: Request, res: Response): Promise<Response> {
        try {
            await AuthService.confirmUserAccount(req.query.token as string);
            return res.json({ message: "Conta ativada com sucesso. Você já pode fazer login." });
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async forgotPassword(req: Request, res: Response): Promise<Response> {
        try {
            await AuthService.forgotPassword(req.body.email);
            return res.json({ message: "Se existir uma conta com o e-mail fornecido, um link de redefinição de senha foi enviado." });
        } catch (error: any) {
            return res.json({ message: "Se existir uma conta com o e-mail fornecido, um link de redefinição de senha foi enviado." });
        }
    }
    
    public async resetPassword(req: Request, res: Response): Promise<Response> {
        try {
            const { token, newPassword } = req.body;
            await AuthService.resetPassword(token, newPassword);
            return res.json({ message: "Senha redefinida com sucesso." });
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async confirmEmailChange(req: Request, res: Response): Promise<Response> {
        try {
            await AuthService.confirmEmailChange(req.query.token as string);
            return res.json({ message: "Alteração de e-mail confirmada com sucesso." });
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }
}

export default new AuthController();