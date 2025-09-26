import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "seu-segredo-admin-super-secreto";

export const adminAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Acesso negado. Token não fornecido." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role === "admin") {
      next();
    } else {
      return res.status(403).json({ message: "Acesso negado. Permissão insuficiente." });
    }
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
};