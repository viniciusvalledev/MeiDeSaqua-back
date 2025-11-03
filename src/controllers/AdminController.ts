import { Request, Response } from "express";
// Corrija a importação do StatusEstabelecimento para o novo arquivo
import { StatusEstabelecimento } from "../entities/Estabelecimento.entity";
import Estabelecimento from "../entities/Estabelecimento.entity";
import * as jwt from "jsonwebtoken";
// ▼ Adicione/Verifique estas importações ▼
import Avaliacao from "../entities/Avaliacao.entity"; // Adicionado para exclusão
import ImagemProduto from "../entities/ImagemProduto.entity";
import sequelize from "../config/database";
import fs from "fs/promises";
import path from "path";
// --- ADICIONADO ---
import Usuario from "../entities/Usuario.entity"; // Necessário para o novo método
// ▲ Fim das importações adicionadas/verificadas ▲
import EmailService from "../utils/EmailService";
import EstabelecimentoService from "../services/EstabelecimentoService";
import { ICreateUpdateEstabelecimentoRequest } from "../interfaces/requests";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Senha@Forte123";
const JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "seu-segredo-admin-super-secreto";

export class AdminController {
  // --- Métodos Existentes (mantidos) ---

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
      const pendingData = await EstabelecimentoService.listarPendentes();
      return res.json(pendingData);
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
        include: [{ model: ImagemProduto, as: "produtosImg" }], // Use o alias correto
      });
      if (!estabelecimento) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Estabelecimento não encontrado." });
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

            const camposPermitidos: (keyof ICreateUpdateEstabelecimentoRequest | 'nomeResponsavel' | 'cpfResponsavel' | 'cnae' | 'areasAtuacao')[] = [
                'categoria', 'contatoEstabelecimento',
                'nomeFantasia', 'emailEstabelecimento', 'endereco', 'descricao',
                'descricaoDiferencial', 'tagsInvisiveis', 'website', 'instagram',
                'nomeResponsavel', 'cpfResponsavel',
                'cnae',
                'areasAtuacao'
                // logoUrl, ccmeiUrl, produtosImg são tratados separadamente
            ];

            for (const key of camposPermitidos) {
                if (dadosRecebidos.hasOwnProperty(key) && dadosRecebidos[key] != null) {
                   (dadosParaAtualizar as any)[key] = dadosRecebidos[key];
                }
            }

            if (dadosRecebidos.logo) {
              const logoAntigaUrl = estabelecimento.logoUrl;
              if (logoAntigaUrl) {
                try {
                  const filePath = path.resolve(process.cwd(), logoAntigaUrl); // Caminho absoluto
                  await fs.unlink(filePath);
                } catch (err) { console.error(`AVISO: Falha ao deletar logo antiga: ${logoAntigaUrl}`, err); }
              }
              dadosParaAtualizar.logoUrl = dadosRecebidos.logo;
            }

             if (dadosRecebidos.ccmei) {
                const ccmeiAntigoUrl = estabelecimento.ccmeiUrl;
                if (ccmeiAntigoUrl) {
                    try {
                        const filePath = path.resolve(process.cwd(), ccmeiAntigoUrl); // Caminho absoluto
                        await fs.unlink(filePath);
                    } catch (err) { console.error(`AVISO: Falha ao deletar CCMEI antigo: ${ccmeiAntigoUrl}`, err); }
                }
                dadosParaAtualizar.ccmeiUrl = dadosRecebidos.ccmei;
            }

            if (
              dadosRecebidos.produtos &&
              Array.isArray(dadosRecebidos.produtos) &&
              dadosRecebidos.produtos.length > 0
            ) {
              const imagensAntigas = await ImagemProduto.findAll({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              for (const imagem of imagensAntigas) {
                try {
                  const filePath = path.resolve(process.cwd(), imagem.url); // Caminho absoluto
                  await fs.unlink(filePath);
                } catch (err) { console.error(`AVISO: Falha ao deletar imagem antiga: ${imagem.url}`, err); }
              }

              await ImagemProduto.destroy({
                where: { estabelecimentoId: estabelecimento.estabelecimentoId },
                transaction,
              });

              const novasImagens = dadosRecebidos.produtos.map(
                (url: string) => ({
                  url,
                  estabelecimentoId: estabelecimento.estabelecimentoId,
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

          // --- Limpeza de arquivos ANTES de destruir ---
          let pathsToDeleteExclusao: string[] = [];
          if (estabelecimento.logoUrl) pathsToDeleteExclusao.push(estabelecimento.logoUrl);
          if (estabelecimento.ccmeiUrl) pathsToDeleteExclusao.push(estabelecimento.ccmeiUrl);
          const imagensExclusao = await ImagemProduto.findAll({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });
          imagensExclusao.forEach(img => pathsToDeleteExclusao.push(img.url));

          // Deleta as imagens do DB associadas
          await ImagemProduto.destroy({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });
          
          // --- ADICIONADO: Deleta avaliações associadas ---
          await Avaliacao.destroy({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });

          // Deleta o estabelecimento
          await estabelecimento.destroy({ transaction });

          // Tenta deletar os arquivos do disco APÓS o commit bem-sucedido
          await transaction.commit(); // Commit ANTES de tentar deletar arquivos

          for (const relativePath of pathsToDeleteExclusao) {
              try {
                  if (relativePath) {
                    const fullPath = path.resolve(process.cwd(), relativePath);
                    await fs.unlink(fullPath);
                    console.log(`Arquivo deletado (aprovação de exclusão): ${fullPath}`);
                  }
              } catch (err: any) {
                  if (err.code !== 'ENOENT') {
                    console.warn(`AVISO: Falha ao deletar arquivo do disco (aprovação de exclusão): ${relativePath}`, err);
                  }
              }
          }
          responseMessage = "Estabelecimento excluído com sucesso.";

          // Envio de email pós-commit
          if (emailInfo && estabelecimento.emailEstabelecimento) { /* Verifica se emailEstabelecimento existe */
            try {
              await EmailService.sendGenericEmail({
                to: estabelecimento.emailEstabelecimento,
                subject: emailInfo.subject,
                html: emailInfo.html,
              });
              console.log(`Email de notificação de exclusão enviado com sucesso para ${estabelecimento.emailEstabelecimento}`);
            } catch (error) { console.error(`Falha ao enviar email de notificação de exclusão para ${estabelecimento.emailEstabelecimento}:`, error); }
          } else if (emailInfo) {
              console.warn(`Tentativa de enviar email de exclusão para estabelecimento ID ${estabelecimento.estabelecimentoId} sem endereço de email definido.`);
          }
          return res.status(200).json({ message: responseMessage });
          // Note: O break não é necessário aqui pois já retornamos

      } // Fim do switch

      // Commit para casos PENDENTE_APROVACAO e PENDENTE_ATUALIZACAO
      await transaction.commit();

      if (emailInfo && estabelecimento.emailEstabelecimento) { /* Verifica se emailEstabelecimento existe */
        try {
          await EmailService.sendGenericEmail({
            to: estabelecimento.emailEstabelecimento,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(`Email de notificação enviado com sucesso para ${estabelecimento.emailEstabelecimento}`);
        } catch (error) { console.error(`Falha ao enviar email de notificação para ${estabelecimento.emailEstabelecimento}:`, error); }
      } else if (emailInfo) {
          console.warn(`Tentativa de enviar email para estabelecimento ID ${estabelecimento.estabelecimentoId} sem endereço de email definido.`);
      }

      return res.status(200).json({ message: responseMessage });

    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A APROVAÇÃO:", error);
      return res.status(500).json({ message: "Erro ao aprovar a solicitação." });
    }
  }

  // --- MODIFICADO: Adicionado 'motivoRejeicao' ---
  static async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    // --- ADICIONADO ---
    const { motivoRejeicao } = req.body;
    const transaction = await sequelize.transaction();

    // --- ADICIONADO ---
    const motivoHtml = motivoRejeicao
      ? `<p><strong>Motivo da Rejeição:</strong> ${motivoRejeicao}</p>`
      : "<p>Recomendamos verificar os dados fornecidos ou entrar em contato com a Sala do Empreendedor para mais informações.</p>";

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, { transaction });
      if (!estabelecimento) {
         await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      let responseMessage = "Solicitação rejeitada com sucesso.";
      let emailInfo: { subject: string; html: string } | null = null;
      const emailParaNotificar = estabelecimento.emailEstabelecimento;
      let pathsToDeleteRejeicao: string[] = [];


      if (estabelecimento.status === StatusEstabelecimento.PENDENTE_APROVACAO) {
          // Coleta caminhos ANTES de destruir
          if (estabelecimento.logoUrl) pathsToDeleteRejeicao.push(estabelecimento.logoUrl);
          if (estabelecimento.ccmeiUrl) pathsToDeleteRejeicao.push(estabelecimento.ccmeiUrl);
          const imagensRejeicao = await ImagemProduto.findAll({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });
          imagensRejeicao.forEach(img => pathsToDeleteRejeicao.push(img.url));

          // Deleta do DB
          await ImagemProduto.destroy({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });
          await estabelecimento.destroy({ transaction });

          responseMessage = "Cadastro rejeitado e removido.";
          emailInfo = {
            subject: "Seu cadastro no MeideSaquá foi Rejeitado",
            // --- MODIFICADO ---
            html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Lamentamos informar que o cadastro do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovado.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>`
          };

      } else if (estabelecimento.status === StatusEstabelecimento.PENDENTE_ATUALIZACAO || estabelecimento.status === StatusEstabelecimento.PENDENTE_EXCLUSAO) {
          // Coleta caminhos dos arquivos PENDENTES (em dados_atualizacao)
          const dadosRejeitados = estabelecimento.dados_atualizacao as any;
          if (dadosRejeitados) {
            if (dadosRejeitados.logo) pathsToDeleteRejeicao.push(dadosRejeitados.logo);
            if (dadosRejeitados.ccmei) pathsToDeleteRejeicao.push(dadosRejeitados.ccmei);
            if (dadosRejeitados.produtos && Array.isArray(dadosRejeitados.produtos)) {
              pathsToDeleteRejeicao.push(...dadosRejeitados.produtos);
            }
          }

          const statusAnterior = estabelecimento.status;
          estabelecimento.status = StatusEstabelecimento.ATIVO; // Volta para ativo
          estabelecimento.dados_atualizacao = null; // Limpa os dados pendentes
          await estabelecimento.save({ transaction });

           if (statusAnterior === StatusEstabelecimento.PENDENTE_ATUALIZACAO) {
            // --- MODIFICADO ---
            emailInfo = { subject: "Sua solicitação de atualização no MeideSaquá foi Rejeitada", html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Os dados anteriores foram mantidos.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>` };
          } else { // PENDENTE_EXCLUSAO
            // --- MODIFICADO ---
             emailInfo = { subject: "Sua solicitação de exclusão no MeideSaquá foi Rejeitada", html: `<h1>Olá, ${estabelecimento.nomeResponsavel}.</h1><p>Informamos que a sua solicitação para remover o estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> não foi aprovada.</p><p>Seu estabelecimento continua ativo na plataforma.</p>${motivoHtml}<br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>` };
          }

      } else {
          await transaction.rollback();
          return res.status(400).json({ message: "O estabelecimento não está em um estado pendente para rejeição." });
      }

      await transaction.commit(); // Comita as alterações no banco

       // Tenta deletar os arquivos APÓS o commit
      for (const relativePath of pathsToDeleteRejeicao) {
          try {
              if (relativePath) {
                const fullPath = path.resolve(process.cwd(), relativePath);
                await fs.unlink(fullPath);
                console.log(`Arquivo deletado (rejeição): ${fullPath}`);
              }
          } catch (err: any) {
              if (err.code !== 'ENOENT') {
                console.warn(`AVISO: Falha ao deletar arquivo do disco (rejeição): ${relativePath}`, err);
              }
          }
      }

      if (emailInfo && emailParaNotificar) {
        try {
          await EmailService.sendGenericEmail({
            to: emailParaNotificar,
            subject: emailInfo.subject,
            html: emailInfo.html,
          });
          console.log(`Email de rejeição enviado com sucesso para ${emailParaNotificar}`);
        } catch (error) { console.error(`Falha ao enviar email de rejeição para ${emailParaNotificar}:`, error); }
      }

      return res.status(200).json({ message: responseMessage });

    } catch (error) {
       await transaction.rollback();
      console.error("Erro ao rejeitar solicitação:", error);
      return res.status(500).json({ message: "Erro ao rejeitar a solicitação." });
    }
  }

  static async editAndApproveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const adminEditedData = req.body;
    const transaction = await sequelize.transaction();
    let pathsToDeleteEditApprove: string[] = []; // Arquivos antigos a deletar

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, {
        transaction,
        include: [{ model: ImagemProduto, as: "produtosImg" }],
      });

      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      if (estabelecimento.status === StatusEstabelecimento.PENDENTE_EXCLUSAO) {
        await transaction.rollback();
        return res.status(400).json({ message: "Não é possível editar e aprovar uma solicitação de exclusão." });
      }

      let emailInfo: { subject: string; html: string } | null = null;
      const statusOriginal = estabelecimento.status;
      let dadosPendentes: any = {}; // Dados enviados pelo usuário, se houver

      if (statusOriginal === StatusEstabelecimento.PENDENTE_ATUALIZACAO && estabelecimento.dados_atualizacao) {
        dadosPendentes = estabelecimento.dados_atualizacao as any;
      }

      // 1. LÓGICA DE ARQUIVOS (considera o que o usuário enviou em dadosPendentes)
      const novaLogo = dadosPendentes.logo;
      if (novaLogo) { // Usuário enviou nova logo
        if (estabelecimento.logoUrl) pathsToDeleteEditApprove.push(estabelecimento.logoUrl); // Marca antiga para deletar
        adminEditedData.logoUrl = novaLogo; // Garante que a nova seja salva
      } // Se usuário não enviou, mantém a que o admin digitou (ou a original se admin não editou)

      const novoCcmei = dadosPendentes.ccmei;
      if (novoCcmei) { // Usuário enviou novo CCMEI
        if (estabelecimento.ccmeiUrl) pathsToDeleteEditApprove.push(estabelecimento.ccmeiUrl); // Marca antigo para deletar
        adminEditedData.ccmeiUrl = novoCcmei; // Garante que o novo seja salvo
      }

      const novasImagensProduto = dadosPendentes.produtos;
      if (novasImagensProduto && Array.isArray(novasImagensProduto)) { // Usuário enviou novas imagens
        const imagensAntigas = await ImagemProduto.findAll({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction });
        imagensAntigas.forEach(img => pathsToDeleteEditApprove.push(img.url)); // Marca antigas para deletar
        
        await ImagemProduto.destroy({ where: { estabelecimentoId: estabelecimento.estabelecimentoId }, transaction }); // Deleta refs antigas do DB
        
        const imagensFormatadas = novasImagensProduto.map((url: string) => ({
          url, estabelecimentoId: estabelecimento.estabelecimentoId,
        }));
        await ImagemProduto.bulkCreate(imagensFormatadas, { transaction }); // Cria novas refs no DB
      }

      // 2. APLICA AS ALTERAÇÕES FINAIS (com dados do admin e URLs de arquivos atualizadas)
      await estabelecimento.update(
        {
          ...adminEditedData, // Aplica dados editados pelo admin
          status: StatusEstabelecimento.ATIVO,
          ativo: true,
          dados_atualizacao: null, // Limpa JSON de pendências
          // Garante que logoUrl e ccmeiUrl sejam salvos (seja do admin ou do usuário)
          logoUrl: adminEditedData.logoUrl || estabelecimento.logoUrl,
          ccmeiUrl: adminEditedData.ccmeiUrl || estabelecimento.ccmeiUrl,
        },
        { transaction }
      );

      // 3. LÓGICA DE E-MAIL
       if (statusOriginal === StatusEstabelecimento.PENDENTE_APROVACAO) {
          emailInfo = { subject: "Seu cadastro no MeideSaquá foi Aprovado!", html: `<h1>Olá, ${estabelecimento.nomeResponsavel}!</h1> <p>Temos uma ótima notícia: o seu estabelecimento, <strong>${estabelecimento.nomeFantasia}</strong>, foi aprovado (com algumas edições do administrador) e já está visível na nossa plataforma!</p><p>Agradecemos por fazer parte da comunidade de empreendedores de Saquarema.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá.</strong></p>` };
        } else { // PENDENTE_ATUALIZACAO ou ATIVO (caso de edit direto)
          emailInfo = { subject: "Sua solicitação de atualização no MeideSaquá foi Aprovada!", html: `<h1>Olá, ${estabelecimento.nomeResponsavel}!</h1><p>A sua solicitação para atualizar os dados do estabelecimento <strong>${estabelecimento.nomeFantasia}</strong> foi aprovada (com algumas edições do administrador).</p><p>As novas informações já estão visíveis para todos na plataforma.</p><br><p>Atenciosamente,</p><p><strong>Equipe MeideSaquá</strong></p>` };
        }

      await transaction.commit(); // Comita tudo

      // 4. Deleta arquivos antigos APÓS o commit
      for (const relativePath of pathsToDeleteEditApprove) {
          try {
              if (relativePath) {
                const fullPath = path.resolve(process.cwd(), relativePath);
                await fs.unlink(fullPath);
                console.log(`Arquivo deletado (edit/approve): ${fullPath}`);
              }
          } catch (err: any) {
              if (err.code !== 'ENOENT') {
                console.warn(`AVISO: Falha ao deletar arquivo do disco (edit/approve): ${relativePath}`, err);
              }
          }
      }

      if (emailInfo && estabelecimento.emailEstabelecimento) {
        try {
          await EmailService.sendGenericEmail({ to: estabelecimento.emailEstabelecimento, subject: emailInfo.subject, html: emailInfo.html });
        } catch (error) { console.error(`Falha ao enviar email de notificação para ${estabelecimento.emailEstabelecimento}:`, error); }
      }

      return res.status(200).json({ message: "Estabelecimento editado e aprovado com sucesso." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A EDIÇÃO E APROVAÇÃO:", error);
      return res.status(500).json({ message: "Erro ao editar e aprovar a solicitação." });
    }
  }

  static async getAllActiveEstabelecimentos(req: Request, res: Response) {
    try {
      const estabelecimentos = await EstabelecimentoService.listarTodos();
      return res.json(estabelecimentos);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro ao buscar estabelecimentos ativos." });
    }
  }

  static async adminUpdateEstabelecimento(req: Request, res: Response) {
    const { id } = req.params;
    const adminEditedData = req.body;
    const transaction = await sequelize.transaction();

    try {
      const estabelecimento = await Estabelecimento.findByPk(id, { transaction });

      if (!estabelecimento) {
        await transaction.rollback();
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      // Campos que o admin pode editar DIRETAMENTE (sem ir para aprovação)
      const camposEditaveisDireto = [
        'nomeFantasia', 'categoria', 'cnae', 'emailEstabelecimento',
        'contatoEstabelecimento', 'endereco', 'descricao', 'descricaoDiferencial',
        'areasAtuacao', 'tagsInvisiveis', 'website', 'instagram',
        'nomeResponsavel', 'cpfResponsavel', 'ativo' // Permitir ativar/inativar
      ];

      let dadosParaUpdate: any = {};
      for(const campo of camposEditaveisDireto) {
        if(adminEditedData.hasOwnProperty(campo)) {
          dadosParaUpdate[campo] = adminEditedData[campo];
        }
      }

      // Se inativou, ajusta o status também (conforme correção anterior)
      if (dadosParaUpdate.ativo === false && estabelecimento.ativo === true) {
        dadosParaUpdate.status = StatusEstabelecimento.REJEITADO; // Ou outro status inativo
      } else if (dadosParaUpdate.ativo === true && estabelecimento.ativo === false) {
          dadosParaUpdate.status = StatusEstabelecimento.ATIVO;
      }

      await estabelecimento.update(dadosParaUpdate, { transaction });
      await transaction.commit();

      return res.status(200).json({ message: "Estabelecimento atualizado com sucesso pelo admin." });
    } catch (error) {
      await transaction.rollback();
      console.error("ERRO DURANTE A ATUALIZAÇÃO ADMIN:", error);
      return res.status(500).json({ message: "Erro ao atualizar o estabelecimento." });
    }
  }

  /**
   * Permite ao admin deletar PERMANENTEMENTE um estabelecimento.
   * Chamado pela rota DELETE /api/admin/estabelecimento/:id
   */
  static async adminDeleteEstabelecimento(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const transaction = await sequelize.transaction();
    let pathsToDelete: string[] = [];

    try {
      const estabelecimentoIdNum = parseInt(id);
       if (isNaN(estabelecimentoIdNum)) {
          await transaction.rollback();
         return res.status(400).json({ message: "ID do estabelecimento inválido." });
       }

      const estabelecimento = await Estabelecimento.findByPk(estabelecimentoIdNum, {
          include: [{ model: ImagemProduto, as: 'produtosImg' }],
          transaction
      });

      if (!estabelecimento) {
          await transaction.rollback();
          return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      if (estabelecimento.logoUrl) pathsToDelete.push(estabelecimento.logoUrl);
      if (estabelecimento.ccmeiUrl) pathsToDelete.push(estabelecimento.ccmeiUrl);
      const produtosImg = (estabelecimento as any).produtosImg;
      if (produtosImg && Array.isArray(produtosImg) && produtosImg.length > 0) {
          produtosImg.forEach((img: any) => pathsToDelete.push(img.url));
      }

      await Avaliacao.destroy({ where: { estabelecimentoId: estabelecimentoIdNum }, transaction });
      await ImagemProduto.destroy({ where: { estabelecimentoId: estabelecimentoIdNum }, transaction });
      await estabelecimento.destroy({ transaction });
      await transaction.commit();

      for (const relativePath of pathsToDelete) {
          try {
              if (relativePath) {
                const fullPath = path.resolve(process.cwd(), relativePath);
                await fs.unlink(fullPath);
                console.log(`Arquivo deletado: ${fullPath}`);
              }
          } catch (err: any) {
              if (err.code !== 'ENOENT') {
                console.warn(`AVISO: Falha ao deletar arquivo do disco: ${relativePath}`, err);
              }
          }
      }

      return res.status(200).json({ message: "Estabelecimento excluído permanentemente." });

    } catch (error: any) {
        await transaction.rollback();
        console.error("Falha ao excluir estabelecimento (admin):", error);
        return res.status(500).json({ message: "Erro interno ao excluir estabelecimento." });
    }
  }

  // --- ADICIONADO: Método para Admin ver avaliações de um Estabelecimento ---
  static async getAvaliacoesByEstabelecimento(req: Request, res: Response) {
    try {
      const { estabelecimentoId } = req.params;
      const idNum = parseInt(estabelecimentoId);

      if (isNaN(idNum)) {
        return res.status(400).json({ message: "ID do estabelecimento inválido." });
      }

      // 1. Busca o estabelecimento para validar e obter o nome
      const estabelecimento = await Estabelecimento.findByPk(idNum, {
        attributes: ["estabelecimentoId", "nomeFantasia"],
      });

      if (!estabelecimento) {
        return res.status(404).json({ message: "Estabelecimento não encontrado." });
      }

      // 2. Busca as avaliações (sem DTO, para ver todos os dados do usuário)
      const avaliacoes = await Avaliacao.findAll({
        where: { estabelecimentoId: idNum },
        include: [
          {
            model: Usuario,
            as: "usuario",
            // Admin pode ver o email, mas não a senha
            attributes: ["usuarioId", "nomeCompleto", "email", "username"], 
          },
        ],
        order: [["avaliacoesId", "DESC"]],
      });

      // 3. Retorna o estabelecimento e suas avaliações
      return res.json({ estabelecimento, avaliacoes });
    } catch (error) {
      console.error("Erro ao buscar avaliações (admin):", error);
      return res.status(500).json({ message: "Erro ao buscar avaliações." });
    }
  }

  // --- ADICIONADO: Método para Admin deletar qualquer avaliação ---
  static async adminDeleteAvaliacao(req: Request, res: Response) {
    const { id } = req.params; // ID da Avaliação
    const idNum = parseInt(id);

     if (isNaN(idNum)) {
        return res.status(400).json({ message: "ID da avaliação inválido." });
      }

    try {
      const avaliacao = await Avaliacao.findByPk(idNum);

      if (!avaliacao) {
        return res.status(404).json({ message: "Avaliação não encontrada." });
      }

      // Admin não precisa de verificação de propriedade, apenas exclui
      await avaliacao.destroy();

      return res.status(200).json({ message: "Avaliação excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir avaliação (admin):", error);
      return res.status(500).json({ message: "Erro ao excluir a avaliação." });
    }
  }
}

export default AdminController;