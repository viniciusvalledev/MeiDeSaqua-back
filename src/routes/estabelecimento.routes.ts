import { Router } from "express";
import multer from "multer";
import path from "path";
import EstabelecimentoController from "../controllers/EstabelecimentoController";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const router = Router();

router.get("/", EstabelecimentoController.listarTodos);
router.get("/buscar", EstabelecimentoController.buscarPorNome);
router.get("/:id", EstabelecimentoController.buscarPorId);
router.post(
  "/",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "produtos", maxCount: 5 },
  ]),
  EstabelecimentoController.cadastrar
);

router.put(
  "/solicitar-atualizacao",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "produtos", maxCount: 5 },
  ]),
  EstabelecimentoController.solicitarAtualizacao 
);

router.post("/solicitar-exclusao", EstabelecimentoController.solicitarExclusao);
router.post("/:id/status", EstabelecimentoController.alterarStatus);

export default router;