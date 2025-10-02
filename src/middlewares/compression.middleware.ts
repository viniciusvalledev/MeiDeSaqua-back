import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export const compressImages = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.files) {
        return next();
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    try {
        const compressionPromises: Promise<void>[] = [];

        for (const field in files) {
            for (const file of files[field]) {
                const originalPath = file.path;
                const newFilename = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
                const outputPath = path.join(path.dirname(originalPath), newFilename);

                // Log para depuração
                console.log(`Comprimindo: ${originalPath} -> ${outputPath}`);

                const promise = sharp(originalPath)
                    .webp({ quality: 80 })
                    .toFile(outputPath)
                    .then(async () => {
                        // Deleta o arquivo original após a compressão
                        await fs.unlink(originalPath);
                        
                        // Atualiza as informações do arquivo na requisição para o novo caminho
                        file.path = outputPath;
                        file.filename = newFilename;
                    });
                
                compressionPromises.push(promise);
            }
        }

        await Promise.all(compressionPromises);
        next();
    } catch (error) {
        console.error("Erro ao comprimir imagens:", error);
        next(error);
    }
};