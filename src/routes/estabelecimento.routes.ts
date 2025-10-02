import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import EstabelecimentoController from "../controllers/EstabelecimentoController";
import { compressImages } from "../middlewares/compression.middleware";

const sanitizeFilename = (name: string) => {
  if (!name) return "";
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { categoria, nomeFantasia } = req.body;
    const safeCategoria = sanitizeFilename(categoria || "geral");
    const safeNomeFantasia = sanitizeFilename(nomeFantasia || "mei_sem_nome");

    const uploadPath = path.resolve("uploads", safeCategoria, safeNomeFantasia);

    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
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
    { name: "ccmei", maxCount: 1 },
  ]),
  compressImages,
  EstabelecimentoController.cadastrar
);

router.put(
  "/solicitar-atualizacao",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "produtos", maxCount: 5 },
  ]),
  compressImages,
  EstabelecimentoController.solicitarAtualizacao
);

router.post("/solicitar-exclusao", EstabelecimentoController.solicitarExclusao);
router.post("/:id/status", EstabelecimentoController.alterarStatus);

export default router;
