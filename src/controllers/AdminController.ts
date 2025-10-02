import { Request, Response } from "express";
import Estabelecimento, {
  StatusEstabelecimento,
} from "../entities/Estabelecimento.entity";
import * as jwt from "jsonwebtoken";
import ImagemProduto from "../entities/ImagemProduto.entity";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Senha@Forte123";
const JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "seu-segredo-admin-super-secreto";

export class AdminController {
  static async login(req: Request, res: Response) {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, {
        expiresIn: "8h",
      });
      return res.json({ success: true, token });
    }

    return res
      .status(401)
      .json({ success: false, message: "Credenciais inválidas" });
  }

  static async getPending(req: Request, res: Response) {
    try {
      const includeOptions = {
        model: ImagemProduto,
        as: "produtosImg",
        attributes: ["url"],
      };

      const cadastros = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_APROVACAO },
        include: [includeOptions],
      });
      const atualizacoes = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_ATUALIZACAO },
        include: [includeOptions],
      });
      const exclusoes = await Estabelecimento.findAll({
        where: { status: StatusEstabelecimento.PENDENTE_EXCLUSAO },
        include: [includeOptions],
      });

      return res.json({ cadastros, atualizacoes, exclusoes });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar solicitações pendentes." });
    }
  }

  static async approveRequest(req: Request, res: Response) {
    const { id } = req.params;
    console.log(`\n--- [DEBUG] INÍCIO | Aprovando ID: ${id} ---`);

    try {
      const estabelecimento = await Estabelecimento.findByPk(id);
      if (!estabelecimento) {
        console.error(
          `[DEBUG] ERRO: Estabelecimento com ID ${id} não foi encontrado no banco.`
        );
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }

      console.log(
        `[DEBUG] Estabelecimento encontrado. Status atual: "${estabelecimento.status}"`
      );

      switch (estabelecimento.status) {
        case StatusEstabelecimento.PENDENTE_APROVACAO:
          console.log("[DEBUG] Aprovando um novo cadastro.");
          estabelecimento.status = StatusEstabelecimento.ATIVO;
          estabelecimento.ativo = true;
          await estabelecimento.save();
          break;

        case StatusEstabelecimento.PENDENTE_ATUALIZACAO:
          console.log("[DEBUG] Aprovando uma atualização de dados.");
          if (estabelecimento.dados_atualizacao) {
            const dadosRecebidos = estabelecimento.dados_atualizacao as any;
            console.log(
              "[DEBUG] Dados de atualização recebidos do banco:",
              JSON.stringify(dadosRecebidos, null, 2)
            );

            const dadosParaAtualizar: { [key: string]: any } = {};

            Object.keys(dadosRecebidos).forEach((key) => {
              if (key !== "area_atuacao" && key !== "tags_invisiveis") {
                dadosParaAtualizar[key] = dadosRecebidos[key];
              }
            });

            if (dadosRecebidos.locais !== undefined) {
              const valor = Array.isArray(dadosRecebidos.locais)
                ? dadosRecebidos.locais.join(", ")
                : dadosRecebidos.locais;
              dadosParaAtualizar.areasAtuacao = valor;
              console.log(
                `[DEBUG] Mapeando 'area_atuacao' para 'areasAtuacao' com o valor: "${valor}"`
              );
            }

            if (dadosRecebidos.tags_invisiveis !== undefined) {
              const valor = Array.isArray(dadosRecebidos.tags_invisiveis)
                ? dadosRecebidos.tags_invisiveis.join(", ")
                : dadosRecebidos.tags_invisiveis;
              dadosParaAtualizar.tagsInvisiveis = valor;
              console.log(
                `[DEBUG] Mapeando 'tags_invisiveis' para 'tagsInvisiveis' com o valor: "${valor}"`
              );
            }

            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusEstabelecimento.ATIVO;

            console.log(
              "[DEBUG] Objeto FINAL que será passado para o método .update():",
              JSON.stringify(dadosParaAtualizar, null, 2)
            );

            await estabelecimento.update(dadosParaAtualizar);

            console.log(
              "[DEBUG] Update executado com sucesso no banco de dados."
            );
          } else {
            console.log(
              "[DEBUG] Nenhum dado de atualização encontrado. Apenas reativando o status do estabelecimento."
            );
            estabelecimento.dados_atualizacao = null;
            estabelecimento.status = StatusEstabelecimento.ATIVO;
            await estabelecimento.save();
          }
          break;

        case StatusEstabelecimento.PENDENTE_EXCLUSAO:
          console.log("[DEBUG] Executando exclusão do estabelecimento.");
          await estabelecimento.destroy();
          return res
            .status(200)
            .json({ message: "Estabelecimento excluído com sucesso." });
      }

      console.log(
        `--- [DEBUG] FIM | Solicitação para o ID ${id} processada com sucesso. ---`
      );
      return res
        .status(200)
        .json({ message: "Solicitação aprovada com sucesso." });
    } catch (error) {
      console.error(
        "--- [DEBUG] ERRO CATASTRÓFICO DURANTE A APROVAÇÃO ---",
        error
      );
      return res
        .status(500)
        .json({ message: "Erro ao aprovar a solicitação." });
    }
  }
  static async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const estabelecimento = await Estabelecimento.findByPk(id);
      if (!estabelecimento) {
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }

      if (estabelecimento.status === StatusEstabelecimento.PENDENTE_APROVACAO) {
        await estabelecimento.destroy();
      } else {
        estabelecimento.status = StatusEstabelecimento.ATIVO;
        estabelecimento.dados_atualizacao = null;
      }

      await estabelecimento.save();
      return res
        .status(200)
        .json({ message: "Solicitação rejeitada com sucesso." });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao rejeitar a solicitação." });
    }
  }
}
