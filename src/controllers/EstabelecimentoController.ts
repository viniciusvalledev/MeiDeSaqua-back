import { Request, Response } from "express";
import EstabelecimentoService from "../services/EstabelecimentoService";
import { StatusEstabelecimento } from "../entities/Estabelecimento.entity";
import path from "path";

class EstabelecimentoController {
  private _handleError = (error: any, res: Response): Response => {
    if (error.message === "E-mail já cadastrado no sistema.") {
      return res.status(400).json({ message: error.message });
    }

    if (error.message === "CNPJ já cadastrado no sistema.") {
      return res.status(400).json({ message: error.message });
    }

    if (
      error.name === "SequelizeDatabaseError" &&
      error.message.includes("Data too long for column")
    ) {
      let friendlyMessage =
        "Um dos campos de texto excedeu o limite de caracteres.";
      if (error.message.includes("'descricao_diferencial'")) {
        friendlyMessage =
          "O campo 'Diferencial' excedeu o limite de 130 caracteres.";
      } else if (error.message.includes("'descricao'")) {
        friendlyMessage =
          "O campo 'Descrição' excedeu o limite de 500 caracteres.";
      }
      return res.status(400).json({ message: friendlyMessage });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ message: "O CNPJ informado já está cadastrado no sistema." });
    }

    if (error.message.includes("não encontrado")) {
      return res.status(404).json({ message: error.message });
    }

    return res
      .status(500)
      .json({ message: "Ocorreu um erro interno no servidor." });
  };

  private _prepareDadosCompletos = (req: Request): any => {
    const dadosDoFormulario = req.body;
    const arquivos = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const logoPath = arquivos["logo"]?.[0]?.path.replace(/\\/g, "/");
    const produtosPaths =
      arquivos["produtos"]?.map((file) => file.path.replace(/\\/g, "/")) || [];
    const ccmeiPath = arquivos["ccmei"]?.[0]?.path.replace(/\\/g, "/");

    return {
      ...dadosDoFormulario,
      ...(logoPath && { logo: logoPath }),
      ...(produtosPaths.length > 0 && { produtos: produtosPaths }),
      ...(ccmeiPath && { ccmei: ccmeiPath }),
    };
  };

  public async cadastrar(req: Request, res: Response): Promise<Response> {
    try {
      const dadosCompletos = this._prepareDadosCompletos(req);
      const novoEstabelecimento =
        await EstabelecimentoService.cadastrarEstabelecimentoComImagens(
          dadosCompletos
        );
      return res.status(201).json(novoEstabelecimento);
    } catch (error: any) {
      if (req.files) {
      }
      return res.status(400).json({ message: error.message });
    }
  }

  public solicitarAtualizacao = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { cnpj, ...dadosDoFormulario } = req.body;
      if (!cnpj) {
        return res.status(400).json({
          message: "O CNPJ é obrigatório para solicitar uma atualização.",
        });
      }

      const arquivos = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };
      let dadosCompletos: any = { ...dadosDoFormulario };

      const getRelativePath = (
        absolutePath: string | undefined
      ): string | undefined => {
        if (!absolutePath) return undefined;
        const relativePath = path.relative(process.cwd(), absolutePath);
        return relativePath.replace(/\\/g, "/");
      };

      if (arquivos && arquivos["logo"]) {
        dadosCompletos.logoUrl = getRelativePath(arquivos["logo"][0].path);
      }

      if (arquivos && arquivos["produtos"]) {
        dadosCompletos.produtos =
          (arquivos["produtos"]
            ?.map((file) => getRelativePath(file.path))
            .filter((p) => p) as string[]) || [];
      }

      const dadosLimpos = Object.fromEntries(
        Object.entries(dadosCompletos).filter(
          ([, value]) => value !== undefined && value !== null
        )
      );

      if (Object.keys(dadosLimpos).length === 0) {
        return res
          .status(400)
          .json({ message: "Nenhum dado válido fornecido para atualização." });
      }

      await EstabelecimentoService.solicitarAtualizacaoPorCnpj(
        cnpj,
        dadosLimpos
      );

      return res
        .status(200)
        .json({ message: "Solicitação de atualização enviada para análise." });
    } catch (error: any) {
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  };

  public solicitarExclusao = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { cnpj } = req.body;
      if (!cnpj) {
        return res.status(400).json({
          message: "O CNPJ é obrigatório para solicitar uma exclusão.",
        });
      }
      await EstabelecimentoService.solicitarExclusaoPorCnpj(cnpj);
      return res
        .status(200)
        .json({ message: "Solicitação de exclusão enviada para análise." });
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public listarTodos = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const estabelecimentos = await EstabelecimentoService.listarTodos();
      return res.status(200).json(estabelecimentos);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public buscarPorNome = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const nome = req.query.nome as string;
      const estabelecimentos = await EstabelecimentoService.buscarPorNome(nome);
      return res.status(200).json(estabelecimentos);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public buscarPorId = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const id = parseInt(req.params.id);
      const estabelecimento = await EstabelecimentoService.buscarPorId(id);

      if (!estabelecimento) {
        return res.status(404).json({
          message: "Estabelecimento não encontrado ou não está ativo.",
        });
      }

      return res.status(200).json(estabelecimento);
    } catch (error: any) {
      return this._handleError(error, res);
    }
  };

  public alterarStatus = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
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
      return this._handleError(error, res);
    }
  };
}

export default new EstabelecimentoController();
