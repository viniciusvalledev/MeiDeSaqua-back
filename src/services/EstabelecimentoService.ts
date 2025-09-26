import { Op } from "sequelize";
import { Estabelecimento, ImagemProduto, Avaliacao } from "../entities";
import sequelize from "../config/database";
import { StatusEstabelecimento } from "../entities/Estabelecimento.entity"; 

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

    // 1. separamos a propriedade 'produtos' do resto do objeto 'dto'.
    const { produtos, ...dadosEstabelecimento } = dto;

    // 2. Agora, criamos o estabelecimento usando apenas os dados que pertencem a ele.
    const novoEstabelecimento = await Estabelecimento.create({
      ...dadosEstabelecimento,
      logoUrl: dadosEstabelecimento.logo,
    });

    // 3. A lógica para salvar as imagens do portfólio (usando a variável 'produtos') permanece a mesma
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
    estabelecimento.status = novoStatus ? StatusEstabelecimento.ATIVO : StatusEstabelecimento.REJEITADO;
    return await estabelecimento.save();
  }
}

export default new EstabelecimentoService();