// src/routes/avaliacao.routes.ts
import { Router } from "express";
import AvaliacaoController from "../controllers/AvaliacaoController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Rota pública para listar avaliações de um estabelecimento
router.get(
  "/estabelecimento/:id",
  AvaliacaoController.listarPorEstabelecimento
);

// Rotas que precisam de autenticação
router.post("/", authMiddleware, AvaliacaoController.submeterAvaliacao);
router.put("/:id", authMiddleware, AvaliacaoController.atualizarAvaliacao);
router.delete("/:id", authMiddleware, AvaliacaoController.excluirAvaliacao);

export default router;
