import { Request, Response } from "express";
import EstabelecimentoService from "../services/EstabelecimentoService";
import { StatusEstabelecimento } from "../entities/Estabelecimento.entity";
import { ICreateUpdateEstabelecimentoRequest } from "../interfaces/requests";

class EstabelecimentoController {
  public async cadastrar(req: Request, res: Response): Promise<Response> {
    try {
      const dadosDoFormulario = req.body;
      const arquivos = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };
      const logoPath = arquivos["logo"]?.[0]?.path.replace(/\\/g, "/");
      const produtosPaths =
        arquivos["produtos"]?.map((file) => file.path.replace(/\\/g, "/")) ||
        [];
      const dadosCompletos = {
        ...dadosDoFormulario,
        logo: logoPath,
        produtos: produtosPaths,
      };
      const novoEstabelecimento =
        await EstabelecimentoService.cadastrarEstabelecimentoComImagens(
          dadosCompletos
        );
      return res.status(201).json(novoEstabelecimento);
    } catch (error: any) {
      if (req.files) {
        const arquivos = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };
      }
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

      // CORREÇÃO APLICADA AQUI
      if (
        !estabelecimento ||
        estabelecimento.status !== StatusEstabelecimento.ATIVO
      ) {
        return res
          .status(404)
          .json({
            message: "Estabelecimento não encontrado ou não está ativo.",
          });
      }

      return res.status(200).json(estabelecimento);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  public async atualizar(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      // Usamos a interface para garantir que áreasAtuacao (e outros campos) sejam aceitos.
      const dadosAtualizacao: ICreateUpdateEstabelecimentoRequest = req.body;

      const estabelecimentoAtualizado =
        await EstabelecimentoService.atualizarEstabelecimento(
          id,
          dadosAtualizacao
        );

      return res.status(200).json(estabelecimentoAtualizado);
    } catch (error: any) {
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  // Esta função é mais para o admin, então pode ser mantida como está.
  public async alterarStatus(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      const { ativo } = req.body;
      if (typeof ativo !== "boolean") {
        return res.status(400).json({
          message:
            "O corpo da requisição deve conter a chave 'ativo' com um valor booleano (true/false).",
        });
      }
      const estabelecimento = await EstabelecimentoService.alterarStatusAtivo(
        id,
        ativo
      );
      return res.status(200).json(estabelecimento);
    } catch (error: any) {
      return res.status(404).json({ message: error.message });
    }
  }
}

export default new EstabelecimentoController();
