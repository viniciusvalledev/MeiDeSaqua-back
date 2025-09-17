// src/controllers/UserController.ts
import { Request, Response } from 'express';
import AuthService from '../services/AuthService';

// Uma boa prática é estender o tipo Request do Express para incluir 
// a propriedade 'user' que virá do nosso futuro middleware de autenticação.
interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
    }
}

class UserController {
    public async updateUserProfile(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const username = req.user?.username;
            if (!username) return res.status(401).json({ message: "Não autorizado" });

            const updatedUser = await AuthService.updateUserProfile(username, req.body);
            const { password, ...userDTO } = updatedUser.get({ plain: true });

            return res.json(userDTO);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async deleteUserProfile(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const username = req.user?.username;
            if (!username) return res.status(401).json({ message: "Não autorizado" });

            await AuthService.deleteUser(username);
            return res.json({ message: "Perfil de utilizador excluído com sucesso." });
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async updateUserPassword(req: AuthenticatedRequest, res: Response): Promise<Response> {
        try {
            const username = req.user?.username;
            if (!username) return res.status(401).json({ message: "Não autorizado" });

            await AuthService.updateUserPassword(username, req.body);
            return res.json({ message: "Senha alterada com sucesso." });
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }
}

export default new UserController();