import { Router } from "express";
import multer from "multer"; // <- 1. Importe o Multer
import EstabelecimentoController from "../controllers/EstabelecimentoController";

const upload = multer({ dest: "images/" });

const router = Router();

router.get("/", EstabelecimentoController.listarTodos);
router.get("/buscar", EstabelecimentoController.buscarPorNome);
router.get("/:id", EstabelecimentoController.buscarPorId);
router.post("/:id/status", EstabelecimentoController.alterarStatus);

router.post(
  "/",

  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "produtos", maxCount: 5 },
  ]),
  EstabelecimentoController.cadastrar
);

export default router;
