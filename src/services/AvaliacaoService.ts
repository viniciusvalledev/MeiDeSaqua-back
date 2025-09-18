// src/services/AvaliacaoService.ts
import { Avaliacao, Estabelecimento, Usuario } from "../entities";
import ProfanityFilter from "../utils/ProfanityFilter";

class AvaliacaoService {
  /**
   * Submete uma nova avaliação para um estabelecimento.
   */
  public async submeterAvaliacao(dadosAvaliacao: any, usuarioLogadoId: number) {
    const { nota, comentario, estabelecimentoId } = dadosAvaliacao;

    if (nota < 1 || nota > 5) {
      throw new Error("A nota da avaliação deve estar entre 1 e 5.");
    }
    if (!estabelecimentoId) {
      throw new Error("O ID do estabelecimento é obrigatório.");
    }
    if (ProfanityFilter.contemPalavrao(comentario)) {
      throw new Error("Você utilizou palavras inapropriadas.");
    }

    const estabelecimento = await Estabelecimento.findByPk(estabelecimentoId);
    if (!estabelecimento) {
      throw new Error(
        `Estabelecimento não encontrado com o ID: ${estabelecimentoId}`
      );
    }

    const avaliacaoExistente = await Avaliacao.findOne({
      where: {
        usuarioId: usuarioLogadoId,
        estabelecimentoId: estabelecimentoId,
      },
    });

    if (avaliacaoExistente) {
      throw new Error("Este utilizador já avaliou este estabelecimento.");
    }

    return Avaliacao.create({
      nota,
      comentario,
      estabelecimentoId,
      usuarioId: usuarioLogadoId,
    });
  }

  /**
   * Atualiza uma avaliação existente.
   */
  public async atualizarAvaliacao(
    avaliacaoId: number,
    dadosAvaliacao: any,
    usuarioLogadoId: number
  ) {
    const avaliacao = await Avaliacao.findByPk(avaliacaoId);
    if (!avaliacao) {
      throw new Error(`Avaliação não encontrada com o ID: ${avaliacaoId}`);
    }
    if (avaliacao.usuarioId !== usuarioLogadoId) {
      throw new Error("Você não tem permissão para editar esta avaliação.");
    }

    if (
      dadosAvaliacao.comentario &&
      ProfanityFilter.contemPalavrao(dadosAvaliacao.comentario)
    ) {
      throw new Error("Você utilizou palavras inapropriadas.");
    }

    if (
      dadosAvaliacao.nota &&
      (dadosAvaliacao.nota < 1 || dadosAvaliacao.nota > 5)
    ) {
      throw new Error("A nota da avaliação deve estar entre 1 e 5.");
    }

    avaliacao.comentario = dadosAvaliacao.comentario ?? avaliacao.comentario;
    avaliacao.nota = dadosAvaliacao.nota ?? avaliacao.nota;

    return await avaliacao.save();
  }

  /**
   * Exclui uma avaliação.
   */
  public async excluirAvaliacao(avaliacaoId: number, usuarioLogadoId: number) {
    const avaliacao = await Avaliacao.findByPk(avaliacaoId);
    if (!avaliacao) {
      throw new Error(`Avaliação não encontrada com o ID: ${avaliacaoId}`);
    }
    if (avaliacao.usuarioId !== usuarioLogadoId) {
      throw new Error("Você não tem permissão para excluir esta avaliação.");
    }
    await avaliacao.destroy();
  }

  /**
   * Lista todas as avaliações de um estabelecimento específico.
   */
  public async listarPorEstabelecimentoDTO(estabelecimentoId: number) {
    return Avaliacao.findAll({
      where: { estabelecimentoId },
      include: [
        {
          model: Usuario,
          as: "usuario", // <-- CORREÇÃO: Adicionado o alias 'usuario'
          attributes: {
            exclude: [
              "password",
              "email",
              "cpf",
              "dataNascimento",
              "createdAt",
              "updatedAt",
            ],
          }, // Otimizado para retornar apenas o necessário (nome, foto, etc.)
        },
      ],
    });
  }
}

export default new AvaliacaoService();
