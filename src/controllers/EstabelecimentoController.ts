// src/controllers/EstabelecimentoController.ts
import { Request, Response } from 'express';
import EstabelecimentoService from '../services/EstabelecimentoService';

class EstabelecimentoController {
    public async cadastrar(req: Request, res: Response): Promise<Response> {
        try {
            const novoEstabelecimento = await EstabelecimentoService.cadastrarEstabelecimentoComImagens(req.body);
            return res.status(201).json(novoEstabelecimento);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async listarTodos(req: Request, res: Response): Promise<Response> {
        try {
            const estabelecimentos = await EstabelecimentoService.listarTodos();
            return res.status(200).json(estabelecimentos);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    public async buscarPorNome(req: Request, res: Response): Promise<Response> {
        try {
            const nome = req.query.nome as string;
            const estabelecimentos = await EstabelecimentoService.buscarPorNome(nome);
            return res.status(200).json(estabelecimentos);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    public async buscarPorId(req: Request, res: Response): Promise<Response> {
        try {
            const id = parseInt(req.params.id);
            const estabelecimento = await EstabelecimentoService.buscarPorId(id);
            if (!estabelecimento) {
                return res.status(404).json({ message: "Estabelecimento não encontrado." });
            }
            return res.status(200).json(estabelecimento);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

    public async alterarStatus(req: Request, res: Response): Promise<Response> {
        try {
            const id = parseInt(req.params.id);
            const { ativo } = req.body;
            if (typeof ativo !== 'boolean') {
                return res.status(400).json({ message: "O corpo da requisição deve conter a chave 'ativo' com um valor booleano (true/false)." });
            }
            const estabelecimento = await EstabelecimentoService.alterarStatusAtivo(id, ativo);
            return res.status(200).json(estabelecimento);
        } catch (error: any) {
            return res.status(404).json({ message: error.message });
        }
    }
}

export default new EstabelecimentoController();