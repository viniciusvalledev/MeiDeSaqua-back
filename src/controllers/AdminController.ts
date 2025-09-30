import { Request, Response } from "express";
import Estabelecimento, {
  StatusEstabelecimento,
} from "../entities/Estabelecimento.entity";
import * as jwt from "jsonwebtoken";
import { Op } from "sequelize";
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
    try {
      const estabelecimento = await Estabelecimento.findByPk(id);
      if (!estabelecimento) {
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
      }

      switch (estabelecimento.status) {
        case StatusEstabelecimento.PENDENTE_APROVACAO:
          estabelecimento.status = StatusEstabelecimento.ATIVO;
          estabelecimento.ativo = true; // Ativa o estabelecimento
          break;
        case StatusEstabelecimento.PENDENTE_ATUALIZACAO:
          // Aplica os dados da atualização e volta para ativo
          if (estabelecimento.dados_atualizacao) {
            Object.assign(estabelecimento, estabelecimento.dados_atualizacao);
          }
          estabelecimento.dados_atualizacao = null;
          estabelecimento.status = StatusEstabelecimento.ATIVO;
          break;
        case StatusEstabelecimento.PENDENTE_EXCLUSAO:
          await estabelecimento.destroy();
          return res
            .status(200)
            .json({ message: "Estabelecimento excluído com sucesso." });
      }

      await estabelecimento.save();
      return res
        .status(200)
        .json({ message: "Solicitação aprovada com sucesso." });
    } catch (error) {
      console.error(error);
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
        // Se a rejeição for de um novo cadastro, podemos deletar ou marcar como rejeitado
        await estabelecimento.destroy(); // Opção: deleta o registro
        // ou: estabelecimento.status = StatusEstabelecimento.REJEITADO; // Opção: mantém o registro
      } else {
        // Para atualizações e exclusões rejeitadas, simplesmente voltamos ao estado ATIVO
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
