import { Request, Response } from "express";
import Estabelecimento, { StatusEstabelecimento } from "../entities/Estabelecimento.entity"; // Assumindo que Estabelecimento.entity.ts existe
import * as jwt from "jsonwebtoken";
import ImagemProduto from "../entities/ImagemProduto.entity"; // Verifique se o caminho está correto
import sequelize from "../config/database";
import fs from "fs/promises";
import path from "path";
import EmailService from "../utils/EmailService";
import EstabelecimentoService from "../services/EstabelecimentoService";
import Avaliacao from "../entities/Avaliacao.entity";
import Usuario from "../entities/Usuario.entity";

const ADMIN_USER = process.env.ADMIN_USER;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const JWT_SECRET = process.env.ADMIN_JWT_SECRET;

if (!ADMIN_USER || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

  console.error("ERRO CRÍTICO: Variáveis de ambiente do Admin não definidas.");

  console.error(
    "Por favor, defina ADMIN_USER, ADMIN_PASSWORD, e ADMIN_JWT_SECRET"
  );

  console.error(
    "no seu ficheiro .env (ou .env.local) antes de iniciar o servidor."
  );

  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

  throw new Error(
    "Credenciais de administrador ou segredo JWT não configurados."
  );
}

export class AdminController {
  // --- As funções login, getPending, e approveRequest estão corretas ---
  // --- Nenhuma alteração nelas ---
  static async login(req: Request, res: Response) {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { username, role: "admin" },
        JWT_SECRET as string,
        {
          expiresIn: "8h",
        }
      );
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
        as: "ImagemProduto", // Alias correto para a associação Estabelecimento <-> ImagemProduto
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
    const transaction = await sequelize.transaction();

    try {
      let responseMessage = "Solicitação aprovada com sucesso.";

      const estabelecimento = await Estabelecimento.findByPk(id, {
        transaction,
        include: [{ model: ImagemProduto, as: "ImagemProduto" }],
      });
      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }
      let emailInfo: { subject: string; html: string } | null = null;

      switch (estabelecimento.status) {
        case StatusEstabelecimento.PENDENTE_APROVACAO:
          estabelecimento.status = StatusEstabelecimento.ATIVO;
          estabelecimento.ativo = true;
          await estabelecimento.save({ transaction });

          emailInfo = {
            subject: "Seu cadastro no MeideSaquá foi Aprovado!",
            html: `
              <h1>Olá, ${estabelecimento.nomeResponsavel}!</h1>
              <p>Temos uma ótima notícia: o seu estabelecimento, <strong>${estabelecimento.nomeFantasia}</strong>, foi aprovado e já está visível na nossa plataforma!</p>
              <p>A partir de agora, clientes podem encontrar o seu negócio e deixar avaliações.</p>
              <p>Agradecemos por fazer parte da comunidade de empreendedores de Saquarema.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe MeideSaquá.</strong></p>
            `,
          };
          break;

        case StatusEstabelecimento.PENDENTE_ATUALIZACAO:
          if (estabelecimento.dados_atualizacao) {
            const dadosRecebidos = estabelecimento.dados_atualizacao as any;
            const dadosParaAtualizar: Partial<Estabelecimento> & {
              [key: string]: any;
            } = {};
            const camposPermitidos: (keyof Estabelecimento | string)[] = [
              "descricaoDiferencial", "descricao", "objetivo", "justificativa",
              "publicoAlvo", "impacto", "localizacao", "website", "instagram",
              "facebook", "youtube", "tagsInvisiveis", "odsRelacionadas", "odsId", "venceuPspe",
            ];

            for (const key of camposPermitidos) {
              if (
                dadosRecebidos.hasOwnProperty(key) &&
                dadosRecebidos[key] != null
              ) {
                (dadosParaAtualizar as any)[key] = dadosRecebidos[key];
              }
            }
            if (dadosRecebidos.logo) {
              const logoAntigaUrl = estabelecimento.logoUrl;
              if (logoAntigaUrl) {
                try {
                  const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(`AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`, err);
                }
              }
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
            }

            if (
              dadosRecebidos.imagens && 
              Array.isArray(dadosRecebidos.imagens) &&
              dadosRecebidos.imagens.length > 0
            ) {
              const imagensAntigas = await ImagemProduto.findAll({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId }, 
                transaction,
              });

              for (const imagem of imagensAntigas) {
                try {
                  const filePath = path.join(__dirname, "..", "..", imagem.url);
                  await fs.unlink(filePath);
                } catch (err) {
                  console.error(`AVISO: Falha ao deletar imagem antiga: ${imagem.url}`, err);
                }
              }

              await ImagemProduto.destroy({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId }, 
                transaction,
              });

              const novasImagens = dadosRecebidos.imagens.map(
                (url: string) => ({
                  url,
                  estabelecimentoId : estabelecimento.estabelecimentoId, 
                })
              );
              await ImagemProduto.bulkCreate(novasImagens, { transaction });
            }

