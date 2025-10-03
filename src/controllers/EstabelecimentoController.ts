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
      filesToDelete.push(...fileArray);
    });

    await Promise.all(
      filesToDelete.map((file) => {
        return fs.unlink(file.path).catch((err) => {
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

    const logoPath = arquivos["logo"]?.[0]?.path.replace(/\\/g, "/");
    const produtosPaths =
      arquivos["produtos"]?.map((file) => file.path.replace(/\\/g, "/")) || [];
    const ccmeiPath = arquivos["ccmei"]?.[0]?.path.replace(/\\/g, "/"); // CCMEI COLETADO

    return {
      ...dadosDoFormulario,
      ...(logoPath && { logo: logoPath }),
      ...(produtosPaths.length > 0 && { produtos: produtosPaths }),
      ...(ccmeiPath && { ccmei: ccmeiPath }), // CCMEI INCLUÍDO NO PAYLOAD
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
      // 1. Prepara todos os dados (incluindo caminhos dos arquivos ccmei e logo, se enviados)
      const dadosCompletos = this._prepareDadosCompletos(req);

      const {
        cnpj,
        nomeResponsavel,
        cpf,
        emailEstabelecimento,
        ccmei, // Será o caminho do arquivo se tiver sido enviado
      } = dadosCompletos;

      // 2. VALIDAÇÃO CRÍTICA: Verifica todos os campos de identificação obrigatórios
      // Se o CCMEI for obrigatório no frontend, o caminho deve existir aqui
      if (
        !cnpj ||
        !nomeResponsavel ||
        !cpf ||
        !emailEstabelecimento ||
        !ccmei
      ) {
        // ROLLBACK: Deleta arquivos salvos
        await this._deleteUploadedFilesOnFailure(req);
        return res.status(400).json({
          message:
            "Todos os campos de identificação (Nome, CPF, CNPJ, Email e Certificado CCMEI) são obrigatórios para solicitar uma atualização.",
        });
      }

      // 3. Processa a atualização
      // O EstabelecimentoService só receberá os dados que o usuário preencheu/enviou.
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
      // 4. ROLLBACK em caso de falha no serviço
      await this._deleteUploadedFilesOnFailure(req);
      return this._handleError(error, res);
    }
  };

  public solicitarExclusao = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { cnpj, nomeResponsavel, cpf, emailEstabelecimento, motivo } =
        req.body;

      if (!cnpj || !nomeResponsavel || !cpf || !emailEstabelecimento) {
        return res.status(400).json({
          message:
            "Todos os campos de identificação (Nome, CPF, CNPJ, Email) são obrigatórios para solicitar uma exclusão.",
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
