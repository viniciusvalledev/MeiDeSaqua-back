import { Op } from "sequelize";
import { Estabelecimento, ImagemProduto, Avaliacao } from "../entities";
import sequelize from "../config/database";
import { StatusEstabelecimento } from "../entities/Estabelecimento.entity";

class EstabelecimentoService {
  public async cadastrarEstabelecimentoComImagens(dto: any) {
    if (dto.cnpj && dto.cnpj.trim() !== "") {
      const cnpjExists = await Estabelecimento.findOne({ where: { cnpj: dto.cnpj } });
      if (cnpjExists) {
        throw new Error("CNPJ já cadastrado no sistema.");
      }
    }

    if (dto.emailEstabelecimento && dto.emailEstabelecimento.trim() !== "") {
      const emailExists = await Estabelecimento.findOne({ where: { emailEstabelecimento: dto.emailEstabelecimento } });
      if (emailExists) {
        throw new Error("E-mail já cadastrado no sistema.");
      }
    }

    const { produtos, ...dadosEstabelecimento } = dto;
    const novoEstabelecimento = await Estabelecimento.create({
      ...dadosEstabelecimento,
      logoUrl: dadosEstabelecimento.logo,
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
  
  public async solicitarAtualizacaoPorCnpj(cnpj: string, dadosAtualizacao: any) {
    if (dadosAtualizacao.descricao && dadosAtualizacao.descricao.length > 500) {
        throw new Error("Data too long for column 'descricao'");
    }
    if (dadosAtualizacao.descricaoDiferencial && dadosAtualizacao.descricaoDiferencial.length > 130) {
        throw new Error("Data too long for column 'descricao_diferencial'");
    }

    const estabelecimento = await Estabelecimento.findOne({ where: { cnpj } });

    if (!estabelecimento) {
      throw new Error("Estabelecimento não encontrado com o CNPJ fornecido.");
    }

    if (estabelecimento.status !== StatusEstabelecimento.ATIVO) {
      throw new Error("Não é possível solicitar atualização para um estabelecimento que não está ativo.");
    }
    
    const { cnpj: _, ...dadosLimpos } = dadosAtualizacao;

    estabelecimento.dados_atualizacao = dadosLimpos;
    estabelecimento.status = StatusEstabelecimento.PENDENTE_ATUALIZACAO;

    return await estabelecimento.save({ fields: ["dados_atualizacao", "status"] });
  }

  public async solicitarExclusaoPorCnpj(cnpj: string) {
    const estabelecimento = await Estabelecimento.findOne({ where: { cnpj } });

    if (!estabelecimento) {
      throw new Error("Estabelecimento não encontrado com o CNPJ fornecido.");
    }

    if (estabelecimento.status !== StatusEstabelecimento.ATIVO) {
      throw new Error("Não é possível solicitar exclusão para um estabelecimento que não está ativo.");
    }
    
    estabelecimento.status = StatusEstabelecimento.PENDENTE_EXCLUSAO;

    return await estabelecimento.save({ fields: ["dados_atualizacao", "status"] });
  }

  public async listarTodos() {
    return Estabelecimento.findAll({
      where: { status: StatusEstabelecimento.ATIVO },
      include: [
        { model: ImagemProduto, as: "produtosImg", attributes: [] },
        { model: Avaliacao, as: "avaliacoes", attributes: [] },
      ],
      attributes: {
        include: [
          [sequelize.fn("AVG", sequelize.col("avaliacoes.nota")), "media"],
          [sequelize.fn("GROUP_CONCAT", sequelize.col("produtosImg.url")), "produtosImgUrls"],
        ],
      },
      group: ["Estabelecimento.estabelecimento_id"],
      order: [["estabelecimento_id", "DESC"]],
    });
  }

  public async buscarPorId(id: number) {
    return Estabelecimento.findOne({
      where: { estabelecimentoId: id, status: StatusEstabelecimento.ATIVO }, 
      include: [
        { model: ImagemProduto, as: "produtosImg", attributes: [] },
        { model: Avaliacao, as: "avaliacoes", attributes: [] },
      ],
      attributes: {
        include: [
          [sequelize.fn("AVG", sequelize.col("avaliacoes.nota")), "media"],
          [sequelize.fn("GROUP_CONCAT", sequelize.col("produtosImg.url")), "produtosImgUrls"],
        ],
      },
      group: ["Estabelecimento.estabelecimento_id"],
    });
  }

  public async buscarPorNome(nome: string) {
    return Estabelecimento.findAll({
      where: {
        nomeFantasia: { [Op.like]: `%${nome}%` },
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
    if (!novoStatus && estabelecimento.status === StatusEstabelecimento.ATIVO) {
        // Lógica futura pode ser adicionada aqui
    }
    return await estabelecimento.save();
  }
}

export default new EstabelecimentoService();