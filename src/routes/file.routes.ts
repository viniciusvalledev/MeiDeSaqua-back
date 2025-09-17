// src/routes/file.routes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import FileController from '../controllers/FileController';

const router = Router();

// Configuração do Multer para guardar os ficheiros na pasta 'uploads'
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.resolve(__dirname, '..', '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        cb(null, `${uuidv4()}${extension}`);
    }
});
const upload = multer({ storage });

// Endpoint para um único ficheiro (para a logo)
router.post('/upload', upload.single('file'), FileController.uploadFile);
// Endpoint para múltiplos ficheiros (para o carrossel)
router.post('/upload-multiple', upload.array('files'), FileController.uploadMultipleFiles);

export default router;