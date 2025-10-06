import { Request, Response } from "express";
import EstabelecimentoService from "../services/EstabelecimentoService";
import { StatusEstabelecimento } from "../entities/Estabelecimento.entity";
import fs from "fs/promises"; // Importado para manipulação de arquivos (rollback)
import path from "path";

class EstabelecimentoController {
  /**
   * Helper function para deletar arquivos enviados pelo Multer em caso de falha.
   */
  private _deleteUploadedFilesOnFailure = async (req: Request) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files) return;

    const filesToDelete: Express.Multer.File[] = [];
    Object.values(files).forEach((fileArray) => {
      // Multer retorna um array de arquivos para cada campo de upload
      filesToDelete.push(...fileArray);
    });

    // Deleta todos os arquivos que foram salvos pelo Multer
    await Promise.all(
      filesToDelete.map((file) => {
        // file.path contém o caminho completo do arquivo salvo pelo Multer
        return fs.unlink(file.path).catch((err) => {
          // Loga o erro, mas não interrompe a operação para os outros arquivos
          console.error(
            `Falha ao deletar arquivo ${file.path} durante rollback: ${err.message}`
          );
        });
      })
    );
  };

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

    const getRelativePath = (
      fullPath: string | undefined
    ): string | undefined => {
      if (!fullPath) return undefined;
      // Converte barras invertidas para barras normais
      const normalizedPath = fullPath.replace(/\\/g, "/");
      // Encontra a parte do caminho que começa com "uploads"
      const uploadsIndex = normalizedPath.indexOf("uploads");
      if (uploadsIndex === -1) {
        // Se "uploads" não for encontrado, retorna o caminho como está (fallback)
        return normalizedPath;
      }
      // Retorna a substring a partir de "uploads"
      return normalizedPath.substring(uploadsIndex);
    };
    const logoPath = getRelativePath(arquivos["logo"]?.[0]?.path);

    const produtosPaths =
      arquivos["produtos"]?.map((file) => getRelativePath(file.path)!) || [];

    const ccmeiPath = getRelativePath(arquivos["ccmei"]?.[0]?.path);

    return {
      ...dadosDoFormulario,
      ...(logoPath && { logo: logoPath }),
      ...(produtosPaths.length > 0 && { produtos: produtosPaths }),
      ...(ccmeiPath && { ccmei: ccmeiPath }), // CCMEI ADICIONADO
    };
  };

  public cadastrar = async (req: Request, res: Response): Promise<Response> => {
    try {
      const dadosCompletos = this._prepareDadosCompletos(req);
      const novoEstabelecimento =
        await EstabelecimentoService.cadastrarEstabelecimentoComImagens(
          dadosCompletos
        );
      return res.status(201).json(novoEstabelecimento);
    } catch (error: any) {
      // ROLLBACK: Deleta os arquivos salvos se a inserção no banco falhar.
      await this._deleteUploadedFilesOnFailure(req);
      return this._handleError(error, res);
    }
  };

  public solicitarAtualizacao = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { cnpj } = req.body;
      if (!cnpj) {
        return res.status(400).json({
          message: "O CNPJ é obrigatório para solicitar uma atualização.",
        });
      }

      // Prepara os dados do formulário e dos arquivos de upload (logo, produtos)
      const dadosCompletos = this._prepareDadosCompletos(req);

      // O arquivo ccmei NUNCA deve ser atualizado aqui, então garantimos sua exclusão
      if (dadosCompletos.ccmei) {
        delete dadosCompletos.ccmei;
      }

      const estabelecimento =
        await EstabelecimentoService.solicitarAtualizacaoPorCnpj(
          cnpj,
          dadosCompletos
        );

      return res.status(200).json({
        message: "Solicitação de atualização enviada para análise.",
        estabelecimento,
      });
    } catch (error: any) {
      // ROLLBACK: Deleta os arquivos salvos se a atualização falhar.
      await this._deleteUploadedFilesOnFailure(req);
      return this._handleError(error, res);
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