            dadosParaAtualizar.dados_atualizacao = null;
            dadosParaAtualizar.status = StatusEstabelecimento.ATIVO;
            dadosParaAtualizar.ativo = true; 

            await estabelecimento.update(dadosParaAtualizar, { transaction });
          } else {
            estabelecimento.dados_atualizacao = null;
            estabelecimento.status = StatusEstabelecimento.ATIVO;
            estabelecimento.ativo = true;
            await estabelecimento.save({ transaction });
          }

          emailInfo = {
            subject: "Sua solicitação de atualização no MeideSaquá foi Aprovada!",
            html: `
              <h1>Olá, ${estabelecimento.nomeResponsavel}!</h1>
              <p>A sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> foi aprovada.</p>
              <p>As novas informações já estão visíveis para todos na plataforma.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe MeideSaquá</strong></p>
            `,
          };
          break; 

        case StatusEstabelecimento.PENDENTE_EXCLUSAO:
          emailInfo = {
            subject: "Seu estabelecimento foi removido da plataforma MeideSaquá",
            html: `
              <h1>Olá, ${estabelecimento.nomeResponsavel}.</h1>
              <p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> da nossa plataforma foi concluída com sucesso.</p>
              <p>Lamentamos a sua partida e esperamos poder colaborar com você novamente no futuro.</p>
              <br>
              <p>Atenciosamente,</p>
              <p><strong>Equipe MeideSaquá</strong></p>
            `,
          };
          // TODO: Adicionar lógica para deletar arquivos (logo, imagens) ANTES do destroy
          await estabelecimento.destroy({ transaction });
          responseMessage = "Estabelecimento excluído com sucesso.";

          break;
      }

      await transaction.commit();

      if (emailInfo && estabelecimento.emailEstabelecimento) {
        try {
          await EmailService.sendGenericEmail({
            to: estabelecimento.emailEstabelecimento, 
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(`Email de notificação enviado com sucesso para ${estabelecimento.emailEstabelecimento}`);
        } catch (error) {
          console.error(`Falha ao enviar email de notificação para ${estabelecimento.emailEstabelecimento}:`, error);
        }
      } else if (emailInfo) {
        console.warn(`Tentativa de enviar email para estabelecimento ID ${estabelecimento.estabelecimentoId} sem emailContato definido.`);
      }

      return res.status(200).json({ message: responseMessage }); 
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A APROVAÇÃO:", error);
      return res
        .status(500)
        .json({ message: "Erro ao aprovar a solicitação." });
    }
  }

  static async editAndApproveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const adminEditedData = req.body; 

    // ***** CORREÇÃO 1: Fazer o parse do urlsParaExcluir (que vem como string JSON) *****
    let { urlsParaExcluir } = adminEditedData; // Usa 'let' para poder modificar
    if (urlsParaExcluir && typeof urlsParaExcluir === 'string') {
        try {
            urlsParaExcluir = JSON.parse(urlsParaExcluir);
        } catch (e) {
            console.error("Falha ao parsear urlsParaExcluir em editAndApproveRequest:", e);
            urlsParaExcluir = []; // Reseta para um array vazio em caso de erro
        }
    }
    // ***** FIM DA CORREÇÃO 1 *****

    const transaction = await sequelize.transaction();

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, {
        transaction,
        include: [{ model: ImagemProduto, as: "ImagemProduto" }],
      });

      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      let emailInfo: { subject: string; html: string } | null = null;
      const statusOriginal = estabelecimento.status;
      const dadosRecebidos = (estabelecimento.dados_atualizacao || {}) as any;

      if (
        statusOriginal === StatusEstabelecimento.PENDENTE_ATUALIZACAO &&
        estabelecimento.dados_atualizacao
      ) {
        // Lógica para LOGO
        
        // ***** CORREÇÃO 2: Corrigir o bug do hasOwnProperty E checar por "DELETE" *****
        // Cenário 1: Admin marcou a logo para DELEÇÃO
        if (
          ("logoUrl" in adminEditedData) && // <-- Correção do hasOwnProperty
          adminEditedData.logoUrl === "DELETE" // <-- Correção da lógica (o front envia "DELETE")
        ) {
          const logoAntigaUrl = estabelecimento.logoUrl || dadosRecebidos.logo;
          if (logoAntigaUrl) {
            try {
              const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
              await fs.unlink(filePath);
            } catch (err) {
              console.error(`AVISO: Falha ao deletar logo: ${logoAntigaUrl}`, err);
            }
          }
          adminEditedData.logoUrl = null; // Define como null para salvar no banco
        }
        // ***** FIM DA CORREÇÃO 2 *****

        // Cenário 2: Admin APROVOU uma nova logo
        else if (dadosRecebidos.logo) {
          const logoAntigaUrl = estabelecimento.logoUrl; 
          if (logoAntigaUrl) {
            try {
              const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
              await fs.unlink(filePath);
            } catch (err) {
              console.error(`AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`, err);
            }
          }
          adminEditedData.logoUrl = dadosRecebidos.logo;
        }

        // Lógica para IMAGENS
        // Cenário 1: Admin APROVOU novas imagens
        if (
          dadosRecebidos.imagens &&
          Array.isArray(dadosRecebidos.imagens) &&
          dadosRecebidos.imagens.length > 0
        ) {
          const imagensAntigas = await ImagemProduto.findAll({
            where: { estabelecimentoId: estabelecimento.estabelecimentoId },
            transaction,
          });

          for (const imagem of imagensAntigas) {
            try {
              const filePath = path.join(__dirname, "..", "..", imagem.url);
              await fs.unlink(filePath);
            } catch (err) { /* ... log ... */ }
          }

          await ImagemProduto.destroy({
            where: { estabelecimentoId : estabelecimento.estabelecimentoId },
            transaction,
          });

          // Agora 'urlsParaExcluir' já é um array, graças à Correção 1
          const imagensParaCriar = dadosRecebidos.imagens.filter(
            (url: string) => !(urlsParaExcluir && urlsParaExcluir.includes(url))
          );

          const novasImagens = imagensParaCriar.map((url: string) => ({
            url,
            estabelecimentoId: estabelecimento.estabelecimentoId,
          }));
          await ImagemProduto.bulkCreate(novasImagens, { transaction });
        }
        // Cenário 2: NÃO havia imagens novas, mas admin deletou imagens ANTIGAS
        else if (
          urlsParaExcluir &&
          Array.isArray(urlsParaExcluir) && // <-- Agora esta checagem funciona
          urlsParaExcluir.length > 0
        ) {
          const imagensParaDeletar = await ImagemProduto.findAll({
            where: {
              url: urlsParaExcluir,
              estabelecimentoId: estabelecimento.estabelecimentoId,
            },
            transaction,
          });

          for (const imagem of imagensParaDeletar) {
            try {
              const filePath = path.join(__dirname, "..", "..", imagem.url);
              await fs.unlink(filePath);
            } catch (err) { /* ... log ... */ }
          }

          await ImagemProduto.destroy({
            where: {
              id: imagensParaDeletar.map((img) => img.id),
            },
            transaction,
          });
        }
      }

      // Remove o 'urlsParaExcluir' (que era uma string JSON) para não salvar no DB
      delete adminEditedData.urlsParaExcluir; 

      await estabelecimento.update(
        {
          ...adminEditedData, 
          status: StatusEstabelecimento.ATIVO,
          ativo: true,
          dados_atualizacao: null, 
        },
        { transaction }
      );

      if (statusOriginal === StatusEstabelecimento.PENDENTE_APROVACAO) {
        emailInfo = {
            subject: "Seu cadastro no MeideSaquá foi Aprovado!", 
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}!</h1> <p>Temos uma ótima notícia: o seu estabelecimento, <strong>${estabelecimento.nomeFantasia}</strong>, foi aprovado (com algumas edições do administrador) e já está visível na nossa plataforma!</p><p>Agradecemos por fazer parte da comunidade de empreendedores de Saquarema.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá.</strong></p>` 
        };
      } else if (statusOriginal === StatusEstabelecimento.PENDENTE_ATUALIZACAO) {
        emailInfo = { 
            subject: "Sua solicitação de atualização no MeideSaquá foi Aprovada!", 
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}!</h1><p>A sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> foi aprovada (com algumas edições do administrador).</p><p>As novas informações já estão visíveis para todos na plataforma.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>` 
        };
      }

      await transaction.commit();

      if (emailInfo && estabelecimento.emailEstabelecimento) {
        try {
          await EmailService.sendGenericEmail({
            to: estabelecimento.emailEstabelecimento,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
        } catch (error) {
          console.error(`Falha ao enviar email de notificação para ${estabelecimento.emailEstabelecimento}:`, error);
        }
      }

      return res
        .status(200)
        .json({ message: "Estabelecimento editado e aprovado com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A EDIÇÃO E APROVAÇÃO:", error);
      return res
        .status(500)
        .json({ message: "Erro ao editar e aprovar a solicitação." });
    }
  }

  static async getAllActiveEstabelecimentos(req: Request, res: Response) {
    try {
      const estabelecimentos = await EstabelecimentoService.listarTodos();
      return res.json(estabelecimentos);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar estabelecimentos ativos." });
    }
  }

  static async adminUpdateEstabelecimento(req: Request, res: Response) {
    const { id } = req.params;
    const adminEditedData = req.body;
    
    // ***** CORREÇÃO 1: Fazer o parse do urlsParaExcluir (que vem como string JSON) *****
    let { urlsParaExcluir } = adminEditedData; // Usa 'let' para poder modificar
    if (urlsParaExcluir && typeof urlsParaExcluir === 'string') {
        try {
            urlsParaExcluir = JSON.parse(urlsParaExcluir);
        } catch (e) {
            console.error("Falha ao parsear urlsParaExcluir em adminUpdateEstabelecimento:", e);
            urlsParaExcluir = []; // Reseta para um array vazio em caso de erro
        }
    }
    // ***** FIM DA CORREÇÃO 1 *****

    const transaction = await sequelize.transaction();

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, { transaction });

      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      // 1. Lógica para Excluir LOGO
      // ***** CORREÇÃO 2: Corrigir o bug do hasOwnProperty E checar por "DELETE" *****
      // (Esta era a linha 557)
      if (
        ("logoUrl" in adminEditedData) && // <-- Correção do hasOwnProperty
        adminEditedData.logoUrl === "DELETE" && // <-- Correção da lógica (o front envia "DELETE")
        estabelecimento.logoUrl
      ) {
      // ***** FIM DA CORREÇÃO 2 *****
        const logoAntigaUrl = estabelecimento.logoUrl;
        try {
          const filePath = path.join(__dirname, "..", "..", logoAntigaUrl);
          await fs.unlink(filePath);
          console.log(`Logo antiga deletada: ${logoAntigaUrl}`);
        } catch (err) {
          console.error(`AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`, err);
        }
        adminEditedData.logoUrl = null; // Define como null para salvar no banco
      }

      // 2. Lógica para Excluir Imagens do Portfólio
      if (
        urlsParaExcluir &&
        Array.isArray(urlsParaExcluir) && // <-- Agora esta checagem funciona
        urlsParaExcluir.length > 0
      ) {
        const imagensParaDeletar = await ImagemProduto.findAll({
          where: {
            url: urlsParaExcluir, 
            estabelecimentoId: estabelecimento.estabelecimentoId,
          },
          transaction,
        });

        for (const imagem of imagensParaDeletar) {
          try {
            const filePath = path.join(__dirname, "..", "..", imagem.url);
            await fs.unlink(filePath); 
            console.log(`Imagem de portfólio deletada: ${imagem.url}`);
          } catch (err) {
            console.error(`AVISO: Falha ao deletar imagem de portfólio: ${imagem.url}`, err);
          }
        }

        await ImagemProduto.destroy({
          where: {
            id: imagensParaDeletar.map((img) => img.id),
          },
          transaction,
        });
      }

      delete adminEditedData.estabelecimentoId;
      delete adminEditedData.status;
      delete adminEditedData.ativo;
      delete adminEditedData.dados_atualizacao;
      delete adminEditedData.urlsParaExcluir;

      await estabelecimento.update(adminEditedData, { transaction });
      await transaction.commit();

      return res
        .status(200)
        .json({ message: "Estabelecimento atualizado com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A ATUALIZAÇÃO ADMIN:", error);
      return res.status(500).json({ message: "Erro ao atualizar o estabelecimento." });
    }
  }

  static adminDeleteEstabelecimento = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID do estabelecimento inválido." });
      }

      const estabelecimento = await Estabelecimento.findByPk(id);
      if (!estabelecimento) {
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      // TODO: Adicionar lógica para deletar arquivos (logo, imagens) ANTES do destroy
      await estabelecimento.destroy();

      return res.status(204).send();
    } catch (error: any) {
      console.error("Falha ao excluir estabelecimento (admin):", error);
      return res
        .status(500)
        .json({ message: "Erro interno ao excluir estabelecimento." });
    }
  };

  static async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    const { motivoRejeicao } = req.body;
    const transaction = await sequelize.transaction(); 
    try {
      const estabelecimento = await Estabelecimento.findByPk(id, { transaction });
      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      let responseMessage = "Solicitação rejeitada com sucesso.";
      let emailInfo: { subject: string; html: string } | null = null;
      const emailParaNotificar = estabelecimento.emailEstabelecimento; 
      const motivoHtml = motivoRejeicao
        ? `<p><strong>Motivo da Rejeição:</strong> ${motivoRejeicao}</p>`
        : "<p>Para mais detalhes, entre em contato conosco.</p>";

      if (estabelecimento.status === StatusEstabelecimento.PENDENTE_APROVACAO) {
        // TODO: Adicionar lógica para deletar arquivos (logo, imagens)
        await estabelecimento.destroy({ transaction });
        responseMessage = "Cadastro de estabelecimento rejeitado e removido.";

        emailInfo = {
          subject: "Seu cadastro no MeideSaquá foi Rejeitado",
          html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Lamentamos informar que o cadastro do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovado.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`,
        };
      } else if (
        estabelecimento.status === StatusEstabelecimento.PENDENTE_ATUALIZACAO ||
        estabelecimento.status === StatusEstabelecimento.PENDENTE_EXCLUSAO
      ) {
        const statusAnterior = estabelecimento.status; 
        estabelecimento.status = StatusEstabelecimento.ATIVO;
        estabelecimento.dados_atualizacao = null;
        await estabelecimento.save({ transaction }); 

        // TODO: Adicionar lógica para deletar arquivos pendentes de atualização
        if (statusAnterior === StatusEstabelecimento.PENDENTE_ATUALIZACAO) {
           emailInfo = {
            subject: "Sua solicitação de atualização no MeideSaquá foi Rejeitada",
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Os dados anteriores foram mantidos.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`,
          };
        } else {
          emailInfo = {
            subject: "Sua solicitação de exclusão no MeideSaquá foi Rejeitada",
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Seu estabelecimento continua ativo na plataforma.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`,
          };
        }
      } else {
        await transaction.rollback();
        return res.status(400).json({
          message: "O estabelecimento não está em um estado pendente para rejeição.",
        });
      }

      await transaction.commit(); 

      if (emailInfo && emailParaNotificar) {
        try {
          await EmailService.sendGenericEmail({
            to: emailParaNotificar,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(`Email de rejeição enviado com sucesso para ${emailParaNotificar}`);
        } catch (error) {
          console.error(`Falha ao enviar email de rejeição para ${emailParaNotificar}:`, error);
        }
      }

      return res.status(200).json({ message: responseMessage });
    } catch (error) {
      await transaction.rollback(); 
      console.error("Erro ao rejeitar a solicitação:", error);
      return res
        .status(500)
        .json({ message: "Erro ao rejeitar a solicitação." });
    }
  }

  static async getAvaliacoesByEstabelecimento(req: Request, res: Response) {
    try {
      const { estabelecimentoId } = req.params; 

      const estabelecimento = await Estabelecimento.findByPk(estabelecimentoId, {
        attributes: ["estabelecimentoId", "nomeFantasia", "ods"], // Corrigido de nomeEstabelecimento
      });

      if (!estabelecimento) {
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      const avaliacoes = await Avaliacao.findAll({
        where: { estabelecimentoId: estabelecimentoId, parent_id: null }, 
        include: [
          {
            model: Usuario,
            as: "usuario",
            attributes: ["usuarioId", "nomeCompleto", "email"],
          },
          {
            model: Avaliacao,
            as: "respostas",
            required: false,
            include: [
              {
                model: Usuario,
                as: "usuario",
                attributes: ["usuarioId", "nomeCompleto", "email"],
              },
            ],
          },
        ],
        order: [
          ["avaliacoesId", "DESC"], 
          [{ model: Avaliacao, as: "respostas" }, "avaliacoesId", "ASC"], 
        ],
      });

      return res.json({ estabelecimento, avaliacoes });
    } catch (error) {
      console.error("Erro ao buscar avaliações por estabelecimento (admin):", error);
      return res.status(500).json({ message: "Erro ao buscar avaliações." });
    }
  }

  static async adminDeleteAvaliacao(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const avaliacao = await Avaliacao.findByPk(id);

      if (!avaliacao) {
        return res.status(404).json({ message: "Avaliação não encontrada." });
      }

      await avaliacao.destroy();

      return res
        .status(200)
        .json({ message: "Avaliação excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir avaliação (admin):", error);
      return res.status(500).json({ message: "Erro ao excluir a avaliação." });
    }
  }
}