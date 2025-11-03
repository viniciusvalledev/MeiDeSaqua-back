import { Avaliacao, Estabelecimento, Usuario } from "../entities";
import ProfanityFilter from "../utils/ProfanityFilter";
import { containsEmoji } from "../utils/ValidationEmoji";
import EmailService from "../utils/EmailService"; // Importação Adicionada

class AvaliacaoService {
  /**
   * Submete uma avaliação principal ou uma resposta a uma avaliação existente.
   */
  public async submeterAvaliacao(dadosAvaliacao: any, usuarioLogadoId: number) {
    const { nota, comentario, estabelecimentoId, parent_id } = dadosAvaliacao;

    // Validações que se aplicam a todos (comentários E respostas)
    if (!estabelecimentoId) {
      throw new Error("O ID do estabelecimento é obrigatório.");
    }
    if (ProfanityFilter.contemPalavrao(comentario)) {
      throw new Error("Você utilizou palavras inapropriadas.");
    }
    if (containsEmoji(comentario)) {
      throw new Error("O comentário não pode conter emojis.");
    }

    // Busca o estabelecimento (adaptado de "Projeto" para "Estabelecimento")
    const estabelecimento = await Estabelecimento.findByPk(estabelecimentoId);
    if (!estabelecimento) {
      throw new Error(
        `Estabelecimento não encontrado com o ID: ${estabelecimentoId}`
      );
    }

    let notaFinal: number | null = nota;

    if (parent_id) {
      // É UMA RESPOSTA
      notaFinal = null; // Respostas NUNCA têm nota

      const parentAvaliacao = await Avaliacao.findByPk(parent_id);
      if (!parentAvaliacao) {
        throw new Error("Comentário pai não encontrado.");
      }
      if (parentAvaliacao.parent_id !== null) {
        throw new Error("Não é possível responder a uma resposta.");
      }
      if (parentAvaliacao.estabelecimentoId !== estabelecimento.estabelecimentoId) {
         throw new Error("A resposta não pertence ao mesmo estabelecimento do comentário pai.");
      }

    } else {
      // É UM COMENTÁRIO PRINCIPAL
      if (!nota || nota < 1 || nota > 5) {
        throw new Error("A nota da avaliação (1 a 5) é obrigatória para um novo comentário.");
      }

      // Verifica se o usuário já avaliou este estabelecimento
      const avaliacaoExistente = await Avaliacao.findOne({
        where: {
          usuarioId: usuarioLogadoId,
          estabelecimentoId: estabelecimentoId,
          parent_id: null, // Importante: só impede duplicidade em comentários principais
        },
      });

      if (avaliacaoExistente) {
        throw new Error("Este utilizador já avaliou este estabelecimento.");
      }
    }

    // Cria a avaliação (ou resposta)
    const novaAvaliacao = await Avaliacao.create({
      nota: notaFinal, // Será 'null' para respostas
      comentario,
      estabelecimentoId,
      usuarioId: usuarioLogadoId,
      parent_id: parent_id || null, // Salva a referência pai, se existir
    });

    // --- Início da Notificação por E-mail ---
    try {
      const usuario = await Usuario.findByPk(usuarioLogadoId);

      // Envia e-mail se o estabelecimento tiver um e-mail cadastrado e o usuário existir
      if (estabelecimento.emailEstabelecimento && usuario) {
        const eUmaResposta = parent_id ? "uma nova resposta" : "um novo comentário";
        const notaTexto = notaFinal ? `(Nota: ${notaFinal}/5)` : "";

        // Adapta os campos para o contexto do MeiDeSaquá
        const subject = `[MeideSaquá] Novo Comentário no seu estabelecimento: ${estabelecimento.nomeFantasia}`;
        const html = `
          <p>Olá, ${estabelecimento.nomeResponsavel || estabelecimento.nomeFantasia},</p>
          <p>Seu estabelecimento "<strong>${estabelecimento.nomeFantasia}</strong>" recebeu ${eUmaResposta} na plataforma MeideSaquá.</p>
          <br>
          <p><strong>Usuário:</strong> ${usuario.username}</p>
          <p><strong>Comentário ${notaTexto}:</strong></p>
          <blockquote style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px; font-style: italic;">
            "${comentario}"
          </blockquote>
          <br>
          <p>Acesse a plataforma para ver mais detalhes.</p>
          <p>Atenciosamente,<br>Equipe MeideSaquá</p>
        `;

        await EmailService.sendGenericEmail({
          to: estabelecimento.emailEstabelecimento,
          subject: subject,
          html: html,
        });
      }
    } catch (emailError: any) {
      // A falha no envio do e-mail não deve interromper o fluxo principal.
      // Apenas registramos o erro no console.
      console.error(
        `Falha ao enviar e-mail de notificação de avaliação para ${estabelecimento.emailEstabelecimento}:`,
        emailError.message
      );
    }
    // --- Fim da Notificação por E-mail ---

    return novaAvaliacao;
  }

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

