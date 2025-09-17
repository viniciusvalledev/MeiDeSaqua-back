// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Estendemos o tipo Request para adicionar a propriedade 'user'
interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
    }
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number; username: string };
        
        // Anexa os dados do utilizador à requisição para que os controllers possam usá-los
        req.user = decoded;
        
        next(); // Passa para a próxima etapa (o controller da rota)
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
}