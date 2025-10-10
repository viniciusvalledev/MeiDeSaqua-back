import { Request, Response } from "express";
import EstabelecimentoService from "../services/EstabelecimentoService";
import fs from "fs/promises";
import path from "path";
import Estabelecimento from "../entities/Estabelecimento.entity"; // Importar a entidade

class EstabelecimentoController {
  private _deleteUploadedFilesOnFailure = async (req: Request) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files) return;
    const filesToDelete = Object.values(files).flat();
    await Promise.all(
      filesToDelete.map((file) =>
        fs
          .unlink(file.path)
          .catch((err) =>
            console.error(
              `Falha ao deletar arquivo ${file.path} durante rollback: ${err.message}`
            )
          )
      )
    );
  };

  private _handleError = (error: any, res: Response): Response => {
    // Seu código de _handleError continua o mesmo aqui...
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

  private _moveFilesAndPrepareData = async (
    req: Request,
    existingInfo?: { categoria: string; nomeFantasia: string }
  ): Promise<any> => {
    const dadosDoFormulario = req.body;
    const arquivos = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const categoria = existingInfo?.categoria || dadosDoFormulario.categoria;
    const nomeFantasia =
      existingInfo?.nomeFantasia || dadosDoFormulario.nomeFantasia;

    const sanitize = (name: string) =>
      (name || "").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const safeCategoria = sanitize(categoria || "geral");
    const safeNomeFantasia = sanitize(nomeFantasia || "mei_sem_nome");

    const targetDir = path.resolve("uploads", safeCategoria, safeNomeFantasia);
    await fs.mkdir(targetDir, { recursive: true });

    const moveFile = async (
      file?: Express.Multer.File
    ): Promise<string | undefined> => {
      if (!file) return undefined;
      const oldPath = file.path;
      const newPath = path.join(targetDir, file.filename);
      await fs.rename(oldPath, newPath);
      return path
        .join("uploads", safeCategoria, safeNomeFantasia, file.filename)
        .replace(/\\/g, "/");
    };

    const logoPath = await moveFile(arquivos["logo"]?.[0]);
    const ccmeiPath = await moveFile(arquivos["ccmei"]?.[0]);

    const produtosPaths: string[] = [];
    if (arquivos["produtos"]) {
      for (const file of arquivos["produtos"]) {
        const newPath = await moveFile(file);
        if (newPath) produtosPaths.push(newPath);
      }
    }

    return {
      ...dadosDoFormulario,
      ...(logoPath && { logo: logoPath }),
      ...(produtosPaths.length > 0 && { produtos: produtosPaths }),
      ...(ccmeiPath && { ccmei: ccmeiPath }),
    };
  };

  public cadastrar = async (req: Request, res: Response): Promise<Response> => {
    try {
      const dadosCompletos = await this._moveFilesAndPrepareData(req);
      const novoEstabelecimento =
        await EstabelecimentoService.cadastrarEstabelecimentoComImagens(
          dadosCompletos
        );
      return res.status(201).json(novoEstabelecimento);
    } catch (error: any) {
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

      const estabelecimentoExistente = await Estabelecimento.findOne({
        where: { cnpj },
      });
      if (!estabelecimentoExistente) {
        await this._deleteUploadedFilesOnFailure(req);
        return res.status(404).json({
          message:
            "Estabelecimento não encontrado para atualização, verifique o CNPJ e tente novamente.",
        });
      }

      const dadosCompletos = await this._moveFilesAndPrepareData(req, {
        categoria: estabelecimentoExistente.categoria,
        nomeFantasia: estabelecimentoExistente.nomeFantasia,
      });

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
      await this._deleteUploadedFilesOnFailure(req);
      return this._handleError(error, res);
    }
  };

  // Seus outros métodos (solicitarExclusao, listarTodos, etc.) continuam os mesmos aqui...
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

      // Converte a instância do Sequelize para um objeto JSON
      const estabelecimentoJSON = estabelecimento.toJSON();

      // Calcula a média das avaliações
      let media = 0;
      if (
        estabelecimentoJSON.avaliacoes &&
        estabelecimentoJSON.avaliacoes.length > 0
      ) {
        const somaDasNotas = estabelecimentoJSON.avaliacoes.reduce(
          (acc: number, avaliacao: { nota: number }) => acc + avaliacao.nota,
          0
        );
        const mediaCalculada =
          somaDasNotas / estabelecimentoJSON.avaliacoes.length;
        media = parseFloat(mediaCalculada.toFixed(1)); // Garante uma casa decimal
      }

      // Adiciona o campo "media" ao objeto que será enviado ao frontend
      const dadosParaFront = {
        ...estabelecimentoJSON,
        media: media,
      };

      return res.status(200).json(dadosParaFront);
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
