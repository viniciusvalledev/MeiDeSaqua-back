import { Op } from "sequelize";
import { Estabelecimento, ImagemProduto, Avaliacao } from "../entities";
import sequelize from "../config/database";
import { StatusEstabelecimento } from "../entities/Estabelecimento.entity";
import { ICreateUpdateEstabelecimentoRequest } from "../interfaces/requests";

class EstabelecimentoService {
  public async cadastrarEstabelecimentoComImagens(dto: any) {
    if (dto.cnpj && dto.cnpj.trim() !== "") {
      const cnpjExists = await Estabelecimento.findOne({
        where: { cnpj: dto.cnpj },
      });
      if (cnpjExists) {
        throw new Error("CNPJ já cadastrado no sistema.");
      }
    }

    const { produtos, ...dadosEstabelecimento } = dto;

    const novoEstabelecimento = await Estabelecimento.create({
      ...dadosEstabelecimento,
      logoUrl: dadosEstabelecimento.logo,
      areasAtuacao: dadosEstabelecimento.areasAtuacao,
    });

    if (produtos && produtos.length > 0) {
      const imagensPromises = produtos.map((urlDaImagem: string) => {
        return ImagemProduto.create({
          url: urlDaImagem,
          estabelecimentoId: novoEstabelecimento.estabelecimentoId,
        });
      });
      await Promise.all(imagensPromises);
    }

    return novoEstabelecimento;
  }

  public async listarTodos() {
    return Estabelecimento.findAll({
      where: {
        status: StatusEstabelecimento.ATIVO,
      },
      include: [
        {
          model: ImagemProduto,
          as: "produtosImg",
          attributes: [],
        },
        {
          model: Avaliacao,
          as: "avaliacoes",
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [sequelize.fn("AVG", sequelize.col("avaliacoes.nota")), "media"],
          [
            sequelize.fn("GROUP_CONCAT", sequelize.col("produtosImg.url")),
            "produtosImgUrls",
          ],
        ],
      },
      group: ["Estabelecimento.estabelecimento_id"],
      order: [["estabelecimento_id", "DESC"]],
    });
  }

  public async buscarPorId(id: number) {
    return Estabelecimento.findOne({
      where: { estabelecimentoId: id },
      include: [
        {
          model: ImagemProduto,
          as: "produtosImg",
          attributes: [],
        },
        {
          model: Avaliacao,
          as: "avaliacoes",
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [sequelize.fn("AVG", sequelize.col("avaliacoes.nota")), "media"],
          [
            sequelize.fn("GROUP_CONCAT", sequelize.col("produtosImg.url")),
            "produtosImgUrls",
          ],
        ],
      },
      group: ["Estabelecimento.estabelecimento_id"],
    });
  }

  public async buscarPorNome(nome: string) {
    return Estabelecimento.findAll({
      where: {
        nomeFantasia: {
          [Op.like]: `%${nome}%`,
        },
        status: StatusEstabelecimento.ATIVO,
      },
      include: [{ model: ImagemProduto, as: "produtosImg" }],
    });
  }

  public async alterarStatusAtivo(id: number, novoStatus: boolean) {
    const estabelecimento = await Estabelecimento.findByPk(id);
    if (!estabelecimento) {
      throw new Error(`Estabelecimento não encontrado com o ID: ${id}`);
    }
    estabelecimento.ativo = novoStatus;
    estabelecimento.status = novoStatus
      ? StatusEstabelecimento.ATIVO
      : StatusEstabelecimento.REJEITADO;
    return await estabelecimento.save();
  }

  public async atualizarEstabelecimento(
    id: number,
    dadosAtualizacao: ICreateUpdateEstabelecimentoRequest
  ) {
    const estabelecimento = await Estabelecimento.findByPk(id);

    if (!estabelecimento) {
      throw new Error(`Estabelecimento não encontrado com o ID: ${id}`);
    }

    await estabelecimento.update(dadosAtualizacao);

    return estabelecimento;
  }

  // MÉTODO ALTERADO PARA HARD DELETE
  public async deletarEstabelecimento(id: number) {
    const estabelecimento = await Estabelecimento.findByPk(id);
    if (!estabelecimento) {
      throw new Error(`Estabelecimento não encontrado com o ID: ${id}`);
    }
    // Deleta o registro permanentemente do banco de dados
    await estabelecimento.destroy();
  }
}

export default new EstabelecimentoService();