    // MODIFICADO: Lógica para nota
    // Só permite atualizar a nota se FOR UM COMENTÁRIO PRINCIPAL (sem parent_id)
    if (avaliacao.parent_id === null && dadosAvaliacao.nota != null) {
      if (dadosAvaliacao.nota < 1 || dadosAvaliacao.nota > 5) {
        throw new Error("A nota da avaliação deve estar entre 1 e 5.");
      }
      avaliacao.nota = dadosAvaliacao.nota;
    } else if (avaliacao.parent_id !== null) {
      // Se for uma resposta, garante que a nota permaneça nula
      avaliacao.nota = null;
    }

    avaliacao.comentario = dadosAvaliacao.comentario ?? avaliacao.comentario;

    return await avaliacao.save();
  }

  public async excluirAvaliacao(avaliacaoId: number, usuarioLogadoId: number) {
    const avaliacao = await Avaliacao.findByPk(avaliacaoId);
    if (!avaliacao) {
      throw new Error(`Avaliação não encontrada com o ID: ${avaliacaoId}`);
    }
    if (avaliacao.usuarioId !== usuarioLogadoId) {
      throw new Error("Você não tem permissão para excluir esta avaliação.");
    }
    
    // Se a definição da entidade tiver 'onDelete: CASCADE' na associação 'respostas',
    // isto excluirá automaticamente todas as respostas filhas.
    await avaliacao.destroy();
  }

  /**
   * Lista avaliações (principais) e suas respostas aninhadas.
   */
  public async listarPorEstabelecimentoDTO(estabelecimentoId: number) {
    return Avaliacao.findAll({
      where: {
        estabelecimentoId: estabelecimentoId,
        parent_id: null, // Busca APENAS comentários principais
      },
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: {
            // Mantém os excludes do seu arquivo original
            exclude: [
              "password",
              "email",
              "cpf", // Assumindo que este campo exista na entidade Usuario
              "dataNascimento", // Assumindo que este campo exista
              "enabled",
              "confirmationToken",
              "resetPasswordToken",
              "resetPasswordTokenExpiry",
              "unconfirmedEmail",
              "emailChangeToken"
            ],
          },
        },
        {
          // Inclui as respostas aninhadas
          model: Avaliacao,
          as: "respostas", // Requer associação definida na entidade
          required: false,
          include: [
            {
              // Inclui o usuário da resposta
              model: Usuario,
              as: "usuario",
              attributes: {
                // Exclui os mesmos campos para os usuários das respostas
                exclude: [
                  "password",
                  "email",
                  "cpf",
                  "dataNascimento",
                  "enabled",
                  "confirmationToken",
                  "resetPasswordToken",
                  "resetPasswordTokenExpiry",
                  "unconfirmedEmail",
                  "emailChangeToken"
                ],
              },
            },
          ],
        },
      ],
      order: [
        ["avaliacoesId", "DESC"], // Comentários principais mais novos primeiro
        // Ordena as respostas aninhadas pela data de criação (ID) ascendente
        [{ model: Avaliacao, as: "respostas" }, "avaliacoesId", "ASC"], 
      ],
    });
  }
}

export default new AvaliacaoService();