// src/controllers/ProprietarioController.ts
import { Request, Response } from 'express';
import ProprietarioService from '../services/ProprietarioService';

class ProprietarioController {
    public async cadastrar(req: Request, res: Response): Promise<Response> {
        try {
            const proprietario = await ProprietarioService.cadastrarProprietario(req.body);
            return res.status(201).json(proprietario);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }
}

export default new ProprietarioController();